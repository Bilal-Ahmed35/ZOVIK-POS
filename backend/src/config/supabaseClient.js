require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('PASTE_YOUR')) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase Client initialized');
} else {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_ANON_KEY not set — local storage fallback enabled.');
}

module.exports = supabase;
