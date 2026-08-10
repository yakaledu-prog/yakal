import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser, appBaseUrl } from '../_utils/supabase.js';
import { sendEmail, layout } from '../_utils/email.js';
import { TEMPLATES } from '../../src/lib/notifications/templates/index.js';

/**
 * The email half of a notification.
 *
 * sendFromTemplate writes the in-app row from the browser and stops there,
 * because a browser cannot send email: the Resend key and the SMTP
 * credentials are server-side and must stay that way. So every notification
 * raised from the client appeared in the bell and never reached an inbox,
 * which looked like a broken mail server rather than a missing half.
 *
 * The same templates render both, imported rather than copied, so the email
 * and the notification cannot drift into saying different things.
 *
 * The recipient's address is looked up here from their id. It is never taken
 * from the request: an endpoint that emails whatever address it is handed is
 * an open relay with a login page in front of it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await requireUser(req);

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  const { userId, template, vars } = body as {
    userId?: string;
    template?: keyof typeof TEMPLATES;
    vars?: Record<string, unknown>;
  };

  if (!userId || !template) return res.status(400).json({ error: 'userId and template are required.' });

  const entry = TEMPLATES[template];
  if (!entry) return res.status(400).json({ error: `No template named ${String(template)}.` });

  const db = getServiceClient();
  const { data: person } = await db
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle();

  // Not an error worth failing on. The notification is the record; this is the
  // copy, and somebody without an address on file still got the record.
  if (!person?.email) return res.status(200).json({ sent: false, reason: 'no address on file' });

  try {
    const email = (entry.email as (v: unknown) => {
      subject: string;
      heading: string;
      intro: string;
      facts: { label: string; value: string }[];
      cta: { label: string; url: string } | null;
      footer: string | null;
    })(vars ?? {});

    const result = await sendEmail({
      to: person.email,
      subject: email.subject,
      html: layout({
        heading: email.heading,
        intro: email.intro,
        facts: email.facts,
        // Templates carry app-relative paths, since the notification uses the
        // same field to route inside the app. An inbox needs the whole URL.
        cta: email.cta
          ? { label: email.cta.label, url: `${appBaseUrl()}${email.cta.url}` }
          : undefined,
        footer: email.footer ?? undefined,
        recipientName: person.full_name?.split(' ')[0],
      }),
    });

    return res.status(200).json({ sent: result.sent, provider: result.provider, error: result.error });
  } catch (err: any) {
    console.error('notify-email failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
