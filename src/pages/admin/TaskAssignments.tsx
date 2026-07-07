import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TaskAssignment } from '../../types';
import { Pagination } from '../../components/Pagination';

export const TaskAssignments: React.FC = () => {
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchTasks();
  }, [currentPage, pageSize]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          product:products (erp_sku, ozon_sku, judgment_status),
          assignee:profiles!task_assignments_assigned_user_id_fkey (username)
        `, { count: 'exact' })
        .order('claimed_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setTasks(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      alert('获取任务失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">任务概览</h1>
      
      <div className="bg-white shadow rounded-lg p-6 overflow-x-auto">
        {loading ? (
          <div className="text-center py-10 text-gray-500">加载中...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ERP SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">判断结果</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">领取时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">提交时间</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{task.assignee?.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{task.product?.erp_sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      task.status === 'claimed' ? 'bg-blue-100 text-blue-800' :
                      task.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {task.status === 'claimed' ? '已领取' : task.status === 'draft' ? '草稿' : '已提交'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {task.judgment_result === 'yes' ? '是' : task.judgment_result === 'no' ? '否' : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(task.claimed_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.submitted_at ? new Date(task.submitted_at).toLocaleString('zh-CN') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && tasks.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
};
