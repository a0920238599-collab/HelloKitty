import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // 1. Create a dummy user
  const email = 'test_user_' + Date.now() + '@example.com';
  const password = 'password123';
  
  const { data: { user }, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createErr) {
    console.error("Create User Error:", createErr);
    return;
  }
  
  // 2. Sign in with the dummy user
  const { data: { session }, error: signinErr } = await supabaseAnon.auth.signInWithPassword({
    email,
    password
  });
  
  if (signinErr || !session) {
    console.error("Signin Error:", signinErr);
    return;
  }
  
  const token = session.access_token;
  
  // 3. Call the API
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('http://localhost:3000/api/claim-status', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const data = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", data);
  
  // 4. Delete the dummy user
  await supabaseAdmin.auth.admin.deleteUser(user.id);
}
run();
