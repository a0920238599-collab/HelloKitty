import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const email = 'test_user_' + Date.now() + '@example.com';
  const password = 'password123';
  const { data: { user } } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  const { data: { session } } = await supabaseAnon.auth.signInWithPassword({ email, password });
  
  const token = session.access_token;
  const fetch = (await import('node-fetch')).default;
  
  // Try claiming products
  const res = await fetch('http://localhost:3000/api/claim-products', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ quantity: 1 })
  });
  
  const data = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", data);
  
  await supabaseAdmin.auth.admin.deleteUser(user.id);
}
run();
