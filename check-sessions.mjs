import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('sessions').select('*').order('created_at', { ascending: false }).limit(3);
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
