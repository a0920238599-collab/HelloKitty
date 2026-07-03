import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuditLog } from '../types';
import { format } from 'date-fns';
import { ShieldAlert } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        
        let apiSuccess = false;
        try {
          const res = await fetch('/api/audit_logs', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setLogs(data);
            apiSuccess = true;
          }
        } catch (apiErr) {
          console.warn('API fetch failed, falling back to client', apiErr);
        }

        if (!apiSuccess) {
          const { data, error } = await supabase
            .from('audit_logs')
            .select('*, operator:profiles(username)')
            .order('created_at', { ascending: false })
            .limit(500);
          if (error) throw error;
          setLogs(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShieldAlert className="w-6 h-6 mr-2 text-purple-600" />
            系统操作日志
          </h1>
          <p className="mt-2 text-sm text-gray-700">查看所有管理员对系统数据和用户的修改记录（仅显示最近500条）。</p>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">加载中...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">暂无日志</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.operator?.username || 'System'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {log.operation_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate" title={log.detail}>
                      {log.detail}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
