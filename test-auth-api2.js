import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: { session } } = await supabase.auth.signInWithPassword({
    email: 'test@example.com', // wait, I don't know any user password
    password: 'password123'
  });
  console.log(session);
}
run();
