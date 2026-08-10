# Email and notification templates

How a notification becomes an in-app row and an email, where to change the
wording, and where to change the look. The two are separate on purpose: the
words live per template, the design lives in one place.

---

## The two layers

**1. Content: `src/lib/notifications/templates/*.ts`**

Grouped by area: `learning`, `people`, `teaching`, `admissions`, `safety`, all
re-exported from `templates/index.ts`. A template is data, not markup:

```ts
export const sessionMoved: NotificationTemplate<{ subject: string; to: string }> = {
  type: "session_moved",              // must exist in the DB check constraint
  label: "Session moved",             // admin and seed output only
  notification: (v) => ({             // the in-app row
    title: "Session moved",
    message: `${v.subject} is now ${v.to}`,
    link: "/student/sessions",
  }),
  email: (v) => ({                    // the email
    subject: `${v.subject} moved to ${v.to}`,
    heading: "A session has been moved",
    intro: "...",                     // carries its own context; read away from the app
    facts: [{ label: "Now", value: v.to }],
    cta: { label: "Open the session", url: "/student/sessions" },
    footer: null,
  }),
  sample: { subject: "Mathematics", to: "Thursday 4pm" },  // renders without the real event
};
```

**2. Presentation: `layout()` in `api/_utils/email.ts`**

One function, around seventy lines, turning those fields into HTML. Teal header
bar, greeting, intro paragraph, facts table, CTA button, sign-off, footer.

**Every template inherits it.** To rebrand the email, change `layout()` and
nothing else. There is no per-template markup to hunt through.

---

## Rebranding: what to change

All of it in `layout()`:

- A logo. The header is a teal `<td>` with the company name as text; an
  `<img>` with an absolute URL replaces it.
- Typography, spacing, colour.
- A richer footer: address, social links, an unsubscribe line.
- A preheader, the grey line a client shows beside the subject.

Two rules to keep, whoever does the work:

- **Tables and inline styles.** Gmail strips `<style>` blocks and ignores
  flexbox and grid. The current file is already table-based; do not modernise
  it into `<div>`s.
- **`escapeHtml()` stays on every interpolated value.** Without it a student
  named `<script>` breaks the email, and worse.

Absolute URLs only for images. A `src` pointing at a relative path resolves
against the mail client, not the site.

---

## Making an email say more

Short emails are a content problem, not a layout one. Two levers, both per
template:

- **`intro`**: the opening paragraph. Deliberately longer than the in-app
  message, because an inbox is read once and away from the app, so it has to
  carry its own context.
- **`facts`**: the labelled rows under it. Empty values are dropped by the
  layout, so an optional fact can be passed as `""` and simply will not draw.

Adding a field means adding it to the template's `vars` type and passing it at
the call site. Two things to know:

- `vars` are stored on the notification row and re-rendered on demand, so rows
  written before a new field exists will render it blank. Nothing breaks.
- The same template feeds the in-app detail view through `renderDetail`, so
  richer facts improve both at once.

---

## How one gets sent

```
sendFromTemplate(userId, "sessionMoved", vars)
  |
  |-- writes the notifications row          (in-app, the record)
  |-- POST /api/notify?action=email         (the copy)
        |-- renders the same template
        |-- looks the address up from userId
        |-- sendEmail -> Mailpit locally, Resend in production
```

The email half has to run on the server: the Resend key and the SMTP
credentials are not in the browser and must not be. Client code that writes
straight to the `notifications` table gets the in-app row and no email; that is
the difference between the two, and it is what
`docs/NOTIFICATION_GAPS.md` tracks.

Failures are logged, never thrown. The notification is the record and it is
already written, so a mail server having a bad minute must not turn a
successful action into a failed one. The cost is that a missing email is quiet.

---

## Gotchas

- **`notifications.type` is a database check constraint.** A type outside the
  list fails the insert, and the send path reports rather than throws, so the
  notification silently never appears. Any new type needs a migration widening
  `notifications_type_check`. See
  `supabase/migrations/20260810000100_notification_session_moved.sql`.
- **CTA urls are app-relative** in the template, because the in-app link uses
  the same field. `appBaseUrl()` makes them absolute for the inbox.
- **`EMAIL_FROM` must be set on the host.** Unset, `api/_utils/email.ts` falls
  back to `onboarding@resend.dev`, Resend's sandbox sender, which only delivers
  to the Resend account owner. Format:
  `Yakal Education Services <noreply@yakal.me>`.
- **Local mail never leaves the machine.** `provider()` picks Resend only when
  the environment says production *and* a key is present, so a production key
  in a local `.env` still sends to Mailpit at `http://127.0.0.1:54324`.

---

## Previewing without triggering the event

Every template carries a `sample`. `renderSample(key)` in
`src/lib/notifications/index.ts` renders one from it, which is how the admin
notification preview works and how a redesign can be checked against all
sixteen without booking anything.
