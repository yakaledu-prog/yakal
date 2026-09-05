import { sendEmail, layout } from './email.js';
import { emailBaseUrl } from './supabase.js';
import { TEMPLATES } from '../../src/lib/notifications/templates/index.js';
import { pushToUser } from './push.js';

// ============================================================
// Notifying somebody from the server.
//
// The browser has sendFromTemplate in src/services/notificationService.ts,
// which writes the row under RLS and then asks /api/notify?action=email for
// the email half, because a browser has no mail credentials and must not.
//
// Server-side code has both, so it does not need the round trip. What it did
// instead was insert rows by hand: fulfil.ts wrote five of them across two
// statements, each with a title and a line and nothing else. A row with no
// template and no vars is one the inbox can only render as its stored line
// and a bare "Open" button, and no email went out for any of them, so a
// family who had just paid was told less than one who asked to be linked.
//
// The same templates as everywhere else, so a wording change reaches all
// four: the row, the email, the panel the row opens, and the push.
// ============================================================

type TemplateKey = keyof typeof TEMPLATES;

/** Minimal shape of the service client, so this need not import its type. */
type Db = {
  from: (table: string) => any;
};

/**
 * One notification: the row, and the email that copies it.
 *
 * Never throws. Telling somebody about a thing that already happened must not
 * be able to undo it, and fulfilment is the caller that matters here: a paid
 * invoice is not going to be rolled back because a mail server had a bad
 * minute. Failures are logged and swallowed, which is what the hand-written
 * inserts did too.
 */
export async function notify<K extends TemplateKey>(
  db: Db,
  userId: string,
  key: K,
  vars: Record<string, unknown>
): Promise<void> {
  const entry = TEMPLATES[key] as {
    type: string;
    notification: (v: unknown) => { title: string; message: string; link: string | null };
    email: (v: unknown) => {
      subject: string;
      heading: string;
      intro: string;
      facts: { label: string; value: string }[];
      cta: { label: string; url: string } | null;
      footer: string | null;
    };
  };

  let rendered: { title: string; message: string; link: string | null };
  try {
    const n = entry.notification(vars);
    rendered = n;
    // The title and line are stored so a row still reads if the template is
    // ever renamed; everything else is rendered fresh from vars each time.
    const { error } = await db.from('notifications').insert({
      user_id: userId,
      type: entry.type,
      title: n.title,
      message: n.message,
      link: n.link,
      template: key,
      vars,
    });
    if (error) {
      console.error(`notify: writing ${String(key)} for ${userId} failed:`, error.message);
      return;
    }
  } catch (err: any) {
    console.error(`notify: rendering ${String(key)} failed:`, err?.message);
    return;
  }

  // The push, which is the only one of the three that arrives while somebody
  // is doing something else. It carries the notification's own title and line
  // rather than rendering its own, so a service worker never becomes a third
  // place that knows how to word this.
  //
  // Fired without waiting: a push service taking two seconds must not hold up
  // fulfilment, and pushToUser swallows everything anyway.
  void pushToUser(db, userId, {
    title: rendered.title,
    body: rendered.message,
    url: rendered.link,
    // Collapses repeats about one event: a lesson moved twice should replace
    // its own notification rather than stack a second one behind it.
    tag: `${String(key)}:${userId}`,
  });

  // Deliberately after the row and deliberately swallowed. The notification is
  // the record and it is already written.
  try {
    const { data: person } = await db
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle();
    if (!person?.email) return;

    const email = entry.email(vars);
    await sendEmail({
      to: person.email,
      subject: email.subject,
      html: layout({
        heading: email.heading,
        intro: email.intro,
        facts: email.facts,
        // Templates carry app-relative paths, since the notification uses the
        // same field to route inside the app. An inbox needs the whole URL.
        cta: email.cta
          ? { label: email.cta.label, url: `${emailBaseUrl()}${email.cta.url}` }
          : undefined,
        footer: email.footer ?? undefined,
        recipientName: person.full_name?.split(' ')[0],
      }),
    });
  } catch (err: any) {
    console.error(`notify: emailing ${String(key)} to ${userId} failed:`, err?.message);
  }
}

/** Several at once, none of which can take another down. */
export async function notifyAll(
  db: Db,
  entries: { userId: string; key: TemplateKey; vars: Record<string, unknown> }[]
): Promise<void> {
  await Promise.all(entries.map((e) => notify(db, e.userId, e.key, e.vars)));
}
