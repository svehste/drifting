# Tech stack [Teknologivalg]

Chosen constraints: **TypeScript** ecosystem, **managed BaaS** hosting. Optimized
for the spec's three drivers — 2000 concurrent public readers, live updates, a
small relational write load ([acceptance_criteria.md](acceptance_criteria.md)
Non-functional AC 4; [data_model.md](data_model.md)).

## Summary

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (end to end) | One language, shared types from DB → UI. |
| Database | **PostgreSQL** (via Supabase) | Relational model fits exactly; battle-tested; managed = low maintenance. |
| BaaS | **Supabase** | Used simply as **managed Postgres + managed Auth** — nothing exotic. |
| Framework | **Next.js** | Industry-standard React framework; huge example base (fewer AI mistakes); server-rendered pages + simple server actions for writes. |
| DB access | **Drizzle ORM** | TS-first schema; **SQL-close** queries — easy to read and to audit AI-written code. `drizzle-kit studio` gives a GUI. |
| Auth | **Supabase Auth** (staff only) | **Don't roll your own auth.** Email/password + invites. Drivers use UUID links (no auth). |
| Validation | **Zod** | Runtime input validation at every write boundary; inferred TS types. |
| Live updates | **Short polling** of cached endpoints | Simplest robust approach for 2000 readers — no WebSockets to run or debug. |
| Hosting | **Vercel** (app) + **Supabase** (data) | Managed, HTTPS + CDN built in, preview deploys, automatic backups. |
| Testing | **Vitest** (unit) | Unit-test the pure logic (seeding/ranking) first; add Playwright e2e later only if needed. |

> Alternative if you prefer: **SvelteKit** instead of Next.js (lighter, equally
> capable) — doesn't change the architecture below.
>
> **Drizzle over Prisma is decided:** SQL-close queries are easier to read and to
> review when AI writes the data layer, which matches how this project is built.
> `drizzle-kit studio` covers the GUI; `drizzle-kit` handles migrations.

---

## Authentication & roles

- **Staff (admin/judge/secretary)** → Supabase Auth (email + password). Invite
  flow via Supabase invite emails or a custom token.
- **Drivers** → **not** in the auth system. The driver page is a public route
  `/foerer/[uuid]` that looks the driver up by `User.id`. The UUID is the secret;
  page is read-only (Driver page ACs).
- **Roles** live in our `user_role` table (multi-select). Authorization is
  enforced in **one place — server-side** in the Next.js app, checked on every
  write and protected read against the user's roles. One set of rules, testable,
  nothing duplicated.
- **All database access goes through the server** (Drizzle over a server-only
  connection). The browser never talks to the DB directly, so we do **not** need
  Row-Level Security to be correct for safety. This is a very standard
  server-app-with-a-database architecture — and it avoids RLS policies, which are
  a common source of subtle security bugs.
  > RLS can be added later as extra defense-in-depth, but it is **not** needed for
  > the MVP. Keep it out until there's a concrete reason.
- Privileged operations (score, lock/unlock, generate/regenerate, publish,
  delete) run in server actions and write the **audit log in the same
  transaction**.

---

## Live updates & the 2000-viewer path

This is the crux (Non-functional AC 4), and the simplest robust design wins.
**No WebSockets, no realtime service, no cache-revalidation wiring.**

- Each race has a small **public read endpoint** for the leaderboard and one for
  the bracket. Each returns the current (cached) state as JSON.
- Put a **short CDN cache** on those endpoints (e.g. `Cache-Control: s-maxage=5`).
  With 2000 viewers polling every ~5s against a 5-second cache, the origin/DB sees
  roughly **one request per race per 5s** — negligible load.
- Public pages **poll** their endpoint every few seconds and re-render. For a
  leaderboard/bracket this feels live and needs nothing more.
- Staff pages get fresh data immediately: a staff action is a server action that
  returns the updated state. They can poll the same endpoints too.

That's the whole mechanism. It isolates the public **read path** from the
low-volume staff **write path** exactly as the spec requires, with zero realtime
infrastructure to operate or debug.

> If sub-second public updates are ever genuinely needed, add a single Supabase
> **Broadcast** channel per race at that point — but it is not needed now, and
> polling is the lower-risk default.

---

## How the tricky operations map

| Operation | Where it runs |
|---|---|
| Qualifying score entry + confirm | Client form → server action; writes `RunScore`, recomputes `QualifyingRun` completeness. |
| Ranking + HKS/LKS tie-break | Pure TS function over a race's runs; writes cached `qualifying_rank`/`seed`. Unit-tested. |
| Bracket seeding (recursive rule) | Pure TS function (deterministic); generates `Cup` + `Battle` tree. Unit-tested. |
| Battle outcome / OMT | Server action; updates `Battle`, advances winner along `next_battle_id`. |
| Leaderboard publish / unpublish | Server action; sets `Race.leaderboard_status`. Public endpoint reflects it within the cache TTL (~5s). |
| Deletion-blocked-on-results | Server-side guard before delete; checks for `RunScore`/decided `Battle`. |
| Audit logging | Server-side, in the same transaction as each significant write. |

The **pure functions** (seeding, ranking, tie-break, placement) have no infra
dependency — build and test them first, independent of Supabase.

---

## Localization

Norwegian only — **no i18n framework needed**. Keep UI strings in a single
`nb` copy module so wording stays consistent (and English translations in
brackets can live as code comments per the spec convention).

---

## Safety & simplicity principles

The rules that keep this low-risk and low-maintenance:

1. **Don't build security-sensitive pieces yourself** — use managed Auth
   (Supabase); never hand-roll password hashing or sessions.
2. **One place for authorization** — server-side checks against the user's roles;
   no rules duplicated across client and database.
3. **Validate all input** with Zod at write boundaries; reject bad data before it
   reaches the database.
4. **Parameterized queries only** — Drizzle parameterizes by default; no
   string-built SQL, so no SQL-injection risk.
5. **Secrets stay server-side** — DB connection string and service keys are never
   shipped to the browser (Vercel env vars, server-only).
6. **Few dependencies** — lean on the core stack; every extra package is
   maintenance. Enable **Renovate/Dependabot** for automated, reviewable updates.
7. **Managed backups** — rely on Supabase's automatic backups; confirm retention
   on your tier.
8. **Test the risky logic hardest** — the pure functions (seeding, ranking,
   tie-break, placement) are where bugs hurt most and are cheapest to unit-test.
9. **Boring on purpose** — one app, one database. No microservices, queues, cache
   servers, or GraphQL. Add complexity only when a real problem demands it.

---

## Open sub-decisions

1. **Next.js vs. SvelteKit** — **keep Next.js**: the largest example base means AI
   generates it more reliably (fewer bugs). Use it plainly; avoid clever caching.
2. **Drizzle vs. Prisma** — **decided: Drizzle** (SQL-readability + auditability).
3. **Public updates** — **decided: short polling** of short-cached endpoints. No
   WebSockets/realtime for the MVP.
4. **Supabase tier** — confirm the plan covers expected DB + bandwidth at event
   peaks (2000 viewers). Cost/capacity check, not a code one.
5. **Hosting pairing** — Vercel + Supabase assumed; Supabase can also host the
   frontend if you'd rather keep everything with one vendor.
