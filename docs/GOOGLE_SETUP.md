# Google on the deployed site

Drive and Classroom both run through one Google account and one OAuth client.
Get that pair right and the Documents tab, the assignments tabs and the course
modal all work. Get it wrong and they fail in different ways that look like
different bugs.

Work top to bottom. Nothing here needs code changes.

---

## 0. The one idea

There are **two** ways this app talks to Google, and they fail differently.

| | Server side | Browser side |
| --- | --- | --- |
| Who it is | one Yakal account, always | whoever is signed in |
| Credential | `GOOGLE_OAUTH_REFRESH_TOKEN` | a token from a Google sign-in popup |
| Used by | Drive documents, reading Classwork | the admin's Fetch Details button |
| Fails as | "Google access has expired" | "invalid authentication credentials" |

Students and tutors never sign in to Google. They read Classwork through our
server, which checks they are on the course and then asks Google with the one
account. That is the whole point: booking a course is what grants access.

The **only** browser sign-in left is the admin linking a class while creating a
course, because that is the one moment somebody has to pick from *their* own
classes.

---

## 1. Google Cloud Console

Pick the project that owns `VITE_GCP_CLIENT_ID`.

### 1a. Publish the consent screen

**APIs and Services > OAuth consent screen > Publish app**

Do this first and do not skip it. While the app is in **Testing**, Google
expires every refresh token after **seven days**. That is the single reason
Classroom and Drive break roughly weekly, and no amount of re-minting fixes it
for longer than a week.

Publishing needs no verification review here, because the app asks for
`drive.file` rather than full `drive`: it reaches only files this app created,
which Google treats as non-sensitive.

Confirm the banner reads **In production**.

### 1b. Enable the APIs

**APIs and Services > Enabled APIs > Enable APIs and services**

- Google Drive API
- Google Classroom API

A missing API answers `403 accessNotConfigured`, which reads like a permission
problem and is not one.

### 1c. Authorised origins and redirect URIs

**APIs and Services > Credentials > your OAuth 2.0 Client ID**

Authorised JavaScript origins, for the admin's in-browser sign-in:

```
https://yourdomain.com
https://yakal.vercel.app          (whatever Vercel calls the project)
http://localhost:5173
```

Authorised redirect URIs, for minting the server token:

```
http://localhost:5599/callback
```

That last one is only used by `scripts/google-oauth-setup.mjs` on your own
machine. It never runs in production, and `redirect_uri_mismatch` is the
failure everyone hits without it.

---

## 2. The Google account that owns everything

One account owns the classes and the Drive folder. Everything the server does,
it does as that account.

It must be:

- a **teacher** on every Classroom you link, or Classroom answers
  `Requested entity was not found` for a class that plainly exists
- the owner of the Drive folder student documents go into

If you link a class owned by a different account, the admin's Fetch Details
may work, because that is signed in as *you*, while the tutor and student
pages fail, because those go through the server as the operations account.
Same class, two answers, and that is why.

---

## 3. Mint the refresh token

On your own machine, signed in as the account from step 2:

```bash
node scripts/google-oauth-setup.mjs
```

It opens a consent screen, catches the redirect on `localhost:5599` and prints
a refresh token. Copy it.

Scopes it asks for, all of which the app uses:

```
drive.file
classroom.courses
classroom.coursework.students
classroom.rosters.readonly
classroom.student-submissions.students.readonly
```

Put it in `.env` as `GOOGLE_OAUTH_REFRESH_TOKEN` **and** in Vercel in the next
step. The two are separate; changing one does not change the other.

> After changing it locally, **restart the local API server**. `dotenv` reads
> `.env` once at boot, so a running process keeps the old token and every
> Google call answers "Google access has expired" against a token that is
> perfectly valid on disk. On Vercel this cannot happen: every deploy starts
> fresh.

---

## 4. Vercel

**Project Settings > Environment Variables**, Production and Preview.

| Variable | Value |
| --- | --- |
| `VITE_GCP_CLIENT_ID` | the OAuth client id, ends `.apps.googleusercontent.com` |
| `GCP_CLIENT_SECRET` | the client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | from step 3 |

`VITE_GCP_CLIENT_ID` is public by design: it goes in the bundle so the admin's
sign-in popup can start. The other two are server only and must never carry a
`VITE_` prefix, which would publish them.

**Redeploy after adding them.** Vercel bakes environment variables in at build
time; adding a variable does not change a build that already exists.

---

## 5. Check it

Against the deployed site, in this order. Each step fails for a different
reason, so stopping at the first failure tells you the most.

1. **Admin > Courses > create a course**, paste a Classroom URL, press Fetch
   Details.
   Works: the browser client id, origins and your own Google account are right.
   `invalid authentication credentials`: step 1c, authorised origins.

2. **Admin > Courses > a linked course > Assignments.**
   Works: the server credential is right and this is the important one.
   "Google access has expired": step 1a and step 3.
   "not found for the Yakal Google account": step 2, wrong owner.

3. **Tutor > My Courses > the same course > Assignments.** Should match step 2
   exactly, with no Google sign-in anywhere.

4. **Student > My Learning > the course > Assignments.** Same again. A student
   is never asked to sign in to Google; if they are, something is calling
   Google from the browser that should not be.

5. **Student > College > Documents.** Uploads and lists through Drive on the
   same credential.

---

## When it breaks later

| What you see | What it is |
| --- | --- |
| Everything Google stops at once, about a week after it last worked | consent screen back in Testing, or a token minted while it was |
| Admin fetch works, tutor and student do not | class owned by a different Google account |
| Works deployed, fails locally after a token change | local API server holding the old `.env`, restart it |
| `403 accessNotConfigured` | the API is not enabled on the project |
| `redirect_uri_mismatch` when minting | `http://localhost:5599/callback` missing from the client |

---

## What this does not cover

Students are not added to the Google Classroom roster. They read the work
through Yakal and never sign in to Google, which is the point, but it also
means they cannot submit inside Classroom. Adding them to a roster needs a
Google account each and an invitation each of them accepts, which is exactly
the friction this arrangement removes. Worth deciding deliberately rather than
discovering.
