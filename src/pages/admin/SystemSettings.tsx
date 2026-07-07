import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SystemSetting } from '../../types';

export const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Follow sale rules
  const [threshold, setThreshold] = useState(100);
  
  const [qtyPerBatch, setQtyPerBatch] = useState(100);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('setting_key', 'follow_sale_rules')
        .single();

      if (error) throw error;
      
      setSettings(data);
      if (data?.setting_value) {
        setThreshold(data.setting_value.daily_yes_threshold || 100);
        
        setQtyPerBatch(data.setting_value.quantity_per_batch || 100);
      }
    } catch (error: any) {
      console.error('获取设置失败', error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    
    const newValue = {
      daily_yes_threshold: threshold,
      quantity_per_batch: qtyPerBatch
    };

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ setting_value: newValue })
        .eq('setting_key', 'follow_sale_rules');
        
      if (error) throw error;
      alert('设置保存成功');
    } catch (error: any) {
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
      
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-medium text-gray-900 border-b pb-2">跟卖领取规则</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">最小领取门槛</label>
            <p className="text-sm text-gray-500 mb-1">用户可领取额度必须达到此数量才允许领取跟卖产品。</p>
            <input
              type="number"
              min="1"
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value) || 0)}
              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">每日最大领取额度</label>
            <p className="text-sm text-gray-500 mb-1">用户每天最多可以领取的跟卖产品总数。</p>
            <input
              type="number"
              min="1"
              value={qtyPerBatch}
              onChange={e => setQtyPerBatch(parseInt(e.target.value) || 0)}
              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};
