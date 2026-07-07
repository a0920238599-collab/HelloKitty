import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://this-does-not-exist.supabase.co', 'dummy-key');
async function run() {
  try {
    console.log("Fetching...");
    const { data, error } = await supabase.auth.getUser('dummy-token');
    console.log("Error object:", error);
  } catch (e) {
    console.log("THROWN EXCEPTION:", e.message);
  }
}
run();
