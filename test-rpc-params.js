import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  // Test with p_limit
  const { error: err1 } = await supabaseAdmin.rpc("claim_follow_sale_products", {
    p_user_id: '2f1c232a-fbda-41a0-aeb7-6fa13304e3a8', // fake uuid
    p_limit: 1
  });
  console.log("With p_limit:", err1?.message || "Success or other error");

  // Test with p_quantity
  const { error: err2 } = await supabaseAdmin.rpc("claim_follow_sale_products", {
    p_user_id: '2f1c232a-fbda-41a0-aeb7-6fa13304e3a8',
    p_quantity: 1
  });
  console.log("With p_quantity:", err2?.message || "Success or other error");
}
run();
