import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
async function run() {
  console.log("Fetching RPC get_user_judgment_stats...");
  const { data, error } = await supabaseAdmin.rpc('get_user_judgment_stats');
  console.log("Data:", data);
  console.log("Error object:", error);
}
run();
