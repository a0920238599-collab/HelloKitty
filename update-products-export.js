const fs = require('fs');
const file = 'src/pages/admin/ProductsManager.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCode = `      let query = supabase
        .from('products')
        .select(\`
          erp_sku,
          erp_image_url,
          ozon_sku,
          ozon_image_url,
          usd_price,
          judgment_status,
          created_at,
          judged_at,
          judged_profile:profiles!products_judged_by_fkey(username)
        \`)
        .order('updated_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('judgment_status', activeTab);
      }
      
      if (searchTerm) {
        query = query.or(\`erp_sku.ilike.%\\${searchTerm}%,ozon_sku.ilike.%\\${searchTerm}%\`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const formattedData = (data || []).map(item => ({`;

const newCode = `      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('products')
          .select(\`
            erp_sku,
            erp_image_url,
            ozon_sku,
            ozon_image_url,
            usd_price,
            judgment_status,
            created_at,
            judged_at,
            judged_profile:profiles!products_judged_by_fkey(username)
          \`)
          .order('updated_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (activeTab !== 'all') {
          query = query.eq('judgment_status', activeTab);
        }
        
        if (searchTerm) {
          query = query.or(\`erp_sku.ilike.%\\${searchTerm}%,ozon_sku.ilike.%\\${searchTerm}%\`);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      
      const formattedData = allData.map(item => ({`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(file, content);
console.log('updated products manager export');
