// config/supabaseClient.js
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // Throw rather than process.exit() — this module also loads inside a
  // serverless function, where exiting the process could take down other
  // concurrent invocations sharing the same warm container.
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not defined in environment variables');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabase;
