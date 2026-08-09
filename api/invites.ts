import { requireUser, getUserClient } from './_utils/supabase.js';
import { sendEmail, layout, appUrl } from './_utils/email.js';

// ============================================================
// Sending a child invitation link by email.
//
// The invite row is created in the browser under the parent's own session, so
// row level security has already decided they may. This only turns an existing
// invite into an email, which is the one part that needs a secret (the mail
// provider) and so cannot happen in the browser.
//
// It reads the invite through the caller's client, not the service client, so
// the same policy that let them create it is the thing that lets them mail it.
// A parent can only send the link for an invite that is theirs.
// ============================================================

export default async function handler(req: any, res: any) {
  const action = req.query?.action;
  if (req.method !== 'POST' || action !== 'send') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const me = await requireUser(req);
    const { inviteId } = req.body ?? {};
    if (!inviteId) return res.status(400).json({ error: 'inviteId is required' });

    // The caller's client: RLS returns the invite only if it is theirs.
    const supabase = getUserClient(req);
    const { data: invite, error } = await supabase
      .from('parent_child_invites')
      .select('id, email, token, services, status')
      .eq('id', inviteId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!invite) return res.status(404).json({ error: 'Invitation not found' });
    if (invite.status !== 'pending') {
      return res.status(409).json({ error: 'This invitation is no longer active.' });
    }

    // The parent's name, for the greeting. Read as the caller too; a parent can
    // always read their own profile.
    let parentName = 'A parent';
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', me.id)
      .maybeSingle();
    if (prof?.full_name) parentName = prof.full_name;

    const link = appUrl(`/invite/${invite.token}`);

    const result = await sendEmail({
      to: invite.email,
      subject: `${parentName} invited you to Yakal Education Services`,
      html: layout({
        heading: 'You have been invited to Yakal',
        intro: `${parentName} has invited you to Yakal Education Services and to link your account to theirs. Follow the link below to get started. If you do not have an account yet, you will be able to create one.`,
        facts: [{ label: 'Invited by', value: parentName }],
        cta: { label: 'Accept invitation', url: link },
        footer:
          'If you were not expecting this, you can ignore this email. The link only works for this email address.',
      }),
    });

    // The invite exists whether or not the mail went out, so report the send
    // result rather than failing the request: the parent can copy the link.
    return res.status(200).json({ sent: result.sent, provider: result.provider, link });
  } catch (err: any) {
    const msg = err?.message || 'Internal server error';
    const status = /session|authorization|token/i.test(msg) ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}
