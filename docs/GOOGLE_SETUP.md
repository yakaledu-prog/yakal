# Google setup: Drive and Classroom

Wiring one Google account as the operations account, so the server can read
Classroom and write Drive files without anybody signing into Google.

Currently that account is **binyam2537@gmail.com**. `yakaledu@gmail.com` is
meant to take it over later; when it does, the only change is re-running step 4
signed in as that account and replacing one line in `.env`.

APIs assumed already enabled: **Google Classroom API** and **Google Drive API**.

---

## 1. OAuth client

Cloud Console, **APIs and Services > Credentials > Create credentials > OAuth
client ID**.

- Application type: **Web application**
- Authorised redirect URI: `http://localhost:5599/callback`

That URI is only used by the one-time script that mints the token. Nothing in
the running app redirects through it, so it does not need a production entry.

Keep the client ID and secret for step 3.

## 2. Consent screen

**APIs and Services > OAuth consent screen.**

- User type: External
- Add **binyam2537@gmail.com** as a test user
- Add the scopes in the appendix below

Then **publish to Production**.

This matters more than it looks. While the app sits in Testing, Google expires
every refresh token after **seven days**, so the integration works for a week
and then dies with `invalid_grant` for no visible reason. Publishing stops that.

Some Classroom scopes are sensitive, so publishing may prompt for verification.
An unverified published app still works for the accounts you own; verification
only becomes necessary when strangers sign in, which in this design they never
do.

## 3. Environment

In `.env`:

```
VITE_GCP_CLIENT_ID=your-client-id.apps.googleusercontent.com
GCP_CLIENT_SECRET=your-client-secret
```

`VITE_GCP_CLIENT_ID` is deliberately public. The secret must never take a
`VITE_` prefix, or Vite inlines it into the browser bundle at build time.

## 4. Mint the refresh token

```
node scripts/google-oauth-setup.mjs
```

It opens a consent URL and waits on `localhost:5599`. **Sign in as
binyam2537@gmail.com**, the account that owns the classes. Signing in as anyone
else produces a token that cannot see them.

Add the token it prints:

```
GOOGLE_OAUTH_REFRESH_TOKEN=1//0...
```

A refresh token carries whatever was consented at the moment it was minted.
Adding a scope to the script later does nothing to a token already issued, so
**any scope change means running this again**.

If port 5599 is taken: `node scripts/google-oauth-setup.mjs --port 5173`, and
register that URI too.

## 5. Check Drive

```
node scripts/verify-drive.mjs
```

Creates a probe file, reads it back, deletes the file it just created, and
reports what worked. It cannot touch anything that existed beforehand: the only
delete is of the id the create call returned one line earlier.

## 6. Check Classroom

Classroom permissions are per course membership, so the operations account has
to be a **teacher** on any class the server reads. A class it merely owns in
Drive terms is not enough.

1. Create or pick a class while signed in as the operations account.
2. Copy its URL, which looks like `https://classroom.google.com/c/ODE5OTE...`.
3. Put it on a course. There is no admin field for this yet, so either edit
   `classroomUrl` in `scripts/seed/data.ts` and run `npm run db:seed`, or edit
   `courses.google_classroom_url` in Supabase Studio on port 54323.
4. Sign in to Yakal as someone entitled to that course and open it.

The `K-12 Mathematics` course is already wired to the `testroom` class for
exactly this.

## 7. Production

Set the same three variables in the hosting environment. The refresh token is
per account, not per environment, so the one minted locally is the one
production uses.

---

## Appendix: scopes, and why each

Set on the consent screen and in `SCOPES` in `scripts/google-oauth-setup.mjs`.
The two must agree.

| Scope | Why |
| --- | --- |
| `drive.file` | Files this app created, and nothing else. Non-sensitive, so it does not drag the whole consent screen into verification. |
| `classroom.courses` | Read the class itself. |
| `classroom.coursework.students` | Read the work set on a class. |
| `classroom.rosters.readonly` | Turn a submission's user id into a name. |
| `classroom.student-submissions.students.readonly` | Who turned what in, and the grade. |
| `classroom.topics.readonly` | The class's own grouping of work into units. |

`classroom.topics.readonly` is separate from `classroom.courses` and easy to
miss. Without it `courses.topics.list` answers "Request had insufficient
authentication scopes", the read-through treats that as a class that groups
nothing, and the work still lists, flat. Nothing errors, grouping just never
appears.

Step 5 of the Classroom plan, adding co-teachers and inviting students, needs
`classroom.rosters` rather than the readonly form. That is another re-mint when
it arrives.

## Appendix: things that will waste an afternoon

**A Gmail alias is not a Google account.** `binyam2537+student@gmail.com`
resolves back to `binyam2537@gmail.com`, so it cannot be a separate member of a
class. Aliases are fine for testing our own email and useless for a roster.

**A student's Yakal profile email has to equal their Google account email.**
The read-through resolves a learner's Classroom identity by handing that exact
address to `courses.students.get`. A mismatch makes them unplaceable: excluded
from individually assigned work, with no submissions of their own to read.

**A class URL from the wrong account fails as "not found".** Google answers the
same way whether a class does not exist or is simply invisible to this token,
so the message reads like a broken integration when it is a stale link.

**Two `GOOGLE_OAUTH_REFRESH_TOKEN` lines in `.env`** is worth avoiding.
Different loaders in this repo disagree about whether the first or last wins.
