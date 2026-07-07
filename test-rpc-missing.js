import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
async function run() {
  console.log("Fetching RPC...");
  const { data, error } = await supabaseAdmin.rpc('function_that_does_not_exist');
  console.log("Error object:", error);
}
run();
