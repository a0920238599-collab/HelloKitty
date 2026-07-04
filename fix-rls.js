import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { error } = await supabaseAdmin.rpc('exec_sql', {
    sql_string: `
      DROP POLICY IF EXISTS "Allow authenticated users to read system settings" ON system_settings;
      CREATE POLICY "Allow authenticated users to read system settings" 
        ON system_settings FOR SELECT 
        TO authenticated 
        USING (true);
    `
  });
  console.log("exec_sql result:", error);
  
  if (error && error.code === 'PGRST202') {
    // If exec_sql doesn't exist, we can't easily run SQL without pg library.
    // Let's try with pg library
    console.log("exec_sql failed, will use pg library if available");
  }
}
run();
