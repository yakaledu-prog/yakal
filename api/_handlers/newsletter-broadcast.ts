import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireUser } from '../_utils/supabase.js';
import { sendEmail, appUrl } from '../_utils/email.js';

/**
 * Sending one blog post to the newsletter list.
 *
 * Triggered by an admin pressing a button, not by the post being created.
 * blog_posts.status defaults to 'published', so creating and publishing are
 * the same moment, and a post is saved several times while it is being
 * written. Sending on insert would mail the list a half-finished draft, and
 * email has no undo. A button is a decision; a trigger is an accident waiting
 * for a slow afternoon.
 *
 * newsletter_sent_at is the guard against the second click. It is set before
 * any mail goes out, so a double submission finds it already stamped and
 * stops, rather than both passes reading null and the list getting two copies.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TEAL = '#1099A1';

/** First couple of sentences, with any markup taken out. */
function excerpt(content: string, max = 220): string {
  const plain = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  // Break on a word, and only fall back to a hard cut if there is no space.
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

/**
 * The post as a card: image, title, excerpt, one button.
 *
 * Tables and inline styles throughout, because Outlook renders neither flexbox
 * nor a stylesheet. Widths are percentages so it reads on a phone without a
 * media query, which several clients also strip.
 */
function postEmail(opts: {
  title: string;
  body: string;
  imageUrl?: string | null;
  readTime?: number | null;
  url: string;
  unsubscribeUrl: string;
}): string {
  const img = opts.imageUrl
    ? `<tr><td style="padding:0 0 22px;">
         <a href="${opts.url}" style="display:block;">
           <img src="${escapeHtml(opts.imageUrl)}" width="100%" alt=""
                style="display:block;width:100%;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
         </a>
       </td></tr>`
    : '';

  const meta = opts.readTime
    ? `<p style="margin:0 0 10px;color:#8696a0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">New post &middot; ${opts.readTime} min read</p>`
    : `<p style="margin:0 0 10px;color:#8696a0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">New post</p>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:${TEAL};padding:28px 24px;">
      <p style="margin:0;color:#ffffff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Yakal Education Services</p>
    </td></tr>

    <tr><td style="padding:28px 24px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${img}
        <tr><td>
          ${meta}
          <h1 style="margin:0 0 12px;color:#111111;font-size:23px;font-weight:700;line-height:1.3;">
            <a href="${opts.url}" style="color:#111111;text-decoration:none;">${escapeHtml(opts.title)}</a>
          </h1>
          <p style="margin:0 0 22px;color:#333333;font-size:15px;line-height:1.65;">${escapeHtml(opts.body)}</p>
          <a href="${opts.url}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 24px;">Read the post</a>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:30px 24px 32px;">
      <div style="border-top:1px solid #e9edef;padding-top:16px;">
        <p style="margin:0;color:#333333;font-size:14px;line-height:1.6;">Yakal Education Services</p>
        <p style="margin:4px 0 12px;color:#8696a0;font-size:13px;line-height:1.6;">Tutoring and college admissions</p>
        <p style="margin:0;color:#8696a0;font-size:12px;line-height:1.6;">
          You are receiving this because you subscribed to the Yakal newsletter.
          <a href="${opts.unsubscribeUrl}" style="color:#8696a0;">Unsubscribe</a>.
        </p>
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req);
  const db = getServiceClient();

  const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  const postId = String(body.postId ?? '');
  if (!postId) return res.status(400).json({ error: 'Which post?' });

  try {
    const { data: post } = await db
      .from('blog_posts')
      .select('id, title, content, thumbnail_url, read_time_minutes, status, newsletter_sent_at')
      .eq('id', postId)
      .maybeSingle();

    if (!post) return res.status(404).json({ error: 'No such post.' });
    if (post.status !== 'published') {
      return res.status(400).json({ error: 'Publish the post before sending it.' });
    }
    if (post.newsletter_sent_at) {
      return res.status(409).json({ error: 'This post has already been sent.' });
    }

    const { data: subscribers } = await db
      .from('newsletter_subscribers')
      .select('email, unsubscribe_token')
      .eq('status', 'subscribed');

    if (!subscribers?.length) {
      return res.status(400).json({ error: 'Nobody is subscribed yet.' });
    }

    // Stamped before sending, so a second click loses the race rather than
    // mailing everyone twice. If sending then fails outright the stamp is
    // rolled back below.
    await db
      .from('blog_posts')
      .update({ newsletter_sent_at: new Date().toISOString() })
      .eq('id', postId);

    const url = appUrl(`/post/${post.id}`);
    const summary = excerpt(post.content ?? '');

    // One message each, not one with everybody in `to`. A shared recipient
    // list would show every subscriber their address, and the unsubscribe
    // link has to be theirs or it removes the wrong person.
    let sent = 0;
    const failures: string[] = [];

    for (const s of subscribers) {
      const result = await sendEmail({
        to: s.email,
        subject: post.title,
        html: postEmail({
          title: post.title,
          body: summary,
          imageUrl: post.thumbnail_url,
          readTime: post.read_time_minutes,
          url,
          unsubscribeUrl: appUrl(`/unsubscribe?token=${s.unsubscribe_token}`),
        }),
      });
      if (result.sent) sent += 1;
      else failures.push(s.email);
    }

    if (sent === 0) {
      await db.from('blog_posts').update({ newsletter_sent_at: null }).eq('id', postId);
      return res.status(502).json({ error: 'Nothing could be sent. Check the mail settings.' });
    }

    return res.status(200).json({ sent, failed: failures.length });
  } catch (err: any) {
    console.error('newsletter broadcast failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
