import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
const BASE=process.env.BASE||'http://localhost:5173';
const S='/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const SERVICE='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const db=createClient('http://127.0.0.1:54321',SERVICE,{auth:{persistSession:false}});
const pass=(s,ok,d='')=>console.log(`${ok?'PASS':'FAIL'}  ${s}${d?'  -> '+d:''}`);
const {data:st}=await db.from('profiles').select('id').eq('email','student@yakal.com').single();
const set=async(svc,on)=>db.from('child_services').upsert({student_id:st.id,service:svc,is_active:on},{onConflict:'student_id,service'});

const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
await p.locator('input[type="email"]').first().fill('student@yakal.com');
await p.locator('input[type="password"]').first().fill('demo123');
await p.locator('form button[type="submit"]').first().click();
await p.waitForURL(u=>!u.pathname.includes('/login'),{timeout:20000});

const locked=async(path)=>{await p.goto(`${BASE}${path}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(3000);
  return p.getByText(/not part of your current plan/i).isVisible().catch(()=>false);};

// admissions only: tutoring areas locked, college open
await set('admissions',true); await set('tutoring',false);
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
pass('admissions-only: My Learning locked', await locked('/student/my-learning'));
pass('admissions-only: Sessions locked', await locked('/student/sessions'));
pass('admissions-only: Explore open', !(await locked('/student/explore')));
pass('admissions-only: Calendar open (common tab)', !(await locked('/student/calendar')));
pass('admissions-only: Messages open (common tab)', !(await locked('/student/messages')));
await p.screenshot({path:`${S}/lock-tutoring.png`});

// tutoring only: reverse
await set('admissions',false); await set('tutoring',true);
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
pass('tutoring-only: My Learning open', !(await locked('/student/my-learning')));
pass('tutoring-only: Explore locked', await locked('/student/explore'));
pass('tutoring-only: Notifications open (common tab)', !(await locked('/student/notifications')));

// both on
await set('admissions',true); await set('tutoring',true);
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
pass('both services: nothing locked', !(await locked('/student/my-learning')) && !(await locked('/student/explore')));
await b.close();
