import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import { Upload, Download, Search, AlertCircle, CheckCircle, Trash2, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Pagination } from '../../components/Pagination';

export const ProductsManager: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unjudged' | 'yes' | 'no'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; success: number; failed: number; skipped: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, [activeTab, currentPage, pageSize]);

  const fetchProducts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    if (showLoading) setSelectedIds([]); // Clear selection when fetching new data
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          judged_profile:profiles!products_judged_by_fkey(username)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });
        
      if (activeTab !== 'all') {
        query = query.eq('judgment_status', activeTab);
      }
      
      if (searchTerm) {
        query = query.or(`erp_sku.ilike.%${searchTerm}%,ozon_sku.ilike.%${searchTerm}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      
      const { data, count, error } = await query;
      
      if (error) throw error;
      setProducts(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      alert('获取产品失败: ' + error.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const fileType = file.name.split('.').pop()?.toLowerCase();

    if (fileType === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          await processImportedData(results.data, file.name);
        },
        error: (error) => {
          alert('CSV解析失败: ' + error.message);
          setImporting(false);
        }
      });
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        await processImportedData(data, file.name);
      };
      reader.readAsBinaryString(file);
    } else {
      alert('不支持的文件格式。请上传 CSV 或 Excel。');
      setImporting(false);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImportedData = async (data: any[], filename: string) => {
    const total = data.length;
    let success = 0;
    let failed = 0;
    let skipped = 0;
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Create import batch record
    const { data: batchData } = await supabase
      .from('import_batches')
      .insert({ imported_by: user?.id, filename, total_rows: total })
      .select()
      .single();
      
    const batchId = batchData?.id;

    for (const row of data) {
      // Find headers flexibly (case-insensitive, trim)
      const keys = Object.keys(row);
      const getVal = (possibleNames: string[]) => {
        const key = keys.find(k => possibleNames.includes(k.trim().toLowerCase()));
        return key ? String(row[key]).trim() : '';
      };

      const erp_sku = getVal(['erpsku', 'erp_sku', 'erp sku']);
      const erp_image_url = getVal(['erp图片链接', 'erp图片', 'erp_image', 'erp_image_url']);
      const ozon_sku = getVal(['ozonsku', 'ozon_sku', 'ozon sku']);
      const ozon_image_url = getVal(['ozon图片链接', 'ozon图片', 'ozon_image', 'ozon_image_url']);
      const priceStr = getVal(['产品美元价格', '美元价格', 'price', 'usd_price', 'usd price']);
      const usd_price = priceStr ? parseFloat(priceStr) : 0;
      const statusStr = getVal(['判断状态', '状态', 'judgment_status', 'status']);

      let judgment_status = 'unjudged';
      if (statusStr === '是' || statusStr.toLowerCase() === 'yes') judgment_status = 'yes';
      else if (statusStr === '否' || statusStr.toLowerCase() === 'no') judgment_status = 'no';

      if (!erp_sku || !ozon_sku || !erp_image_url || !ozon_image_url) {
        failed++;
        continue;
      }

      // Check if URL is roughly valid
      if (!erp_image_url.startsWith('http') || !ozon_image_url.startsWith('http')) {
        failed++;
        continue;
      }
      
      if (isNaN(usd_price) || usd_price < 0) {
        failed++;
        continue;
      }

      try {
        const { error } = await supabase.from('products').insert({
          erp_sku,
          erp_image_url,
          ozon_sku,
          ozon_image_url,
          usd_price,
          judgment_status,
          created_by: user?.id,
          judged_by: judgment_status !== 'unjudged' ? user?.id : null,
          judged_at: judgment_status !== 'unjudged' ? new Date().toISOString() : null,
          import_batch_id: batchId
        });

        if (error) {
          if (error.code === '23505') { // Unique violation
            skipped++;
          } else {
            failed++;
          }
        } else {
          success++;
        }
      } catch (err) {
        failed++;
      }
    }

    if (batchId) {
      await supabase.from('import_batches').update({
        success_rows: success,
        failed_rows: failed,
        skipped_rows: skipped
      }).eq('id', batchId);
    }

    setImportResult({ total, success, failed, skipped });
    setImporting(false);
    setCurrentPage(1);
    fetchProducts();
  };
  
  const handleExport = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('products')
        .select(`
          erp_sku,
          erp_image_url,
          ozon_sku,
          ozon_image_url,
          usd_price,
          judgment_status,
          created_at,
          judged_at,
          judged_profile:profiles!products_judged_by_fkey(username)
        `)
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('judgment_status', activeTab);
      }
      
      if (searchTerm) {
        query = query.or(`erp_sku.ilike.%${searchTerm}%,ozon_sku.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const formattedData = (data || []).map(item => ({
        'ERP SKU': item.erp_sku,
        'ERP 图片链接': item.erp_image_url,
        'Ozon SKU': item.ozon_sku,
        'Ozon 图片链接': item.ozon_image_url,
        '美元价格': item.usd_price,
        '判断状态': item.judgment_status === 'yes' ? '是' : item.judgment_status === 'no' ? '否' : '未判断',
        '判断人': item.judged_profile?.username || '',
        '判断时间': item.judged_at ? new Date(item.judged_at).toLocaleString('zh-CN') : '',
        '创建时间': item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      const tabName = activeTab === 'all' ? '全部' : activeTab === 'unjudged' ? '未判断' : activeTab === 'yes' ? '判定为是' : '判定为否';
      XLSX.writeFile(wb, `公共产品库_${tabName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      alert('导出失败: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条产品记录吗？')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        alert('删除失败: ' + error.message);
      } else {
        fetchProducts(false);
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`确定要删除选中的 ${selectedIds.length} 条产品记录吗？`)) {
      const { error } = await supabase.from('products').delete().in('id', selectedIds);
      if (error) {
        alert('批量删除失败: ' + error.message);
      } else {
        setSelectedIds([]); // manually clear selection
        fetchProducts(false);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const filteredProducts = products.filter(p => 
    p.erp_sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.ozon_sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">公共数据库管理</h1>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? '导出中...' : (
              <>
                <Download className="h-4 w-4 mr-2" />
                导出全部
              </>
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? (
              <>导入中...</>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                导入产品
              </>
            )}
          </button>
        </div>
      </div>

      {importResult && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">导入完成</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>总计处理: {importResult.total} 行</p>
                <p>成功导入: {importResult.success} 条</p>
                <p>跳过重复: {importResult.skipped} 条</p>
                <p>导入失败: {importResult.failed} 条 (缺少必填项或格式错误)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
              {(['all', 'unjudged', 'yes', 'no'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    activeTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'all' ? '全部' : tab === 'unjudged' ? '未判断' : tab === 'yes' ? '判定为是' : '判定为否'}
                </button>
              ))}
            </div>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                批量删除 ({selectedIds.length})
              </button>
            )}
          </div>
          
          <div className="relative rounded-md shadow-sm max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={e => e.key === 'Enter' && fetchProducts()}
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
              placeholder="按回车搜索 ERP/Ozon SKU..."
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">加载中...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={products.length > 0 && selectedIds.length === products.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">图片预览</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ERP SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ozon SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">价格</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态与操作人</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <a href={product.erp_image_url} target="_blank" rel="noreferrer" title="ERP 图片">
                            <img src={product.erp_image_url} alt="" className="h-10 w-10 object-cover rounded border" referrerPolicy="no-referrer" />
                          </a>
                          <a href={product.ozon_image_url} target="_blank" rel="noreferrer" title="Ozon 图片">
                            <img src={product.ozon_image_url} alt="" className="h-10 w-10 object-cover rounded border" referrerPolicy="no-referrer" />
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.erp_sku}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.ozon_sku}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${product.usd_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${
                            product.judgment_status === 'unjudged' ? 'bg-yellow-100 text-yellow-800' :
                            product.judgment_status === 'yes' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {product.judgment_status === 'unjudged' ? '未判断' : product.judgment_status === 'yes' ? '是' : '否'}
                          </span>
                          {product.judged_profile?.username && (
                            <span className="text-xs text-gray-500">
                              由 {product.judged_profile.username}
                              <br />
                              在 {new Date(product.judged_at).toLocaleString('zh-CN')} 判断
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  暂无产品数据
                </div>
              )}
            </div>
            {products.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
