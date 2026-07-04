import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserProductLibrary } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Gift, Download, Search, Info } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import * as XLSX from 'xlsx';

export const FollowSaleProducts: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<UserProductLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Status
  const [status, setStatus] = useState<any>(null);
  const [claimQuantity, setClaimQuantity] = useState<number | ''>('');

  useEffect(() => {
    fetchProducts();
  }, [currentPage, pageSize, startDate, endDate]);

  useEffect(() => {
    if (user) {
      fetchStatus();
    }
  }, [user]);

  const fetchStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/claim-status', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        
      }
    } catch (e) {
      console.warn('Fetch claim status API failed, using fallback', e);
      
    }
  };


  const fetchProducts = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('user_product_library')
        .select(`
          *,
          product:products (erp_sku, erp_image_url, ozon_sku, ozon_image_url, usd_price)
        `, { count: 'exact' });

      if (startDate) {
        query = query.gte('received_at', `${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        query = query.lte('received_at', `${endDate}T23:59:59.999Z`);
      }

      const { data, count, error } = await query
        .order('received_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setProducts(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      alert('获取记录失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!user) return;
    setClaiming(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthenticated");

      let claimedAmount = 0;
      let apiSuccess = false;

      try {
        const bodyPayload = claimQuantity ? { quantity: Number(claimQuantity) } : {};
        const res = await fetch('/api/claim-products', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bodyPayload)
        });
        const data = await res.json();
        
        if (res.ok) {
          
          claimedAmount = data.claimedAmount;
        } else {
          throw new Error(data.error || '领取失败');
        }
      } catch (apiError) {
        console.error("API fetch failed:", apiError); throw apiError;
        
      }

      if (claimedAmount === 0) {
        setMessage({ type: 'error', text: '当前没有符合条件的跟卖产品可供领取，或您已领取过所有符合条件的产品。' });
      } else {
        setMessage({ type: 'success', text: `成功领取了 ${claimedAmount} 个跟卖产品！` });
        fetchProducts();
        fetchStatus();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setClaiming(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('user_product_library')
        .select(`
          *,
          product:products (erp_sku, erp_image_url, ozon_sku, ozon_image_url, usd_price)
        `);

      if (startDate) {
        query = query.gte('received_at', `${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        query = query.lte('received_at', `${endDate}T23:59:59.999Z`);
      }

      const { data, error } = await query.order('received_at', { ascending: false });

      if (error) throw error;
      
      const formattedData = (data || []).map(item => ({
        'ERP SKU': item.product?.erp_sku,
        'ERP 图片链接': item.product?.erp_image_url,
        'Ozon SKU': item.product?.ozon_sku,
        'Ozon 图片链接': item.product?.ozon_image_url,
        '价格 (USD)': item.product?.usd_price,
        '领取时间': new Date(item.received_at).toLocaleString('zh-CN')
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FollowSale');
      XLSX.writeFile(wb, `我的跟卖产品_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      alert('导出失败: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const canClaim = status && status.availableQuota > 0 && status.claimedToday < status.dailyClaimLimit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">我的跟卖产品</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md shadow-sm border border-gray-200">
            <span className="text-sm text-gray-500">日期:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="text-sm border-none focus:ring-0 p-0"
            />
            <span className="text-gray-300">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="text-sm border-none focus:ring-0 p-0"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? '导出中...' : (
              <>
                <Download className="w-4 h-4 mr-2" />
                导出
              </>
            )}
          </button>
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md shadow-sm border border-gray-200">
             <span className="text-sm text-gray-500">数量:</span>
             <input 
               type="number"
               min="1"
               max={status ? Math.min(status.availableQuota, status.dailyClaimLimit - status.claimedToday) : ""}
               placeholder="不填则全领"
               className="text-sm border-none focus:ring-0 p-0 w-24 text-center"
               value={claimQuantity}
               onChange={(e) => setClaimQuantity(e.target.value === '' ? '' : Number(e.target.value))}
               disabled={!canClaim}
             />
          </div>
          <button
            onClick={handleClaim}
            disabled={claiming || !canClaim}
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
          {claiming ? '领取中...' : (
            <>
              <Gift className="w-4 h-4 mr-2" />
              领取跟卖产品
            </>
          )}
        </button>
      </div>
      </div>

      {status && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">领取状态</h3>
              <p className="mt-1 text-sm text-blue-700">
                每提交一个“是”的判断可获得 1 个额度。
                每日最多提取 <span className="font-bold">{status.dailyClaimLimit}</span> 个。
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded shadow-sm border border-blue-100 text-center min-w-[100px]">
              <div className="text-xs text-gray-500">可领取额度</div>
              <div className="text-xl font-bold text-blue-600">{status.availableQuota}</div>
            </div>
            <div className="bg-white px-4 py-2 rounded shadow-sm border border-blue-100 text-center min-w-[100px]">
              <div className="text-xs text-gray-500">今日已领</div>
              <div className="text-xl font-bold text-gray-700">{status.claimedToday} / {status.dailyClaimLimit}</div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 overflow-x-auto">
        {loading ? (
          <div className="text-center py-10 text-gray-500">加载中...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">图片预览</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ERP SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ozon SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">价格</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">领取时间</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <a href={item.product?.erp_image_url} target="_blank" rel="noreferrer">
                        <img src={item.product?.erp_image_url} alt="" className="h-10 w-10 object-cover rounded border" referrerPolicy="no-referrer" />
                      </a>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.product?.erp_sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.product?.ozon_sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.product?.usd_price?.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.received_at).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {products.length === 0 && !loading && (
          <div className="text-center py-10 text-gray-500">
            您还没有领取跟卖产品。
          </div>
        )}
        {products.length > 0 && !loading && (
          <div className="mt-4 -mx-6 -mb-6">
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
};
