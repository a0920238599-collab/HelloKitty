import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { DownloadCloud, CheckCircle, Gift, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const UserDashboard: React.FC = () => {
  const { profile } = useAuth();
  
  const [stats, setStats] = useState({
    pending: 0,
    submitted: 0,
    followSale: 0
  });

  useEffect(() => {
    if (profile) {
      fetchStats();
    }
  }, [profile]);

  const fetchStats = async () => {
    try {
      // Pending
      const { count: pendingCount } = await supabase
        .from('task_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_user_id', profile?.id)
        .in('status', ['claimed', 'draft']);

      // Submitted
      const { count: submittedCount } = await supabase
        .from('task_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_user_id', profile?.id)
        .eq('status', 'submitted');

      // Follow sale
      const { count: fsCount } = await supabase
        .from('user_product_library')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile?.id);

      setStats({
        pending: pendingCount || 0,
        submitted: submittedCount || 0,
        followSale: fsCount || 0
      });
    } catch (e) {
      console.error('Fetch stats failed', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">欢迎回来，{profile?.username}</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">这里是您的个人工作台概览</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/user/get-tasks" className="block bg-white shadow rounded-lg p-6 hover:shadow-md transition">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
              <DownloadCloud className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">获取任务</h4>
              <p className="text-sm text-gray-500">从公共数据库抽取新的判断任务</p>
            </div>
          </div>
        </Link>

        <Link to="/user/pending-judgments" className="block bg-white shadow rounded-lg p-6 hover:shadow-md transition relative">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">等待判断</h4>
              <p className="text-sm text-gray-500">完成您已领取的图片判断任务</p>
            </div>
          </div>
          <div className="absolute top-6 right-6 text-2xl font-bold text-gray-300">
            {stats.pending}
          </div>
        </Link>

        <Link to="/user/follow-sale" className="block bg-white shadow rounded-lg p-6 hover:shadow-md transition relative">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-full">
              <Gift className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">我的跟卖产品</h4>
              <p className="text-sm text-gray-500">每日达标后领取跟卖产品库</p>
            </div>
          </div>
          <div className="absolute top-6 right-6 text-2xl font-bold text-gray-300">
            {stats.followSale}
          </div>
        </Link>

        <Link to="/user/export" className="block bg-white shadow rounded-lg p-6 hover:shadow-md transition">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
              <Download className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">导出数据</h4>
              <p className="text-sm text-gray-500">下载跟卖表格与历史判断记录</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};
