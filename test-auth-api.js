import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: { session } } = await supabase.auth.signInWithPassword({
    email: 'a0920238599@gmail.com',
    password: 'password123'
  });
  
  const token = session.access_token;
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('http://localhost:3000/api/claim-status', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(data);
}
run();
