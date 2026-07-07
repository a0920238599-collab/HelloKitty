import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.rpc('exec_sql', { sql_string: 'SELECT policyname FROM pg_policies WHERE tablename = \'system_settings\'' });
  console.log(data);
}
run();
