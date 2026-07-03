import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  let { data, error } = await supabase.from('products').select(`*, judged_profile:profiles!products_judged_by_fkey(username)`).eq('judgment_status', 'no').limit(1);
  console.log("With eq no:", error?.message || 'success');
}
run();
