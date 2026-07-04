import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: { session } } = await supabase.auth.signInWithPassword({
    email: 'a0920238599@gmail.com', // wait this user doesn't have password here
    password: 'password123'
  });
  
  // Can't test this way.
}
run();
