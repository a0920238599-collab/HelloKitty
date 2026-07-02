import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

export const ExportData: React.FC = () => {
  const { profile } = useAuth();
  const [exportingFollowSale, setExportingFollowSale] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  const downloadFile = (data: any[], filename: string, type: 'csv' | 'xlsx') => {
    if (type === 'csv') {
      const csv = Papa.unparse(data);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }
  };

  const handleExportFollowSale = async (type: 'csv' | 'xlsx') => {
    setExportingFollowSale(true);
    try {
      const { data, error } = await supabase
        .from('user_product_library')
        .select(`
          received_at,
          product:products (erp_sku, erp_image_url, ozon_sku, ozon_image_url, usd_price)
        `)
        .order('received_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('没有跟卖产品可供导出');
        return;
      }

      const formattedData = data.map(item => ({
        'ERP SKU': item.product?.erp_sku,
        'ERP 图片链接': item.product?.erp_image_url,
        'Ozon SKU': item.product?.ozon_sku,
        'Ozon 图片链接': item.product?.ozon_image_url,
        '美元价格': item.product?.usd_price,
        '产品来源类型': '跟卖文件',
        '领取时间': format(new Date(item.received_at), 'yyyy-MM-dd HH:mm:ss')
      }));

      const filename = `${profile?.username}_跟卖产品_${format(new Date(), 'yyyy-MM-dd')}`;
      downloadFile(formattedData, filename, type);
    } catch (err: any) {
      alert('导出失败: ' + err.message);
    } finally {
      setExportingFollowSale(false);
    }
  };

  const handleExportAll = async (type: 'csv' | 'xlsx') => {
    setExportingAll(true);
    try {
      // Get Tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('task_assignments')
        .select(`
          status, judgment_result, claimed_at, submitted_at,
          product:products (erp_sku, erp_image_url, ozon_sku, ozon_image_url, usd_price)
        `);

      if (tasksError) throw tasksError;

      // Get Follow Sale
      const { data: followSales, error: fsError } = await supabase
        .from('user_product_library')
        .select(`
          received_at,
          product:products (erp_sku, erp_image_url, ozon_sku, ozon_image_url, usd_price)
        `);

      if (fsError) throw fsError;

      const formattedTasks = (tasks || []).map(item => ({
        'ERP SKU': item.product?.erp_sku,
        'ERP 图片链接': item.product?.erp_image_url,
        'Ozon SKU': item.product?.ozon_sku,
        'Ozon 图片链接': item.product?.ozon_image_url,
        '美元价格': item.product?.usd_price,
        '产品来源类型': '判断任务',
        '领取时间': format(new Date(item.claimed_at), 'yyyy-MM-dd HH:mm:ss'),
        '判断结果': item.judgment_result === 'yes' ? '是' : item.judgment_result === 'no' ? '否' : '',
        '判断提交时间': item.submitted_at ? format(new Date(item.submitted_at), 'yyyy-MM-dd HH:mm:ss') : '',
        '当前状态': item.status === 'submitted' ? '已提交' : item.status === 'draft' ? '草稿' : '已领取未判断'
      }));

      const formattedFollowSales = (followSales || []).map(item => ({
        'ERP SKU': item.product?.erp_sku,
        'ERP 图片链接': item.product?.erp_image_url,
        'Ozon SKU': item.product?.ozon_sku,
        'Ozon 图片链接': item.product?.ozon_image_url,
        '美元价格': item.product?.usd_price,
        '产品来源类型': '跟卖产品',
        '领取时间': format(new Date(item.received_at), 'yyyy-MM-dd HH:mm:ss'),
        '判断结果': '',
        '判断提交时间': '',
        '当前状态': '已获取'
      }));

      const allData = [...formattedTasks, ...formattedFollowSales];

      if (allData.length === 0) {
        alert('没有数据可供导出');
        return;
      }

      const filename = `${profile?.username}_个人数据库全部内容_${format(new Date(), 'yyyy-MM-dd')}`;
      downloadFile(allData, filename, type);
    } catch (err: any) {
      alert('导出失败: ' + err.message);
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">导出数据</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Follow Sale */}
        <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center text-center">
          <GiftIcon className="w-12 h-12 text-green-500 mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">导出我的跟卖产品</h2>
          <p className="text-sm text-gray-500 mb-6 flex-grow">
            仅导出您已领取的“跟卖产品”列表。适合快速上架。
          </p>
          <div className="flex space-x-3 w-full">
            <button
              onClick={() => handleExportFollowSale('xlsx')}
              disabled={exportingFollowSale}
              className="flex-1 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </button>
            <button
              onClick={() => handleExportFollowSale('csv')}
              disabled={exportingFollowSale}
              className="flex-1 flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 mr-2" /> CSV
            </button>
          </div>
        </div>

        {/* Export All Data */}
        <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center text-center">
          <Download className="w-12 h-12 text-blue-500 mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">导出个人数据库全部内容</h2>
          <p className="text-sm text-gray-500 mb-6 flex-grow">
            包含您领取的判断任务（含结果）以及跟卖产品。
          </p>
          <div className="flex space-x-3 w-full">
            <button
              onClick={() => handleExportAll('xlsx')}
              disabled={exportingAll}
              className="flex-1 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </button>
            <button
              onClick={() => handleExportAll('csv')}
              disabled={exportingAll}
              className="flex-1 flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 mr-2" /> CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper icon component
const GiftIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 12 20 22 4 22 4 12"></polyline>
    <rect x="2" y="7" width="20" height="5"></rect>
    <line x1="12" y1="22" x2="12" y2="7"></line>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
  </svg>
);
