import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: { user } } = await supabase.auth.signInWithPassword({
    email: 'a0920238599@gmail.com',
    password: 'password123'
  });
  const { data, error } = await supabase.from('system_settings').select('*');
  console.log(data, error);
}
run();
