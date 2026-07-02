import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, KeyRound, Ban, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user: currentUser } = useAuth();
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError('无法获取用户列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '创建失败');
      }
      
      setShowCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (id === currentUser?.id) {
      alert("不能禁用自己的账号");
      return;
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (!res.ok) throw new Error('操作失败');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (id === currentUser?.id) {
      alert("不能删除自己的账号");
      return;
    }
    if (window.confirm(`确认永久删除用户 ${username} 吗？此操作无法恢复！`)) {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        
        const res = await fetch(`/api/users/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || '删除失败');
        }
        fetchUsers();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      const res = await fetch(`/api/users/${resetUserId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: resetPassword })
      });
      
      if (!res.ok) throw new Error('重置失败');
      
      setShowResetModal(false);
      setResetPassword('');
      alert('密码重置成功，用户下次登录需强制修改密码。');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="mt-2 text-sm text-gray-700">管理系统所有的管理员和普通用户账号。</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            新增用户
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md border">
        <ul className="divide-y divide-gray-200">
          {users.map((u) => (
            <li key={u.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-900">{u.username}</span>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                    {u.role === 'admin' ? '管理员' : '普通用户'}
                  </span>
                  {!u.is_active && (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      已禁用
                    </span>
                  )}
                  {u.must_change_password && (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      需改密
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  创建于: {format(new Date(u.created_at), 'yyyy-MM-dd HH:mm')}
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleToggleActive(u.id, u.is_active)}
                  disabled={u.id === currentUser?.id}
                  className={`flex items-center text-sm ${u.is_active ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'} disabled:opacity-50`}
                  title={u.is_active ? '禁用账号' : '启用账号'}
                >
                  {u.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => { setResetUserId(u.id); setShowResetModal(true); }}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-900"
                  title="重置密码"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteUser(u.id, u.username)}
                  disabled={u.id === currentUser?.id}
                  className="flex items-center text-sm text-red-600 hover:text-red-900 disabled:opacity-50"
                  title="删除账号"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">新增用户</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">用户名</label>
                <input required value={newUsername} onChange={e => setNewUsername(e.target.value)} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">密码</label>
                <input required value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" minLength={6} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">角色</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin'|'user')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div className="mt-5 sm:mt-6 flex space-x-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 border border-transparent rounded-md shadow-sm px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">确定</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">重置密码</h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">新密码</label>
                <input required value={resetPassword} onChange={e => setResetPassword(e.target.value)} type="text" minLength={6} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="至少 6 位字符" />
              </div>
              <div className="mt-5 sm:mt-6 flex space-x-3">
                <button type="button" onClick={() => setShowResetModal(false)} className="flex-1 bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 border border-transparent rounded-md shadow-sm px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">确认重置</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
