// Student asks, parent grants from the inbox, student's page opens.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
const BASE=process.env.BASE||'http://localhost:5173';
const S='/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const SERVICE='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const db=createClient('http://127.0.0.1:54321',SERVICE,{auth:{persistSession:false}});
const pass=(s,ok,d='')=>console.log(`${ok?'PASS':'FAIL'}  ${s}${d?'  -> '+d:''}`);

const {data:st}=await db.from('profiles').select('id').eq('email','student@yakal.com').single();
const {data:pa}=await db.from('profiles').select('id').eq('email','parent@yakal.com').single();
await db.from('child_services').upsert({student_id:st.id,service:'admissions',is_active:false},{onConflict:'student_id,service'});
await db.from('notifications').delete().eq('user_id',pa.id);

const b=await chromium.launch();
const login=async(page,email)=>{await page.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill('demo123');
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(u=>!u.pathname.includes('/login'),{timeout:20000});};

const sp=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await login(sp,'student@yakal.com');
await sp.goto(`${BASE}/student/explore`,{waitUntil:'domcontentloaded'});
await sp.waitForTimeout(3500);
await sp.getByRole('button',{name:/request access/i}).first().click();
await sp.waitForTimeout(3000);
pass('student stays locked after asking', await sp.getByText(/not part of your current plan/i).isVisible().catch(()=>false));

const pp=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const perrs=[]; pp.on('pageerror',e=>perrs.push(e.message));
await login(pp,'parent@yakal.com');
await pp.goto(`${BASE}/parent/notifications`,{waitUntil:'domcontentloaded'});
await pp.waitForTimeout(4000);
pass('parent sees the real request', await pp.getByText(/feature unlock request/i).first().isVisible().catch(()=>false));
await pp.getByText(/feature unlock request/i).first().click();
await pp.waitForTimeout(1500);
pass('subject sits on the action row', await pp.locator('h2', {hasText:/feature unlock request/i}).isVisible().catch(()=>false));
await pp.screenshot({path:`${S}/parent-notifications.png`});
await pp.getByRole('button',{name:/^unlock$/i}).click();
await pp.waitForTimeout(3500);
const {data:svc}=await db.from('child_services').select('is_active').eq('student_id',st.id).eq('service','admissions').maybeSingle();
pass('granting writes child_services', svc?.is_active===true);
const {data:sn}=await db.from('notifications').select('title').eq('user_id',st.id).order('created_at',{ascending:false}).limit(1);
pass('student is told', /granted/i.test(sn?.[0]?.title??''), sn?.[0]?.title);

await sp.reload({waitUntil:'domcontentloaded'});
await sp.waitForTimeout(4500);
pass('student page is now open', !(await sp.getByText(/not part of your current plan/i).isVisible().catch(()=>false)));
pass('no parent page errors', perrs.length===0, perrs[0]?.slice(0,110)??'');
await b.close();
