import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// We need the postgres connection string, but we only have VITE_SUPABASE_URL and anon key.
// The user has a supabase database, but we don't have the DATABASE_URL.
