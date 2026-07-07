import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { count } = await supabase.from('task_assignments').select('*', { count: 'exact', head: true });
  console.log("Total tasks:", count);
}
run();
