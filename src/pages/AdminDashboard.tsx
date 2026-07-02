import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Database, ShieldAlert, ListChecks, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">管理员控制台</h1>
        <p className="mt-1 text-sm text-gray-500">
          欢迎回来，{profile?.username}。请选择您要进行的操作。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/admin/users"
          className="bg-white overflow-hidden shadow rounded-lg border hover:border-blue-500 transition-colors"
        >
          <div className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">账号管理</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">用户列表、权限</dd>
              </dl>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/products"
          className="bg-white overflow-hidden shadow rounded-lg border hover:border-green-500 transition-colors"
        >
          <div className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <Database className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">数据管理</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">公共产品数据库</dd>
              </dl>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/tasks"
          className="bg-white overflow-hidden shadow rounded-lg border hover:border-yellow-500 transition-colors"
        >
          <div className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <ListChecks className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">任务概览</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">查看分配记录</dd>
              </dl>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/settings"
          className="bg-white overflow-hidden shadow rounded-lg border hover:border-indigo-500 transition-colors"
        >
          <div className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
              <Settings className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">系统设置</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">跟卖规则配置</dd>
              </dl>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/audit-logs"
          className="bg-white overflow-hidden shadow rounded-lg border hover:border-purple-500 transition-colors"
        >
          <div className="p-5 flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <ShieldAlert className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">安全审计</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">查看操作日志</dd>
              </dl>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};
