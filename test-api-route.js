import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  // Let's emulate what /api/claim-status does
  // 1. Get settings
  const { data: settingsData, error: err1 } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "follow_sale_rules")
    .single();
  console.log("Settings:", settingsData, err1);

  // 2. Count totalYes
  const { count: totalYes, error: err2 } = await supabaseAdmin
    .from("task_assignments")
    .select("id", { count: "exact" })
    //.eq("assigned_user_id", user.id) // skip for now
    .eq("judgment_result", "yes");
  console.log("Total Yes:", totalYes, err2);

  // 3. Count totalClaimed
  const { count: totalClaimed, error: err3 } = await supabaseAdmin
    .from("user_product_library")
    .select("id", { count: "exact" });
    //.eq("user_id", user.id);
  console.log("Total Claimed:", totalClaimed, err3);
}
run();
