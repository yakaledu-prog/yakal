# Google Cloud, from scratch

For setting this up on a fresh Google account, with nothing carried over.

You need two things by the end: an **OAuth client** (an id and a secret), and a
**refresh token** minted against it. Everything below exists to produce those
two, put them in Vercel, and stop them expiring.

Do the steps in order. Google will not let you create the client before the
consent screen exists, which is what the warning banner on the Credentials page
is telling you.

---

## 0\. Which Google account

One account owns everything. It must be:

*   a **teacher** on every Google Classroom you link, or Classroom answers
    `Requested entity was not found` for a class that plainly exists
*   the owner of the Drive folder student documents go into

It does not have to be a person's account and probably should not be. Something
like `ops@yourdomain` or a dedicated Gmail is better, because the app acts as
this account permanently and it should not vanish when somebody leaves.

Sign in as that account now and stay signed in as it for every step.

---

## 1\. The project

**console.cloud.google.com > project picker > New project.**

Name it something you will recognise later. No organisation is needed. Nothing
here costs money: see section 8.

---

## 2\. Enable the two APIs

**APIs and Services > Library**, search and enable:

*   **Google Drive API**
*   **Google Classroom API**

You have already done this. Worth knowing what it looks like when missed: a
missing API answers `403 accessNotConfigured`, which reads like a permission
problem and is not one.

---

## 3\. The consent screen

**APIs and Services > OAuth consent screen.** Newer consoles call this
**Google Auth Platform** and split it across Branding, Audience and Data
Access; the fields are the same.

**User type: External.** Internal is only available with Google Workspace, and
only covers accounts inside your organisation.

Fill in app name, support email and developer contact email. Nothing else on
that page matters yet.

### 3a. Scopes

Add these five. They are exactly what the app uses and nothing more.

```
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/classroom.courses
https://www.googleapis.com/auth/classroom.coursework.students
https://www.googleapis.com/auth/classroom.rosters.readonly
https://www.googleapis.com/auth/classroom.student-submissions.students.readonly
```

`drive.file` rather than `drive` is deliberate and worth being able to explain:
it grants access **only to files this app itself created**. The app cannot see
anything else in that Drive, and Google classifies it as non-sensitive for that
reason.

The console labels each scope **Sensitive** or **Restricted** as you add them.
The Classroom ones are sensitive. Read section 4 before that worries you.

### 3b. Test users

While the app is in Testing, only accounts listed here can consent. Add the
account from step 0. Add your own too if it is different.

---

## 4\. Publish the consent screen

**OAuth consent screen > Publish app.** Confirm the banner reads
**In production**.

This is the single most important step in this document, and it is the one that
was missed before.

While an app sits in **Testing**, Google **expires every refresh token after
seven days**. Not the access token, which is meant to be short lived, but the
refresh token the server keeps. That is the entire reason Drive and Classroom
kept dying roughly weekly, and no amount of re-minting fixes it for longer than
a week. Publishing stops it.

**What publishing does and does not require, honestly.** Because the Classroom
scopes are sensitive, Google offers a verification process, and you will see
prompts about it. You do not have to complete it to publish or to work:

*   **Unverified and published** is a working state. Tokens stop expiring. The
    one thing you get is a warning screen the first time an account consents,
    reading "Google hasn't verified this app", with the real button behind
    **Advanced > Go to (unsafe)**.
*   That screen is seen by the operations account **once**, and by any admin who
    links a class from their browser. Not by students, tutors or parents, who
    never sign in to Google at all.
*   Unverified apps using sensitive scopes are capped at **100 consenting
    users**. You will use one or two.

Verification becomes worth doing when the app is public-facing and that warning
would frighten real customers. For an internal operations account it is
paperwork with no payoff. It needs a privacy policy URL, a verified domain and
a demo video, and review takes weeks.

---

## 5\. Create the OAuth client

**APIs and Services > Credentials > Create credentials > OAuth client ID.**

**Application type: Web application.** Not Desktop. The name is for you only.

### 5a. Authorised JavaScript origins

These are for the one browser-side flow: an admin pressing **Fetch Details**
when linking a class.

```
https://yakal-binyams-projects-c5ceefa9.vercel.app
http://localhost:5173
```

Add your custom domain too if you have one. Google compares the origin as an
exact string, so all three of these are wrong:

*   a trailing slash, `https://example.com/`
*   any path, `https://example.com/admin/courses`
*   `http` where the site is served over `https`

Getting it wrong answers `Error 400: origin_mismatch`.

**Wildcards are not supported.** Vercel gives every preview deployment its own
hostname, so Fetch Details will fail on previews whatever you register. Link
classes on production. Nothing else is affected, because Drive and the tutor
and student assignment lists go through the server and never involve the
browser's origin.

### 5b. Authorised redirect URIs

```
http://localhost:5599/callback
```

This one is only used by the script in step 6, on your own machine, and never
in production. It is the failure everyone hits first if it is missing:
`redirect_uri_mismatch`.

### 5c. Copy both values

*   **Client ID**, ends `.apps.googleusercontent.com`
*   **Client secret**

Put them in your local `.env`, because step 6 reads them from there:

```
VITE_GCP_CLIENT_ID=....apps.googleusercontent.com
GCP_CLIENT_SECRET=...
```

---

## 6\. Mint the refresh token

On your own machine, signed in to the browser as the account from step 0:

```
node scripts/google-oauth-setup.mjs
```

It prints a URL. Open it, consent, and the terminal prints:

```
GOOGLE_OAUTH_REFRESH_TOKEN=1//0g...
```

Copy that. What this script actually does is section 7, which is written to be
shown to your client.

If it says Google returned no refresh token, go to
`myaccount.google.com/permissions`, remove the app, and run it again. Google
only issues a refresh token on a first authorisation.

---

## 7\. What `google-oauth-setup.mjs` does

Written so you can answer this question from someone who has to trust it. The
file is 118 lines and every claim below can be checked by reading it.

**It performs the OAuth 2.0 loopback flow, which is Google's own documented
procedure for exactly this situation.** Nothing about it is unofficial.

Step by step:

1.  Reads `VITE_GCP_CLIENT_ID` and `GCP_CLIENT_SECRET` from your `.env`, using
    a nine-line parser rather than a dependency.
2.  Builds a Google consent URL with `@googleapis/drive`, **Google's own
    published library**, asking for the five scopes in step 3a.
3.  Starts a plain HTTP server on `localhost:5599` **on your machine only**, to
    catch the redirect Google sends back. It is not reachable from the
    internet.
4.  Exchanges the returned code with Google for a refresh token, over Google's
    own endpoint.
5.  Prints the token to your terminal, closes the server and exits.

**What it does not do.** It writes no files, anywhere. It sends nothing to any
third party. There is no telemetry and no remote host that is not Google's.

**How to satisfy yourself independently.** Three commands, and what each should
show:

```
grep -nE "writeFile|appendFile|createWriteStream" scripts/google-oauth-setup.mjs
```

Nothing. The token is printed to your terminal and never stored by the script.

```
grep -oE "https?://[a-zA-Z0-9./_-]+" scripts/google-oauth-setup.mjs | sort -u
```

Only `http://localhost`, five `https://www.googleapis.com/auth/...` strings and
one `console.cloud.google.com` link. The five are **scope identifiers**, not
addresses: they name the permissions being requested and nothing connects to
them. The console link is printed as help text.

```
grep -oE "^import .*" scripts/google-oauth-setup.mjs
```

Three imports: `node:http` and `node:fs`, both part of Node itself, and
`@googleapis/drive`, published by Google.

The two real network calls, to `accounts.google.com` and
`oauth2.googleapis.com`, are made **inside Google's own library** rather than by
this file, which is why they do not appear as strings in it. Watching the
traffic while it runs shows those two hosts and nothing else.

**Why a script is needed at all.** The refresh token is the one credential
Google will not let you copy from a dashboard. It is issued once, in exchange
for a consent you give interactively, and only to the client that asked. Every
approach to this, in every language, is this same exchange. The alternative is
a Google Workspace service account with domain-wide delegation, which needs a
paid Workspace domain and grants the server far more than `drive.file` does.

**What the token can do if it leaks.** It acts as the operations account,
limited to those five scopes: files this app created, and classes that account
teaches. It cannot read the rest of that account's Drive, its Gmail, or
anything else. Revoke it instantly at `myaccount.google.com/permissions`.

---

## 8\. Do you need a paid plan?

Short answer: **no, and I am not going to tell your client otherwise.**

**Google Cloud.** The Drive and Classroom APIs are free at any volume this app
will reach. Quotas are per-minute request limits, not a bill. Nothing in this
document requires a billing account.

**Google Workspace**, around 6 to 7 USD per user per month. Not required. It
would let you use an Internal consent screen, which skips the unverified
warning, and a service account with domain-wide delegation, which skips the
refresh token. Both are conveniences. Neither fixes anything that is currently
broken.

**Vercel Pro**, 20 USD a month. This is the only one with a real argument, and
it is a modest one:

| | Hobby | Pro |
| --- | --- | --- |
| Serverless functions | 12 | effectively unlimited |
| Function duration | 10s (60s max) | 15s (300s max) |
| Commercial use | not permitted by the terms | permitted |

The function limit is the reason the endpoints were grouped behind `?action=`
dispatchers instead of being one file each. That grouping works, so this buys
tidiness rather than capability.

**The line worth being straight about:** Vercel's Hobby plan does not permit
commercial use. If this app is being run for a paying client, that is the
honest reason to upgrade, and it has nothing to do with any bug.

None of today's failures were caused by a plan limit. They were a missing file
extension, an oversized package and unset environment variables. A paid plan
would not have prevented any of them.

---

## 9\. Put it in Vercel

**Project Settings > Environment Variables**, Production and Preview.

| Variable | Value |
| --- | --- |
| `VITE_GCP_CLIENT_ID` | from step 5c |
| `GCP_CLIENT_SECRET` | from step 5c |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | from step 6 |

`VITE_GCP_CLIENT_ID` is public by design: it goes into the browser bundle so
the admin's sign-in popup can start. A client id is not a secret. The other two
are server only and must never carry a `VITE_` prefix, which would publish them
to every visitor.

**Redeploy.** Vercel bakes environment variables in at build time, so adding a
variable changes nothing until the next build.

---

## 10\. Check it

In this order. Each step fails for a different reason, so stopping at the first
failure tells you the most.

**Admin > Courses > create a course**, paste a Classroom URL, press Fetch
Details.
Works: the client id, the origins and your own Google account are right.
`origin_mismatch`: step 5a.

**Admin > Courses > a linked course > Assignments.** The important one, because
it uses the server credential.
Works: everything above is right.
`GOOGLE_OAUTH_REFRESH_TOKEN is not set`: step 9, or you did not redeploy.
`Google access has expired`: step 4, or the token was minted while in Testing.
`not found for the Yakal Google account`: step 0, wrong owner.

**Tutor > My Courses > the same course > Assignments.** Should match exactly,
with no Google sign-in anywhere.

**Student > College > Documents.** Drive, on the same credential.

---

## When it breaks later

| What you see | What it is |
| --- | --- |
| Everything Google stops at once, about a week after it last worked | consent screen back in Testing, or the token was minted while it was |
| `GOOGLE_OAUTH_REFRESH_TOKEN is not set` | not in Vercel, or set but not redeployed |
| Admin fetch works, tutor and student do not | the class is owned by a different Google account |
| `Error 400: origin_mismatch` | step 5a, and previews can never be registered |
| `redirect_uri_mismatch` when minting | `http://localhost:5599/callback` missing from the client |
| `403 accessNotConfigured` | the API is not enabled on the project |
| Script prints no refresh token | already authorised once; revoke at myaccount.google.com/permissions |

---

## What this does not cover

Students are not added to the Google Classroom roster. They read the work
through Yakal and never sign in to Google, which is the point, but it also
means they cannot submit inside Classroom. Adding them to a roster needs a
Google account each and an invitation each of them accepts, which is exactly
the friction this arrangement removes. Worth deciding deliberately rather than
discovering.
