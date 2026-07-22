import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User as UserIcon } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  if (user && profile) {
    if (!profile.is_active) {
      // Handled by Layout, but if they hit login we can just render normal, 
      // but usually we redirect them to root to let Layout handle it.
      return <Navigate to="/" replace />;
    }
    if (profile.must_change_password) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/user'} replace />;
  }

  // If user is logged in but profile is missing
  if (user && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">账号配置异常</h2>
          <p className="text-gray-700 mb-4">登录成功，但在数据库中找不到对应的用户资料 (profiles 表缺失记录)。</p>
          <p className="text-sm text-gray-500 mb-6">
            如果您是刚创建的管理账号，可能是因为您在运行 SQL 创建表之前就创建了用户，导致触发器没生效。
            <br/><br/>
            请到 Supabase 控制台，删除该用户并重新创建，或者手动在 profiles 表中插入对应记录。
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            退出登录并重试
          </button>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const dummyEmail = `${username}@system.local`;
      const { error } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('用户名或密码错误');
        }
        throw error;
      }
      
      // Navigation is handled by AuthContext updates triggering the Navigate above
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          图片数据管理系统
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          请登录您的账号
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">账号</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 block w-full sm:text-sm border-gray-300 rounded-md py-2 border focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入用户名"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">密码</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full sm:text-sm border-gray-300 rounded-md py-2 border focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入密码"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
