import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  try {
    const { data, error } = await supabaseAdmin.rpc('does_not_exist');
    console.log("Error:", error);
  } catch (e) {
    console.log("Exception:", e);
  }
}
run();
