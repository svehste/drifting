# Deploy & operate [Drift]

Boring on purpose: one Next.js app on **Vercel**, one Postgres on **Supabase**.

## Environment variables

All are **server-only secrets** except the two `NEXT_PUBLIC_` values (safe to expose).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection (use the **Session pooler** string; the app sets `prepare:false` for pgbouncer). |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (staff auth). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is also accepted. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. For the admin invite flow. |
| `DEV_ADMIN_EMAIL` | **Local dev only.** When Supabase auth is not configured, act as this seeded admin. Never set in production. |

Copy `.env.example` → `.env.local` for local development.

## First-time setup

```bash
nvm use                 # Node 20 (see .nvmrc)
npm install
npm run db:migrate      # apply drizzle/*.sql to the database
npm run db:seed         # default classes (Pro, Semi-Pro) + one admin user
npm run db:check        # verify connection + tables
```

Optional: `npx tsx src/db/seed-demo.ts` creates a fully-scored demo event you can
delete from the admin UI afterwards.

## Local development

```bash
npm run dev             # http://localhost:3000
npm test                # unit + PGlite integration tests
npm run typecheck
npm run build
```

Without Supabase auth configured, set `DEV_ADMIN_EMAIL=admin@example.com` and an
empty `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` to browse the admin area as the
seeded admin.

## Deploy to Vercel

1. Import the repo in Vercel (framework auto-detected as Next.js).
2. Add the environment variables above in **Project → Settings → Environment Variables**.
3. Deploy. Run `npm run db:migrate` against the production `DATABASE_URL` on each
   schema change (locally or in a CI step) — migrations are not run automatically.
4. Confirm Supabase **backup retention** on your tier and that the plan covers the
   expected public read peak (~2000 viewers). Public leaderboard/bracket endpoints
   are CDN-cached (`s-maxage=5`), so the origin sees roughly one hit per race per 5s.

## Staff auth (production)

Staff log in with email + password via Supabase Auth. Link each app user to their
auth identity by setting `users.auth_user_id`. The admin-driven invite flow
(create user → invite → set password) uses `SUPABASE_SERVICE_ROLE_KEY`.

## Full lifecycle smoke test

Create event → race → assign three criterion judges → add & register drivers →
judges score & confirm → lock qualifying → publish leaderboard → generate bracket
→ decide battles → podium → driver page shows history.
