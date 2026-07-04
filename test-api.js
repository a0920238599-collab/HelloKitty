import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    const { data: settingsData, error } = await supabaseAdmin
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "follow_sale_rules")
      .single();
    console.log(settingsData, error);
  } catch (e) {
    console.error(e);
  }
}
run();
