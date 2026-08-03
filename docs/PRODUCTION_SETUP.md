# Production setup

Moving off personal credentials onto the Yakal account. Do these in order.

## 1. Supabase

### Names

| Field | Value | Why |
| --- | --- | --- |
| Organization | `Yakal` | The company, not the project. You will add more projects under it later. |
| Project | `yakal` | Matches `project_id` in `supabase/config.toml`, so the CLI and the dashboard agree. |
| Region | Central EU (Frankfurt), `eu-central-1` | Supabase has no African or Middle Eastern region. Ethiopian traffic reaches Europe over the Djibouti cables, so Frankfurt is the shortest path. Mumbai (`ap-south-1`) is the alternative if you ever measure it faster. |
| Plan | Free to start | Pro when you need daily backups or the project outgrows a week of inactivity pausing it. |

Do not use a dash or a suffix like `prod`. If a staging project follows, name
it `yakalstaging` and keep `yakal` as production.

**Database password**: let the dashboard generate it, then store it in the
password manager immediately. It is shown once. Losing it means resetting it,
which invalidates the connection string in GitHub and Vercel.

### The region cannot be changed later

Moving regions means a new project and a migration. Decide now.

## 2. Credentials to collect

From **Project Settings > API**:

- Project URL, `https://<ref>.supabase.co`
- `anon` / publishable key, public, goes in the bundle
- `service_role` key, secret, server only

From **Connect > Session pooler**, the full connection string. Copy it
verbatim rather than assembling it: the pooler hostname is not always
`aws-0-<region>`.

Use the pooler, not `db.<ref>.supabase.co`. The direct host is IPv6 only and
GitHub runners have no IPv6 route to it.

## 3. GitHub secrets

Settings > Secrets and variables > Actions > New repository secret:

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | The session pooler string, with the password substituted in |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` key |

Then create the `production` environment (Settings > Environments). The deploy
and seed jobs both target it, so it must exist or they will not run. Add a
required reviewer on it if you want a human gate before anything touches the
database.

## 4. First migration push

Once the secrets exist, run the **Database** workflow manually:

Actions > Database > Run workflow, with `apply_migrations` on and
`seed_demo_data` off.

It builds the schema from nothing on a clean runner first, then applies all 35
migrations to the hosted project. A brand new project has an empty migration
ledger, so everything from the baseline forward runs in order.

After that, every push to `main` that touches `supabase/**` applies whatever is
pending. Seeding stays manual.

To load the demo dataset, run the workflow again with `seed_demo_data` on.
`fresh_seed` clears the dataset's rows first. Neither belongs on a database
with real families in it.

## 5. Vercel

Project Settings > Environment Variables. Everything in `.env.example` except
the `VITE_SUPABASE_LOCAL_*` pair and `VITE_BACKEND`, which only matter on a
development machine.

Set `APP_BASE_URL` to the production domain, not localhost, or Stripe Checkout
returns customers to a machine that is not there.

`DEV_TOOLS_ENABLED` must be absent or `false`.

## 6. Rotate what the personal account saw

The old project's `service_role` key, the Stripe keys, the Zoom secrets and the
Resend key were all in a `.env` on a personal machine. Reissue them from the
Yakal account rather than copying them across.

## Before real users

`profiles` currently has an RLS policy of `USING (true)` for role `public`,
which includes `anon`. The publishable key ships in the bundle, so anyone can
read every user's name, email and phone without signing in. Fix before launch.
