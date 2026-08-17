# Google setup: Drive and Classroom

Do these in order. Each stage says exactly what to click and what to paste.

The operations account is **binyam2537@gmail.com**. Be signed into Google as
that account, in that browser profile, for every stage below. Signing in as
anyone else at stage 5 produces a token that cannot see the classes.

Assumed done already: Google Classroom API and Google Drive API enabled.

---

## Stage 1: create the OAuth client

Cloud Console > **APIs and Services** > **Credentials** > **Create credentials**
> **OAuth client ID**.

- Application type: **Web application**
- Name: anything, `Yakal local` is fine

Under **Authorised redirect URIs**, click ADD URI and paste exactly:

```
http://localhost:5599/callback
```

Under **Authorised JavaScript origins**, add both:

```
http://localhost:5599
http://localhost:5173
```

The two lists are for different things and are not interchangeable. The
redirect URI is used by the server-side script in stage 5. The origins are used
by the browser popup behind the admin course modal's "Fetch Details" button,
which fails with **Error 400: origin_mismatch** if 5173 is missing.

`http://localhost:5173` and `http://127.0.0.1:5173` are different origins to
Google. Register whichever you actually open the app on, or both.

Click **Create**. A dialog shows a **Client ID** and a **Client secret**. Copy
both now, you need them in stage 3.

Google's own note applies here: a change to this page takes **5 minutes to a
few hours** to take effect. An `origin_mismatch` straight after saving is
usually just that.

## Stage 2: add the scopes

Cloud Console > **APIs and Services** > **OAuth consent screen** > **Data
access** (older console: the **Scopes** step) > **ADD OR REMOVE SCOPES**.

At the bottom of that panel there is a box labelled **Manually add scopes**.
Paste all six, one per line:

```
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/classroom.courses
https://www.googleapis.com/auth/classroom.coursework.students
https://www.googleapis.com/auth/classroom.rosters.readonly
https://www.googleapis.com/auth/classroom.student-submissions.students.readonly
https://www.googleapis.com/auth/classroom.topics.readonly
```

Click **ADD TO TABLE**, then **UPDATE**, then **SAVE**.

They must be the full `https://www.googleapis.com/auth/...` URL. The short name
alone is rejected with "the following scope(s) were not added because they are
invalid".

Five of the six will land under **Sensitive scopes**. That is expected and
changes nothing until you want strangers signing in, which in this design never
happens.

## Stage 3: put the client in .env

Open `.env` and set these two, from stage 1:

```
VITE_GCP_CLIENT_ID=your-client-id.apps.googleusercontent.com
GCP_CLIENT_SECRET=your-client-secret
```

Do not rename the secret to anything starting with `VITE_`. Vite inlines those
into the browser bundle at build time, which would publish it to every visitor.
`VITE_GCP_CLIENT_ID` is public on purpose.

## Stage 4: add yourself as a test user

Cloud Console > **OAuth consent screen** > **Audience**.

If **Publishing status** is **Testing**, find **Test users**, click **ADD
USERS**, and add `binyam2537@gmail.com`. Without this, stage 5 fails with
"access blocked, this app has not completed verification".

Skip this if you already published in stage 7.

## Stage 5: mint the refresh token

In the project directory:

```
node scripts/google-oauth-setup.mjs
```

It prints a URL and waits. Open the URL, **sign in as binyam2537@gmail.com**,
and accept the consent screen. Google will warn that the app is unverified;
click **Advanced**, then **Go to (app name) (unsafe)**. That warning is about
verification, not about anything being wrong.

The script prints a refresh token starting `1//`. Put it in `.env`:

```
GOOGLE_OAUTH_REFRESH_TOKEN=1//0...
```

Make sure there is only one uncommented `GOOGLE_OAUTH_REFRESH_TOKEN` line.
Different loaders in this repo disagree about whether the first or last wins.

If port 5599 is in use, run `node scripts/google-oauth-setup.mjs --port 5173`
and add `http://localhost:5173/callback` as a redirect URI in stage 1 too.

## Stage 6: check it works

```
node scripts/verify-drive.mjs
```

Creates a probe file, reads it back, and deletes the file it just created. It
cannot touch anything that existed beforehand: the only delete is of the id the
create call returned one line earlier.

For Classroom, follow `docs/CLASSROOM_TESTING.md`. The `K-12 Mathematics`
course is already pointed at the `yakal` class.

To point a course at a different class, sign in to Yakal as an admin, edit the
course, and paste the URL into its **Google Classroom URL** field. That is a
plain text field and needs no Google sign-in; the "Fetch Details" button beside
it is an optional preview and the only thing that uses the browser popup.

## Stage 7: publish, so the token stops dying

Cloud Console > **OAuth consent screen** > **Audience** > **PUBLISH APP**.

While the app sits in **Testing**, Google expires every refresh token after
**seven days**. The integration works for a week and then fails with
`invalid_grant` for no visible reason. Publishing stops that.

Publishing does not require verification to keep working for accounts you own.
Google may show a "needs verification" banner; ignore it unless you ever want
users outside the project signing in.

## Stage 8: production

Set the same three variables in the hosting environment:

```
VITE_GCP_CLIENT_ID
GCP_CLIENT_SECRET
GOOGLE_OAUTH_REFRESH_TOKEN
```

A refresh token is per account, not per environment, so the one minted locally
is the one production uses.

---

## If you change scopes later

A refresh token carries whatever was consented at the moment it was minted.
Adding a scope in stage 2 does nothing to a token already issued. Redo stage 2
and stage 5, in that order.

Stage 5 of the Classroom plan, adding co-teachers and inviting students, needs
`https://www.googleapis.com/auth/classroom.rosters` instead of the `.readonly`
form. That is another re-mint when it arrives.

## What each scope is for

| Scope, after `https://www.googleapis.com/auth/` | Why |
| --- | --- |
| `drive.file` | Files this app created, and nothing else. The only non-sensitive one. |
| `classroom.courses` | Read the class itself. |
| `classroom.coursework.students` | Read the work set on a class. |
| `classroom.rosters.readonly` | Turn a submission's user id into a name. |
| `classroom.student-submissions.students.readonly` | Who turned what in, and the grade. |
| `classroom.topics.readonly` | The class's own grouping of work into units. |

`classroom.topics.readonly` is separate from `classroom.courses` and easy to
miss. Without it, `courses.topics.list` answers "Request had insufficient
authentication scopes", the read-through treats that as a class that groups
nothing, and the work still lists, flat. Nothing errors. Grouping just never
appears.

## Things that will waste an afternoon

**The operations account must be a teacher on the class.** Classroom
permissions are per course membership. Owning the class in Drive terms is not
enough, and reading a class it is not a teacher on fails as "not found".

**A Gmail alias is not a Google account.** `binyam2537+student@gmail.com`
resolves back to `binyam2537@gmail.com`, so it cannot be a separate member of a
class. Aliases are fine for testing our own email and useless for a roster.

**A student's Yakal profile email must equal their Google account email.** The
read-through resolves a learner's Classroom identity by handing that exact
address to `courses.students.get`. A mismatch makes them unplaceable: excluded
from individually assigned work, with no submissions of their own to read.

**A class URL from the wrong account fails as "not found".** Google answers the
same way whether a class does not exist or is simply invisible to this token,
so the message reads like a broken integration when it is a stale link.
