import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TaskAssignment } from '../../types';
import { Check, X, Save, Send } from 'lucide-react';
import { Pagination } from '../../components/Pagination';

export const PendingJudgments: React.FC = () => {
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchTasks();
  }, [currentPage, pageSize]);

  const fetchTasks = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .from('task_assignments')
        .select(`
          id, status, judgment_result, judgment_note,
          product:products (id, erp_sku, erp_image_url, ozon_sku, ozon_image_url, usd_price)
        `, { count: 'exact' })
        .in('status', ['claimed', 'draft'])
        .order('claimed_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setTasks(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      alert('获取任务失败: ' + error.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleUpdateDraft = (taskId: string, field: 'judgment_result' | 'judgment_note', value: any) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  const saveDraft = async (task: TaskAssignment) => {
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          status: 'draft',
          judgment_result: task.judgment_result,
          judgment_note: task.judgment_note
        })
        .eq('id', task.id);
        
      if (error) throw error;
      alert('草稿保存成功');
    } catch (err: any) {
      alert('保存失败: ' + err.message);
    }
  };

  const submitJudgment = async (task: TaskAssignment) => {
    if (!task.judgment_result) {
      alert('必须选择 是 或 否');
      return;
    }

    try {
      const { error } = await supabase.rpc('submit_judgment', {
        p_task_id: task.id,
        p_result: task.judgment_result,
        p_note: task.judgment_note || ''
      });
      
      if (error) throw error;
      
      // Refresh list to fill the gap
      fetchTasks(false);
    } catch (err: any) {
      alert('提交失败: ' + err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">等待判断任务 ({tasks.length})</h1>
      
      {tasks.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-10 text-center text-gray-500">
          您当前没有待处理的任务，请先前往获取任务。
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {tasks.map(task => (
              <div key={task.id} className="bg-white shadow rounded-lg overflow-hidden flex flex-col md:flex-row">
                {/* Product Info */}
                <div className="p-4 md:w-2/3 border-b md:border-b-0 md:border-r border-gray-200">
                  <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                    <div className="flex-1 space-y-2">
                      <p className="font-semibold text-gray-900">ERP SKU: <span className="font-normal">{task.product?.erp_sku}</span></p>
                      <a href={task.product?.erp_image_url} target="_blank" rel="noreferrer" className="block w-full max-w-[200px] aspect-square rounded border overflow-hidden">
                        <img src={task.product?.erp_image_url} alt="ERP" className="w-full h-full object-cover hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                      </a>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="font-semibold text-gray-900">Ozon SKU: <span className="font-normal">{task.product?.ozon_sku}</span></p>
                      <a href={task.product?.ozon_image_url} target="_blank" rel="noreferrer" className="block w-full max-w-[200px] aspect-square rounded border overflow-hidden">
                        <img src={task.product?.ozon_image_url} alt="Ozon" className="w-full h-full object-cover hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                      </a>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    价格: <span className="font-bold text-green-600">${task.product?.usd_price?.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="p-4 md:w-1/3 flex flex-col justify-between bg-gray-50">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">判断结果</label>
                      <div className="flex space-x-4">
                        <button
                          onClick={() => handleUpdateDraft(task.id, 'judgment_result', 'yes')}
                          className={`flex-1 py-2 px-4 rounded border flex items-center justify-center font-medium transition ${
                            task.judgment_result === 'yes' ? 'bg-green-100 border-green-500 text-green-800 ring-2 ring-green-500 ring-offset-1' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Check className="w-4 h-4 mr-2" /> 是
                        </button>
                        <button
                          onClick={() => handleUpdateDraft(task.id, 'judgment_result', 'no')}
                          className={`flex-1 py-2 px-4 rounded border flex items-center justify-center font-medium transition ${
                            task.judgment_result === 'no' ? 'bg-red-100 border-red-500 text-red-800 ring-2 ring-red-500 ring-offset-1' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <X className="w-4 h-4 mr-2" /> 否
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">备注 (可选)</label>
                      <textarea
                        value={task.judgment_note || ''}
                        onChange={e => handleUpdateDraft(task.id, 'judgment_note', e.target.value)}
                        rows={2}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 text-sm"
                        placeholder="填写相关备注信息..."
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => saveDraft(task)}
                      className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-50 flex justify-center items-center text-sm font-medium"
                    >
                      <Save className="w-4 h-4 mr-1.5" /> 保存草稿
                    </button>
                    <button
                      onClick={() => submitJudgment(task)}
                      disabled={!task.judgment_result}
                      className="flex-1 bg-blue-600 border border-transparent text-white py-2 px-4 rounded hover:bg-blue-700 flex justify-center items-center text-sm font-medium disabled:opacity-50"
                    >
                      <Send className="w-4 h-4 mr-1.5" /> 提交
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="rounded-lg shadow overflow-hidden">
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}
    </div>
  );
};
