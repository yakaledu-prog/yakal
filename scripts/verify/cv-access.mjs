import { createClient } from '@supabase/supabase-js';
const URL='http://127.0.0.1:54321';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const pass=(s,ok,d='')=>console.log(`${ok?'PASS':'FAIL'}  ${s}${d?'  -> '+d:''}`);

const svc = createClient(URL, SERVICE, {auth:{persistSession:false}});
const { data: applicant } = await svc.from('profiles').select('id, email, resume_url').not('resume_url','is',null).limit(1).maybeSingle();
pass('an applicant has a stored CV path', !!applicant?.resume_url, applicant?.resume_url);

async function signAs(email) {
  const c = createClient(URL, ANON, {auth:{persistSession:false}});
  const { error } = await c.auth.signInWithPassword({ email, password:'demo123' });
  if (error) return { err: error.message };
  const { data, error: sErr } = await c.storage.from('resumes').createSignedUrl(applicant.resume_url, 60);
  return { url: data?.signedUrl, err: sErr?.message };
}

const asAdmin = await signAs('admin@yakal.com');
pass('admin can sign a CV url', !!asAdmin.url, asAdmin.err ?? asAdmin.url?.split('?')[0].slice(-30));
if (asAdmin.url) {
  const r = await fetch(asAdmin.url);
  pass('signed url actually downloads the file', r.ok && (await r.text()).startsWith('%PDF'), `HTTP ${r.status}`);
}

const asStudent = await signAs('student@yakal.com');
pass('a student cannot read someone else\'s CV', !asStudent.url, asStudent.err ?? 'GOT A URL, policy is too open');

const anon = createClient(URL, ANON, {auth:{persistSession:false}});
const { data: anonData } = await anon.storage.from('resumes').createSignedUrl(applicant.resume_url, 60);
pass('signed out cannot read a CV', !anonData?.signedUrl);
