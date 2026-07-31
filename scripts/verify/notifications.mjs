import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
const BASE=process.env.BASE||'http://localhost:5173';
const S='/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const SERVICE='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const db=createClient('http://127.0.0.1:54321',SERVICE,{auth:{persistSession:false}});
const pass=(s,ok,d='')=>console.log(`${ok?'PASS':'FAIL'}  ${s}${d?'  -> '+d:''}`);

const roles=[['student','student@yakal.com','/student/notifications'],
             ['tutor','tutor@yakal.com','/tutor/notifications'],
             ['counselor','counselor@yakal.com','/counselor/notifications'],
             ['parent','parent@yakal.com','/parent/notifications']];

// give each a real notification
for (const [role,email] of roles) {
  const {data:u}=await db.from('profiles').select('id').eq('email',email).single();
  await db.from('notifications').delete().eq('user_id',u.id);
  await db.from('notifications').insert({user_id:u.id,type:'system',title:`Real ${role} notice`,message:`Written to the database for ${role}.`});
}

const b=await chromium.launch();
let fails=0;
for (const [role,email,path] of roles) {
  const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
  await p.locator('input[type="email"]').first().fill(email);
  await p.locator('input[type="password"]').first().fill('demo123');
  await p.locator('form button[type="submit"]').first().click();
  await p.waitForURL(u=>!u.pathname.includes('/login'),{timeout:20000});
  await p.goto(`${BASE}${path}`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(3500);

  const real = await p.getByText(`Real ${role} notice`).first().isVisible().catch(()=>false);
  // the old hardcoded rows all mentioned these
  const mockGone = !(await p.getByText(/Brooklyn|Session Reminder|New Assignment Posted/i).first().isVisible().catch(()=>false));
  pass(`${role}: shows the real notification`, real); if(!real) fails++;
  pass(`${role}: no mock rows left`, mockGone); if(!mockGone) fails++;

  // read + archive round trip
  await p.getByText(`Real ${role} notice`).first().click();
  await p.waitForTimeout(1200);
  await p.getByTitle('Archive').click();
  await p.waitForTimeout(2000);
  const {data:row}=await db.from('notifications').select('archived,is_read').eq('title',`Real ${role} notice`).maybeSingle();
  pass(`${role}: read and archive persist`, row?.archived===true && row?.is_read===true, `archived=${row?.archived} read=${row?.is_read}`);
  if(!(row?.archived&&row?.is_read)) fails++;
  pass(`${role}: no page errors`, errs.length===0, errs[0]?.slice(0,90)??''); if(errs.length) fails++;
  if (role==='student') await p.screenshot({path:`${S}/notifications-student.png`});
  await p.context().close();
}
await b.close();
console.log(fails? `\n${fails} failed` : '\nall passed');
process.exit(fails?1:0);
