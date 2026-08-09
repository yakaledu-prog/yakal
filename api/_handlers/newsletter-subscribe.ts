import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from '../_utils/supabase.js';
import { sendEmail, appUrl } from '../_utils/email.js';

/**
 * Joining the list from the footer form.
 *
 * Public, so it is written defensively. It answers the same way whether the
 * address was new, already on the list, or previously unsubscribed, because
 * anything else turns this into a way to ask "is this person a subscriber"
 * one address at a time.
 *
 * The service client rather than the browser's: the table grants anon nothing,
 * which is the point of it.
 */

/** Deliberately loose. Rejecting valid addresses is worse than accepting junk. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEAL = '#1099A1';

/**
 * The thank you, sent once when somebody joins.
 *
 * It carries the unsubscribe link like every other newsletter mail does. The
 * first message is the most likely one to be regretted, and making them hunt
 * for a way out is how a list gets marked as spam instead.
 */
function welcomeEmail(unsubscribeUrl: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:${TEAL};padding:28px 24px;">
      <p style="margin:0;color:#ffffff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Yakal Education Services</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.25;">Thanks for subscribing</h1>
    </td></tr>

    <tr><td style="padding:28px 24px 0;">
      <p style="margin:0 0 18px;color:#333333;font-size:15px;line-height:1.65;">
        You are on the list. When we publish something new on tutoring, testing
        or college admissions, it will land here.
      </p>
      <p style="margin:0 0 22px;color:#333333;font-size:15px;line-height:1.65;">
        No fixed schedule and nothing else: we write when there is something
        worth reading.
      </p>
      <a href="${appUrl('/posts')}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 24px;">Read what is already there</a>
    </td></tr>

    <tr><td style="padding:30px 24px 32px;">
      <div style="border-top:1px solid #e9edef;padding-top:16px;">
        <p style="margin:0;color:#333333;font-size:14px;line-height:1.6;">Yakal Education Services</p>
        <p style="margin:4px 0 12px;color:#8696a0;font-size:13px;line-height:1.6;">Tutoring and college admissions</p>
        <p style="margin:0;color:#8696a0;font-size:12px;line-height:1.6;">
          Changed your mind? <a href="${unsubscribeUrl}" style="color:#8696a0;">Unsubscribe</a>.
        </p>
      </div>
    </td></tr>
  </table>
</body></html>`;
}

/** Sent after the row exists, and never allowed to fail the signup. */
async function welcome(token: string | undefined, to: string) {
  if (!token) return;
  const result = await sendEmail({
    to,
    subject: 'Thanks for subscribing to Yakal',
    html: welcomeEmail(appUrl(`/unsubscribe?token=${token}`)),
  });
  if (!result.sent) console.error('newsletter welcome not sent:', result.error);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  const email = String(body.email ?? '').trim().toLowerCase();
  const source = String(body.source ?? 'footer').slice(0, 40);

  if (!LOOKS_LIKE_EMAIL.test(email)) {
    return res.status(400).json({ error: 'That does not look like an email address.' });
  }

  const db = getServiceClient();

  try {
    const { data: existing } = await db
      .from('newsletter_subscribers')
      .select('id, status, unsubscribe_token')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      // Coming back after unsubscribing is a resubscribe, not an error, and
      // is worth a thank you. Someone already subscribed gets nothing: they
      // did not ask for a second copy by submitting the form twice.
      if (existing.status === 'unsubscribed') {
        await db
          .from('newsletter_subscribers')
          .update({ status: 'subscribed', unsubscribed_at: null })
          .eq('id', existing.id);
        await welcome(existing.unsubscribe_token, email);
      }
      return res.status(200).json({ ok: true });
    }

    const { data: created, error } = await db
      .from('newsletter_subscribers')
      .insert({ email, source })
      .select('unsubscribe_token')
      .single();

    // A duplicate here means two submissions raced. Both wanted the same
    // outcome, and it happened, so it is not worth reporting as a failure.
    if (error && error.code !== '23505') {
      console.error('newsletter subscribe failed:', error);
      return res.status(500).json({ error: 'Could not add you just now. Try again shortly.' });
    }

    // After the row, and awaited but never fatal: being on the list is the
    // thing that had to happen, and the greeting is the copy.
    await welcome(created?.unsubscribe_token, email);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('newsletter subscribe failed:', err);
    return res.status(500).json({ error: 'Could not add you just now. Try again shortly.' });
  }
}
