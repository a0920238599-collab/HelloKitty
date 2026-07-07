import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
async function run() {
  console.log("Running RPC...");
  const { data, error } = await supabaseAdmin.rpc('get_user_judgment_stats');
  console.log("Error:", error);
  console.log("Data size:", data ? data.length : 0);
  console.log("Data sample:", data ? data.slice(0, 2) : null);
}
run();
