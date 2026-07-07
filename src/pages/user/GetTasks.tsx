import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DownloadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const GetTasks: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClaim = async () => {
    if (!user) return;
    if (quantity < 1 || quantity > 100) {
      setMessage({ type: 'error', text: '领取数量必须在 1 到 100 之间' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.rpc('claim_judgment_tasks', {
        p_user_id: user.id,
        p_quantity: quantity
      });

      if (error) throw error;

      if (data === 0) {
        setMessage({ type: 'error', text: '当前没有可领取的未判断任务，或您已领取完现有任务。' });
      } else {
        setMessage({ type: 'success', text: `成功领取了 ${data} 个判断任务！` });
        // Redirect to pending after short delay
        setTimeout(() => navigate('/user/pending-judgments'), 1500);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: '领取失败: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-10">
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <DownloadCloud className="mx-auto h-16 w-16 text-blue-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">获取判断任务</h2>
        <p className="text-gray-600 mb-8">
          从公共产品池中随机获取未判断的产品，进行是/否判定。一次最多领取 100 个。
        </p>

        {message && (
          <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="max-w-xs mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 text-left mb-1">领取数量</label>
            <input
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value) || 1)}
              className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
            />
          </div>
          
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '获取中...' : '立即获取'}
          </button>
        </div>
      </div>
    </div>
  );
};
