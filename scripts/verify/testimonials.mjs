// Testimonials: who may read, who may write.
//
// The landing page is read by people with no account, so the table has to be
// readable with the anon key. That is the same shape as blog_posts, which
// carries "Enable all access for anon USING (true)" and is therefore writable
// by anyone holding a key that ships in the browser bundle. This asserts the
// difference: anon reads published rows and nothing else, and cannot write at
// all.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const ANON =
  process.env.VITE_SUPABASE_LOCAL_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

async function main() {
  // A draft, to prove anon cannot see it. Service role bypasses RLS.
  const { data: draft, error: seedErr } = await admin
    .from('testimonials')
    .insert({ name: 'Draft Person', quote: 'Not for the public.', published: false })
    .select('id')
    .single();
  if (seedErr) {
    console.error('could not seed a draft:', seedErr.message);
    process.exit(1);
  }

  try {
    const { data: pub } = await anon.from('testimonials').select('name, published');

    // Against what the database actually holds, not a number written here.
    // Hiding a testimonial from the admin screen is a normal thing to do, and
    // it used to fail this check, which teaches people to ignore it.
    const { count: publishedCount } = await admin
      .from('testimonials')
      .select('id', { count: 'exact', head: true })
      .eq('published', true);
    check(
      'anon reads exactly the published testimonials',
      (pub ?? []).length === publishedCount,
      `anon ${(pub ?? []).length}, published ${publishedCount}`
    );
    check(
      'anon cannot see a draft',
      !(pub ?? []).some((t) => t.name === 'Draft Person')
    );
    check(
      'every row anon sees is published',
      (pub ?? []).every((t) => t.published)
    );

    const { error: insErr } = await anon
      .from('testimonials')
      .insert({ name: 'hacker', quote: 'pwned', published: true });
    check('anon cannot insert', !!insErr, insErr?.code);

    const { error: updErr, count: updCount } = await anon
      .from('testimonials')
      .update({ quote: 'defaced' }, { count: 'exact' })
      .eq('name', 'David Warner');
    // A refused update can surface as an error or as zero rows touched. Both
    // are a pass; a silent success that changed a row is not.
    check('anon cannot update', !!updErr || updCount === 0, updErr?.code ?? `count=${updCount}`);

    const { error: delErr, count: delCount } = await anon
      .from('testimonials')
      .delete({ count: 'exact' })
      .eq('name', 'David Warner');
    check('anon cannot delete', !!delErr || delCount === 0, delErr?.code ?? `count=${delCount}`);

    const { data: still } = await admin.from('testimonials').select('id').eq('name', 'David Warner');
    check('the row anon attacked is intact', (still ?? []).length === 1);
  } finally {
    await admin.from('testimonials').delete().eq('id', draft.id);
  }

  console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
