import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase.js';

/**
 * The roadmap assistant.
 *
 * What makes this worth having over sending somebody to ChatGPT is not the
 * model, it is the context. The prompt is built here, on the server, from what
 * the database already knows: the student's stage, intended major, graduation
 * year, the colleges on their list with their own deadlines, what they have
 * already ticked off, and where their financial aid forms stand. A general
 * chatbot has to ask for all of that and gets told half of it wrong.
 *
 * The context is read server-side with the service client rather than sent up
 * from the browser, so a student cannot ask about somebody else's list by
 * editing a request.
 */

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface Turn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Everything the assistant is allowed to know, gathered in one round trip.
 *
 * Column names are the ones the schema actually uses, which are not the ones
 * the UI shows: a college list row is school_name/tier/deadline, and a task is
 * done when status is 'done' rather than a boolean. Getting one wrong does not
 * throw here, it comes back as an empty array and the assistant quietly loses
 * the context that is its whole reason for existing.
 */
async function gatherContext(studentId: string) {
  const db = getServiceClient();

  const [profile, application, colleges, tasks] = await Promise.all([
    db.from('profiles').select('full_name, grade_level').eq('id', studentId).maybeSingle(),
    db
      .from('college_guide_applications')
      .select('stage, program_interest, grad_year, fafsa_submitted, css_submitted')
      .eq('student_id', studentId)
      .maybeSingle(),
    db
      .from('college_list_items')
      .select('school_name, tier, deadline, status')
      .eq('student_id', studentId),
    db
      .from('application_tasks')
      .select('title, status, due_date')
      .eq('student_id', studentId)
      .limit(40),
  ]);

  return {
    name: profile.data?.full_name ?? null,
    grade: profile.data?.grade_level ?? null,
    stage: application.data?.stage ?? null,
    major: application.data?.program_interest ?? null,
    gradYear: application.data?.grad_year ?? null,
    fafsa: application.data?.fafsa_submitted ?? false,
    css: application.data?.css_submitted ?? false,
    colleges: colleges.data ?? [],
    tasks: tasks.data ?? [],
  };
}

/**
 * The instructions, and the facts, as one block.
 *
 * Written to keep the assistant inside what it can actually see. A confident
 * wrong answer about a deadline is worse than "check the college's page",
 * because a family will act on it and only find out in April.
 */
function buildSystemPrompt(ctx: Awaited<ReturnType<typeof gatherContext>>): string {
  const colleges = ctx.colleges.length
    ? ctx.colleges
        .map(
          (c: { school_name: string; tier?: string; deadline?: string; status?: string }) =>
            `- ${c.school_name}${c.tier ? ` (${c.tier})` : ''}${
              c.deadline ? `, deadline ${c.deadline}` : ''
            }${c.status ? `, ${c.status}` : ''}`
        )
        .join('\n')
    : '- nothing on their list yet';

  const open = ctx.tasks.filter((t: { status: string }) => t.status !== 'done');
  const tasks = open.length
    ? open
        .map(
          (t: { title: string; due_date?: string }) =>
            `- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`
        )
        .join('\n')
    : '- nothing outstanding';

  return `You are the Yakal admissions assistant, helping a student and their family
through a US college application. You are inside the Yakal app, on the roadmap
page, so you are talking to somebody already partway through this.

WHO YOU ARE TALKING TO
Name: ${ctx.name ?? 'unknown'}
Grade: ${ctx.grade ?? 'unknown'}
Stage: ${ctx.stage ?? 'unknown'}
Intended major: ${ctx.major ?? 'not decided'}
Graduation year: ${ctx.gradYear ?? 'unknown'}
FAFSA submitted: ${ctx.fafsa ? 'yes' : 'no'}
CSS Profile submitted: ${ctx.css ? 'yes' : 'no'}

THEIR COLLEGE LIST
${colleges}

WHAT IS STILL OPEN
${tasks}

HOW TO ANSWER
- Use what is above. Do not ask them for something already listed here.
- Be specific to their stage and list. "Your deadline for Michigan is 1
  February" beats a general description of Regular Decision.
- Keep it short. Two or three sentences unless they ask for a walkthrough.
- A deadline you were not given: say to confirm on the college's own page. Do
  not guess a date. A family will act on it and find out in April.
- You are not their counselor. For their essays, their chances, or any decision
  that matters, point them at their Yakal counselor.
- No emoji, no em dashes.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: 'The assistant is not configured. Set GEMINI_API_KEY.',
    });
  }

  const user = await requireUser(req);

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  const history: Turn[] = Array.isArray(body.history) ? body.history.slice(-12) : [];
  const message: string = String(body.message ?? '').trim();
  // studentId is only honoured for a parent or counselor reading a child's
  // roadmap; a student always gets their own, whatever they send.
  const requested: string | undefined = body.studentId;

  if (!message) return res.status(400).json({ error: 'Nothing to answer.' });

  const db = getServiceClient();
  const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();

  let studentId = user.id;
  if (requested && requested !== user.id) {
    if (me?.role === 'admin' || me?.role === 'counselor') {
      studentId = requested;
    } else if (me?.role === 'parent') {
      const { data: link } = await db
        .from('parent_student_links')
        .select('student_id')
        .eq('parent_id', user.id)
        .eq('student_id', requested)
        .eq('status', 'active')
        .maybeSingle();
      if (!link) return res.status(403).json({ error: 'Not your student.' });
      studentId = requested;
    } else {
      return res.status(403).json({ error: 'Not your student.' });
    }
  }

  try {
    const ctx = await gatherContext(studentId);

    const response = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(ctx) }] },
        contents: [
          ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
          { role: 'user', parts: [{ text: message }] },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      console.error('gemini error:', data);
      return res.status(response.status).json({
        error: data?.error?.message ?? 'The assistant could not answer just now.',
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) return res.status(502).json({ error: 'The assistant returned nothing.' });

    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error('ai-roadmap failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
