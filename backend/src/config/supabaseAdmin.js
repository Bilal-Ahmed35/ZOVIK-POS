require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabaseAdmin = null;

if (supabaseUrl && supabaseServiceKey && !supabaseServiceKey.includes('PASTE_YOUR')) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log('✅ Supabase Admin client initialized (service role)');
} else {
  console.warn('⚠️  SUPABASE_SERVICE_KEY not set — Supabase Auth sync disabled. Add it to .env to enable full user management.');
}

module.exports = supabaseAdmin;
