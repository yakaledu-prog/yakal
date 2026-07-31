import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
const BASE=process.env.BASE||'http://localhost:5173';
const S='/tmp/claude-1000/-home-binyam-products-yakal/470a1a43-cc42-4652-988d-ac4539a37912/scratchpad/shots';
const SERVICE='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const db=createClient('http://127.0.0.1:54321',SERVICE,{auth:{persistSession:false}});
const pass=(s,ok,d='')=>console.log(`${ok?'PASS':'FAIL'}  ${s}${d?'  -> '+d:''}`);

const TMP='second.child@yakal.test';
await db.auth.admin.listUsers({page:1,perPage:200}).then(async ({data})=>{
  const ex=data.users.find(u=>u.email===TMP); if(ex) await db.auth.admin.deleteUser(ex.id);
});
await db.auth.admin.createUser({email:TMP,password:'demo123',email_confirm:true,user_metadata:{full_name:'Second Child',role:'student'}});

const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:950}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
await p.locator('input[type="email"]').first().fill('parent@yakal.com');
await p.locator('input[type="password"]').first().fill('demo123');
await p.locator('form button[type="submit"]').first().click();
await p.waitForURL(u=>!u.pathname.includes('/login'),{timeout:20000});
await p.goto(`${BASE}/parent/children`,{waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);

pass('real linked child shown', await p.getByText('Amen Worku').first().isVisible().catch(()=>false));
pass('no mock child', !(await p.getByText('Brooklyn Student').first().isVisible().catch(()=>false)));
await p.screenshot({path:`${S}/parent-children.png`});

await p.getByRole('button',{name:/add child/i}).click();
await p.waitForTimeout(1200);
pass('modal opens', await p.getByText('Manage children').isVisible().catch(()=>false));
pass('email + service + Add present',
  await p.getByPlaceholder("Child's email address").isVisible().catch(()=>false) &&
  await p.getByRole('button',{name:'Add',exact:true}).isVisible().catch(()=>false));
pass('linked child listed with service toggles',
  await p.getByRole('button',{name:'Tutoring'}).first().isVisible().catch(()=>false));
await p.screenshot({path:`${S}/parent-children-modal.png`});

// add a child by email -> pending request
await p.getByPlaceholder("Child's email address").fill(TMP);
await p.getByRole('button',{name:'Add',exact:true}).click();
await p.waitForTimeout(3000);
const {data:st2}=await db.from('profiles').select('id').eq('email',TMP).maybeSingle();
const {data:links}=await db.from('parent_student_links').select('status').eq('student_id',st2.id);
pass('creates a pending link request', links?.[0]?.status==='pending', links?.[0]?.status);
pass('shows waiting state', await p.getByText(/waiting to accept/i).isVisible().catch(()=>false));
pass('no page errors', errs.length===0, errs[0]?.slice(0,110)??'');
await b.close();
