# Production setup

Moving off personal credentials onto the Yakal account. Work top to bottom.

## 0. Project settings, for reference

| Field | Value |
| --- | --- |
| Organization | `Yakal` |
| Project | `yakal` |
| Region | East US (North Virginia), `us-east-1` |
| Data API | on |
| Automatically expose new tables | on |
| Automatic RLS | off |

Region is the only one that cannot be changed later. Before there is real
data, deleting the project and making another costs nothing.

---

## 1. Collect the credentials

**Dashboard > Project Settings > API**

| Copy | Into |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL` |
| `anon` / publishable key | `VITE_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

**Dashboard > Connect > Session pooler**

Copy the whole string. Replace `[YOUR-PASSWORD]` with the database password.
This is `SUPABASE_DB_URL`, used only by GitHub Actions.

Use the pooler, not `db.<ref>.supabase.co`. The direct host is IPv6 only and
GitHub runners have no IPv6 route to it.

If the password contains anything outside `A-Za-z0-9`, percent-encode it in
that string: `@` becomes `%40`, `#` becomes `%23`, `/` becomes `%2F`.

---

## 2. Update `.env`

Change three lines. Leave the rest.

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

Leave `VITE_BACKEND=local`. Local development keeps using the Docker stack;
these values are for production builds and for pointing at the remote when you
deliberately want to.

Do not touch `VITE_SUPABASE_LOCAL_URL` or `VITE_SUPABASE_LOCAL_ANON_KEY`.

---

## 3. Configure Auth

**Dashboard > Authentication > URL Configuration**

- Site URL: `https://yourdomain.com` (or the Vercel URL until the domain is live)
- Redirect URLs, add each:
  - `https://yourdomain.com/**`
  - `http://localhost:5173/**`

Confirmation and password reset links are built from Site URL. Left at its
default, every confirmation email points at a localhost that is not there.

**Dashboard > Authentication > Sign In / Providers > Email**

- Confirm email: **on** for production.

The local stack has it off, so signup returns a session immediately there. With
it on, `AuthPage` sends people to `/confirm-email` instead. Both paths are
already handled; expect the difference.

**Dashboard > Project Settings > Authentication > SMTP Settings**

Turn on custom SMTP and point it at Resend, using the key already in `.env`:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the `RESEND_API_KEY` value
- Sender email: an address on a domain verified in Resend
- Sender name: `Yakal`

Supabase's built-in email sender is rate limited to a handful of messages an
hour and is documented as not for production. Without this, signups fail
silently once a few people register at once.

---

## 4. GitHub secrets

**Repository > Settings > Secrets and variables > Actions > New repository secret**

| Name | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Session pooler string, password substituted in |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` key |

**Repository > Settings > Environments > New environment**

Name it `production`, exactly. The deploy and seed jobs both target it and will
not run without it. Add yourself as a required reviewer if you want a click
between a push and the database changing.

---

## 5. Apply the schema

**Actions > Database > Run workflow**

- Branch: `main`
- `apply_migrations`: on
- `seed_demo_data`: off
- `fresh_seed`: off

The verify job rebuilds the database from nothing on a clean runner, then the
deploy job applies all 35 migrations to the hosted project. Watch for
`supabase migration list` in the Confirm step showing local and remote in
agreement.

From then on, every push to `main` touching `supabase/**` applies what is
pending, automatically.

---

## 6. Verify

**Dashboard > Table Editor**: 34 tables.

**Dashboard > Storage**: two buckets, `avatars` (public) and `resumes`
(private, 10 MB limit). Both are created by migrations, so their absence means
the push did not finish.

**Dashboard > SQL Editor**, paste and run:

```sql
select count(*) as tables from information_schema.tables where table_schema = 'public';
select count(*) filter (where not rowsecurity) as tables_without_rls from pg_tables where schemaname = 'public';
select id, public from storage.buckets order by id;
select has_table_privilege('anon', 'public.v_public_tutors', 'UPDATE') as anon_can_write;
```

Expected: 34, 0, two buckets, `f`.

---

## 7. Seed, optional

Only while the database has nobody real in it.

**Actions > Database > Run workflow** with `seed_demo_data` on. Add
`fresh_seed` to clear the dataset's rows first.

---

## 8. Vercel

**Project Settings > Environment Variables**, Production and Preview.

Add these 20:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
VITE_ZOOM_MEETING_CLIENT_ID
ZOOM_MEETING_CLIENT_SECRET
ZOOM_S2S_ACCOUNT_ID
ZOOM_S2S_CLIENT_ID
ZOOM_S2S_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
APP_BASE_URL
VITE_GCP_CLIENT_ID
GCP_CLIENT_SECRET
GOOGLE_OAUTH_REFRESH_TOKEN
RESEND_API_KEY
VITE_CONTACT_DESTINATION_EMAIL
VITE_CLOUDINARY_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET
VITE_DICEBEAR_BASE_URL
VITE_DICEBEAR_STYLE
```

Deliberately absent:

- `VITE_BACKEND` — unset means remote in a production build, which is what you want
- `VITE_SUPABASE_LOCAL_URL`, `VITE_SUPABASE_LOCAL_ANON_KEY` — development only
- `GEMINI_API_KEY` — only `scripts/seed` reads it
- `DEV_TOOLS_ENABLED` — leave it out; `/api/dev-user` refuses in production regardless

Set `APP_BASE_URL` to the production URL, not localhost, or Stripe Checkout
returns customers to a machine that is not there.

---

## 9. Other consoles

**Stripe > Developers > Webhooks**: add an endpoint at
`https://yourdomain.com/api/stripe-webhook`. Copy its signing secret into
`STRIPE_WEBHOOK_SECRET` on Vercel. The `whsec_` in `.env` is the local
`stripe listen` one and is not the same value.

**Zoom Marketplace > your Meeting SDK app**: add the production domain to the
allow list.

**Google Cloud Console > Credentials > OAuth client**: add the production
origin and redirect URI.

**Cloudinary**: confirm the unsigned preset allows uploads from the production
domain.

---

## 10. Smoke test

Against the deployed site:

1. Sign up as a parent. Confirmation email arrives from your domain, not
   Supabase's.
2. Follow the link. It lands on the production site, not localhost.
3. Sign in, upload an avatar. It appears, meaning the `avatars` bucket and its
   policies came across.
4. Open a course page and the tutor list.
5. Submit the contact form. Check it reaches
   `VITE_CONTACT_DESTINATION_EMAIL`.

---

## 11. Rotate

The Stripe, Zoom, Resend and Google credentials were all in a `.env` on a
personal machine. Reissue them from the Yakal account and update Vercel. The
old Supabase project can then be deleted.

---

## Before real users

`profiles` has an RLS policy of `USING (true)` for role `public`, which
includes `anon`. The publishable key ships in the bundle, so anyone can read
every user's name, email and phone without signing in. This survives the move
to the new project, because it is in the migrations. Fix before launch.
