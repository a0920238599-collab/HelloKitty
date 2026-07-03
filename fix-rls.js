import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { error } = await supabase.rpc('exec_sql', { sql: `
    CREATE POLICY "Allow authenticated to view system settings" ON system_settings FOR SELECT TO authenticated USING (true);
  `});
  console.log('exec_sql result:', error);
}
run();
