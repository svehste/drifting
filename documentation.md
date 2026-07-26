# Drifting event manager — Documentation

> **Single reference document.** Consolidates the spec, data model, tech
> decisions, and the *actual implemented architecture* into one place. Use it as
> context when developing new features with AI, and as the operational reference
> for running/deploying the app.
>
> Companion documents (still authoritative for their areas):
> [acceptance_criteria.md](acceptance_criteria.md) (source of truth for behaviour),
> [data_model.md](data_model.md), [tech_stack.md](tech_stack.md),
> [build_plan.md](build_plan.md), [DEPLOY.md](DEPLOY.md).

---

## 1. What this is

A web app for running **drifting events** [arrangement]. Each event has one or
more **races** [løp]; each race runs in two phases — a judged **qualifying**
[kvalifisering] shown on a live public leaderboard, then a 1v1 knockout **cup**
[cup] with a public bracket. Drivers view their own read-only page via a private
UUID link.

- **UI language:** Norwegian only. English terms in brackets on first use.
- **Users:** a handful of staff (admin/judge/secretary) who write; up to
  **~2000 concurrent public viewers** who only read leaderboards/brackets.
- **Scoring/seeding rules** follow the official NM Drifting reglement
  (qualifying §10 & §16, finals/seeding §11).

### MVP scope

Everything in [acceptance_criteria.md](acceptance_criteria.md) **except**:
- Email notifications (deferred)
- Password reset via email (deferred)
- Driver self-editing (the driver page is read-only)

Deliberately **not** built (see tech_stack "Safety & simplicity"): Row-Level
Security, WebSockets/realtime, queues, GraphQL, microservices.

---

## 2. Tech stack

| Layer | Choice | Version (package.json) |
|---|---|---|
| Language | TypeScript | ^5.6 |
| Framework | Next.js (App Router) | ^14.2 |
| UI | React | ^18.3 |
| Database | PostgreSQL via **Supabase** | — |
| DB access | Drizzle ORM + drizzle-kit | ^0.36 / ^0.28 |
| PG driver | `postgres` (postgres.js) | ^3.4 |
| Auth | Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`) — **staff only** | ^0.5 / ^2.45 |
| Validation | Zod | ^3.23 |
| Testing | Vitest (+ `@electric-sql/pglite` for in-memory Postgres integration tests) | ^2.1 / ^0.5 |
| Hosting | Vercel (app) + Supabase (data) | — |
| Node | **>= 20.9** (see `.nvmrc`) | — |

**Philosophy: boring on purpose.** One app, one database. Live public updates are
**short polling of short-cached JSON endpoints**, not realtime. Add complexity
only when a concrete problem demands it.

---

## 3. Architecture at a glance

```
Browser (public)  ──poll every ~5s──►  /api/lop/[id]/resultater   (CDN-cached JSON, s-maxage=5)
Browser (public)  ──poll every ~5s──►  /api/lop/[id]/cup          (CDN-cached JSON, s-maxage=5)
Browser (staff)   ──form submit────►   Server Actions ("use server") ──► Drizzle ──► Supabase Postgres
                                                       │
                                                       └── Supabase Auth (session via middleware + cookies)

Driver page: /foerer/[uuid]  ── server-rendered, read-only, looked up by users.id
```

Key architectural rules (enforced in code):

1. **All DB access is server-side.** `src/db/client.ts` imports `server-only`; the
   browser never touches the database. This is *why* RLS is unnecessary for
   safety.
2. **Authorization happens in one place** — `src/server/authz.ts`, backed by the
   pure matrix in `src/domain/permissions.ts`. Every write and every protected
   read calls `requireCapability` / `requireRole` / `requireUser`.
3. **Every significant write audits in the same transaction** — `writeAudit(tx, …)`
   so the log can never drift from the data.
4. **Pure domain logic has no infra imports** — seeding/ranking/tie-break/bracket/
   placements live in `src/domain/` and are unit-tested in isolation.
5. **Validate every write with Zod** at the action boundary.
6. **Public read path is isolated from the staff write path** via cached API
   routes reading pre-computed cache columns.

---

## 4. Directory layout

```
src/
├── domain/            PURE logic — no DB/framework imports. Unit-tested.
│   ├── types.ts       Enums/types mirroring the data model (Role, Criterion, …)
│   ├── scoring.ts     runTotal, isApproved, bestRun (HKS/LKS)
│   ├── ranking.ts     rankDrivers — qualifying sort + exact HKS/LKS tie-break
│   ├── seeding.ts     seedingOrder(size) — recursive slot order for 4/8/16/32
│   ├── bracket.ts     buildBracket — full Battle tree (next/loser_next, byes)
│   ├── placements.ts  finalPlacements — 1st–4th + lower positions
│   ├── permissions.ts can(roles, capability) + ROLE_CAPABILITIES matrix
│   └── index.ts       Re-exports everything above
│
├── db/
│   ├── schema/        Drizzle schema
│   │   ├── enums.ts   pgEnum definitions
│   │   ├── tables.ts  All 13 tables + unique constraints
│   │   ├── relations.ts
│   │   └── index.ts   Barrel — imported as `@/db/schema`
│   ├── client.ts      Server-only lazy Drizzle client (pooler-tuned — see §11)
│   ├── migrate.ts     `db:migrate`  — applies drizzle/*.sql
│   ├── seed.ts        `db:seed`     — default classes + one admin
│   ├── seed-demo.ts   Optional fully-scored demo event
│   ├── check.ts       `db:check`    — verify connection + tables
│   ├── load-env.ts    Loads .env / .env.local for CLI scripts
│   └── verify*.ts     Ad-hoc verification helpers
│
├── server/            Server-only: actions, auth, queries, engine
│   ├── auth.ts        getCurrentUser() — resolves staff user + roles per request
│   ├── authz.ts       requireUser / requireCapability / requireRole, AuthzError
│   ├── audit.ts       writeAudit(tx, entry) + Tx type
│   ├── recompute.ts   recomputeRace(tx, raceId) — refresh cached scores/ranks
│   ├── cup-engine.ts  Persist bracket, advance winners, OMT, placements
│   ├── guards.ts      Deletion-blocked-on-results guards
│   ├── supabase.ts    Server Supabase client (session)
│   ├── supabase-admin.ts  Service-role client (invite flow)
│   ├── actions/       "use server" write actions (one file per domain area)
│   │   ├── _result.ts   ActionResult type + ok/fail/guardAction helper
│   │   ├── events.ts  classes.ts  races.ts  registrations.ts
│   │   ├── drivers.ts users.ts  auth-actions.ts
│   │   ├── scoring.ts qualifying.ts  cup.ts
│   └── queries/       Read helpers for pages + public endpoints
│       ├── leaderboard.ts  bracket.ts  scoring.ts  driver.ts
│
├── app/               Next.js App Router
│   ├── page.tsx       Landing
│   ├── layout.tsx  globals.css
│   ├── logg-inn/      Staff login
│   ├── foerer/[uuid]/ Public read-only driver page
│   ├── lop/[id]/      Public race views
│   │   ├── resultater/  Leaderboard (polls /api/.../resultater)
│   │   ├── kvalifisering/ Judge scoring screen
│   │   └── cup/         Public bracket (polls /api/.../cup)
│   ├── api/lop/[id]/
│   │   ├── resultater/route.ts  Cached leaderboard JSON
│   │   └── cup/route.ts         Cached bracket JSON
│   └── admin/         Staff CRUD area (role-gated)
│       ├── arrangementer/  events    lop/[id]/  races (+ cup admin)
│       ├── brukere/  users   forere/  drivers   klasser/  classes
│       ├── logg/     audit log        _components/  shared form widgets
│
├── copy/nb.ts         All Norwegian UI strings (single module)
├── lib/validation.ts  Shared Zod helpers (e.g. isUuid)
├── middleware.ts      Refreshes Supabase session cookie each request
└── test/server-only-stub.ts  Stubs `server-only` so server code is testable
```

Path alias: `@/` → `src/` (see `tsconfig.json` and `vitest.config.ts`).

---

## 5. Data model

Full details in [data_model.md](data_model.md); the live schema is
[src/db/schema/tables.ts](src/db/schema/tables.ts). 13 tables:

| # | Table | Purpose | Key uniqueness |
|---|---|---|---|
| 1 | `users` | **All** people (single table); roles decide access. `id` doubles as the driver-page token. `auth_user_id` links staff to Supabase auth. | `email`, `auth_user_id` |
| 2 | `user_roles` | Multi-role join. | PK (`user_id`, `role`) |
| 3 | `events` | Arrangement. | — |
| 4 | `event_staff` | Staff assigned to an event. | PK (`event_id`, `user_id`) |
| 5 | `classes` | Shared global class lookup (Pro, Semi-Pro…). | `name` |
| 6 | `races` | Belongs to an event; own qualifying + cup; per-race scoring maxima, status, `qualifying_locked`, `leaderboard_status`. | — |
| 7 | `race_officials` | Judge assignments. One judge per line/angle/style; many `battle`. | `(race,duty)` where duty≠battle; `(race,user,duty)` |
| 8 | `registrations` | Driver↔race; holds **cached** `qualifying_score`, `qualifying_rank`, `seed`, `eligible`, `final_place`. | `(race_id, user_id)` |
| 9 | `qualifying_runs` | 2 runs per registration; cached `total`, `approved`, `status`. | `(registration_id, run_number)` |
| 10 | `run_scores` | One row per (run, criterion), entered+confirmed by the responsible judge. | `(run_id, criterion)` |
| 11 | `cups` | One per race. | `race_id` |
| 12 | `battles` | Fixed bracket-tree nodes incl. bronsefinale; `next_battle_id`/`next_slot`, `loser_next_battle_id`/`loser_next_slot`, `omt_count`, `status`. | `(cup_id, round, position)` |
| 13 | `audit_logs` | Append-only; actor/action/entity/details/timestamp. | — |

### Enums (`src/db/schema/enums.ts`)

`role` (admin/judge/secretary/driver) · `event_status` (upcoming/ongoing/finished)
· `race_status` (registration/qualifying/cup/finished) · `cup_size` (4/8/16/32) ·
`criterion` (line/angle/style) · `official_duty` (line/angle/style/battle) ·
`run_status` (pending/complete) · `leaderboard_status`
(in_progress/unofficial/official) · `battle_round`
(top32/top16/quarterfinal/semifinal/final/bronsefinal) · `battle_status`
(pending/omt/decided/bye) · `advance_slot` (a/b) · `user_status`
(invited/active).

### Cached ("derived") columns — the recompute rule

For the 2000-viewer read path, derived values are **stored** on
`registrations`/`qualifying_runs` and read directly by public endpoints (never
recomputed per request). They are refreshed by **`recomputeRace(tx, raceId)`**
([src/server/recompute.ts](src/server/recompute.ts)) inside the same transaction
as any write that affects them:

| Cached value | Rule | Refresh trigger |
|---|---|---|
| `qualifying_runs.total`/`.approved` | Σ criterion scores; approved ⇔ total > 0 | run complete / score edited |
| `registrations.qualifying_score` | max total over approved runs (HKS) | any of the driver's runs changes |
| `registrations.qualifying_rank` | sort by score + HKS/LKS tie-break | scores change |
| `registrations.eligible` | has ≥1 approved run | run approval changes |
| `registrations.seed` | = rank at generation (top N) | bracket generate/regenerate |
| `registrations.final_place` | from battle outcomes | battle decided / cup finished |

---

## 6. Domain logic (pure, `src/domain/`)

The risky algorithms, fully unit-tested with **no DB/framework imports**. When
changing scoring, seeding, or bracket rules, change these functions and their
tests first.

- **Scoring** — `runTotal(scores)`, `isApproved(total)` (approved ⇔ > 0),
  `bestRun(runs)` → HKS (keeps LKS for tie-break).
- **Ranking** — `rankDrivers(drivers)` sorts by qualifying score with the exact
  §10 tie-break: HKS → LKS → HKS line → HKS angle → HKS style → LKS line → LKS
  angle → LKS style.
- **Seeding** — `seedingOrder(size)`: start `[1,2]`; to expand to `2n`, replace
  each seed `s` with `(s, 2n+1−s)`. Every first-round pair sums to `N+1`. Seeds
  #1/#2 land in opposite halves (meet only in the final).
- **Bracket** — `buildBracket(rankedDrivers, cupSize)` produces the full `Battle`
  tree: winner path (`next_battle`/`next_slot`), semifinal-loser path into the
  **bronsefinale** (`loser_next_battle`/`loser_next_slot`), and **byes** for empty
  high seeds. A Top-32 seeded with 16 drivers collapses its first round to byes.
- **Placements** — `finalPlacements(resolvedBracket)`: final winner = 1st,
  loser = 2nd, bronsefinale winner = 3rd, loser = 4th; lower positions (5–8…) by
  how far a driver advanced, ordered within a round by qualifying position (§11).
- **Permissions** — `can(roles, capability)`; access is the **union** of a user's
  roles.

---

## 7. Auth & authorization

### Staff auth (Supabase)
- Staff (admin/judge/secretary) log in with **email + password** via Supabase
  Auth. New staff are created by an admin/secretary and **invited** to set a
  password (uses `SUPABASE_SERVICE_ROLE_KEY` in
  [src/server/supabase-admin.ts](src/server/supabase-admin.ts)).
- [src/middleware.ts](src/middleware.ts) refreshes the session cookie on every
  request (no-op when Supabase env is absent, so bare local dev still works).
- [src/server/auth.ts](src/server/auth.ts) `getCurrentUser()` (React
  `cache`-memoised per request) resolves the Supabase user → app `users` row via
  `auth_user_id`, then loads roles from `user_roles`.
- **Dev shortcut:** if `DEV_ADMIN_EMAIL` is set and `NEXT_PUBLIC_SUPABASE_URL` is
  empty (and not production), the app acts as that seeded admin — lets you browse
  admin with only a `DATABASE_URL`. Never set in production.

### Drivers
- Drivers do **not** authenticate. Their page is a public route
  `/foerer/[uuid]` resolved by `users.id`. The UUID is the secret; the page is
  fully read-only.

### The one authorization point ([src/server/authz.ts](src/server/authz.ts))
- `requireUser()` → throws `AuthzError(401)` if not logged in.
- `requireCapability(capability)` → checks the pure matrix; throws
  `AuthzError(403)` on denial.
- `requireRole(...roles)` → union check.
- `AuthzError` carries an HTTP-ish `status`; `guardAction` converts it into a
  friendly Norwegian `ActionResult`.

### Permission matrix (`src/domain/permissions.ts`)

| Capability | Admin | Secretary | Judge | Driver |
|---|:--:|:--:|:--:|:--:|
| events.create (create/delete events) | ✓ | | | |
| events.edit | ✓ | ✓ | | |
| races.manage | ✓ | ✓ | | |
| raceOfficials.assign | ✓ | ✓ | | |
| users.manageNonAdmin | ✓ | ✓ | | |
| users.manageAdmin (create admins / grant admin) | ✓ | | | |
| drivers.manage | ✓ | ✓ | | |
| scores.enter (own criterion — enforced separately) | ✓ | | ✓ | |
| leaderboard.publish | ✓ | ✓ | | |
| qualifying.lock (lock / generate bracket) | ✓ | ✓ | | |
| qualifying.unlock (unlock / regenerate — destructive) | ✓ | | | |
| battle.decide | ✓ | | ✓ | |
| auditLog.view | ✓ | | | |

`scores.enter` grants the *capability*; **which criterion** a judge may score is
enforced per-race in `scoring.ts` (`mayScore` checks `race_officials` for the
matching duty; admins may score any).

---

## 8. Server actions (write path)

Pattern (see [src/server/actions/scoring.ts](src/server/actions/scoring.ts) as
the canonical example). **Every write action follows this shape:**

```ts
"use server";
export async function doThing(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {          // 1. wrap: converts AuthzError → friendly msg
    const user = await requireCapability("…");  // 2. authorize (single point)
    const parsed = schema.safeParse({…});        // 3. validate with Zod
    if (!parsed.success) return fail(nb.errors.invalidInput);
    // 4. business-rule checks (locked? over max? blocked-on-results?)
    await db.transaction(async (tx) => {         // 5. write + recompute + audit in ONE tx
      await tx.insert(...)/.update(...);
      await recomputeRace(tx, raceId);           //   (when scores/ranks affected)
      await writeAudit(tx, { actorUserId: user.id, action: "…", entityType: "…", entityId, details });
    });
    revalidatePath("…");                         // 6. refresh affected page(s)
    return ok("…");
  });
}
```

- **`ActionResult`** (`{ ok:true } | { ok:false, error }`) is `useFormState`-friendly
  (`src/server/actions/_result.ts`). `guardAction` re-throws Next's `redirect()`/
  `notFound()` control-flow errors (they carry a `digest`).
- **Audit actions** are dotted strings, e.g. `score.save`, `score.confirm`,
  `qualifying.lock`, `bracket.generate`, `bracket.regenerate`, `battle.decide`,
  `leaderboard.publish`, `event.delete`.
- **Deletion-blocked-on-results** is enforced by guards in
  [src/server/guards.ts](src/server/guards.ts): an event/race/driver with any
  `run_scores` or decided `battle` cannot be deleted.

Action files by area: `events`, `classes`, `races`, `registrations`, `drivers`,
`users`, `auth-actions` (login/invite/set-password), `scoring` (judge scores),
`qualifying` (lock/unlock/publish), `cup` (generate/regenerate/decide battle).

---

## 9. Public read path (the 2000-viewer design)

- Two cached JSON endpoints per race:
  - `GET /api/lop/[id]/resultater` → `getLeaderboard(raceId)`
  - `GET /api/lop/[id]/cup` → bracket state
- Both send `Cache-Control: public, s-maxage=5, stale-while-revalidate=10`. With
  2000 viewers polling ~every 5s, the CDN collapses this to **~1 origin hit per
  race per 5s**.
- They read **cached columns** (`qualifying_score`, `rank`, `seed`, `final_place`,
  run `total`/`approved`) — no per-request recompute.
- Public pages (`/lop/[id]/resultater`, `/lop/[id]/cup`) poll their endpoint every
  few seconds and re-render. Client components: `leaderboard-view.tsx`,
  `bracket-view.tsx`.
- Endpoints validate the id with `isUuid` and 404 on unknown/invalid ids.

**Leaderboard rules:** a run's total appears only once **complete** (all three
judges entered *and* confirmed). Board state is `in_progress` → `unofficial` →
`official`; publishing is a separate admin/secretary action, and editing a
published result reverts it to `unofficial` (see `revertOfficialIfNeeded` in
scoring). Lock and official are **independent** — neither requires the other.

---

## 10. Race & event lifecycle

```
Race.status:  registration ──► qualifying ──► cup ──► finished

Qualifying:  judges score each criterion → confirm → run "complete" when all 3
             confirmed → recompute totals/ranks → lock qualifying (admin/secretary)
Cup:         generate bracket from locked ranking (buildBracket → persist Cup +
             Battles, byes handled) → decide battles (A / B / OMT, max 1 OMT) →
             winner advances via next_battle; semi losers → bronsefinale →
             final placements when finished
Corrections: admin can unlock (confirm) → fix scores → re-lock; admin can
             regenerate bracket (confirm) → discards battles → re-seed
```

Cup engine: [src/server/cup-engine.ts](src/server/cup-engine.ts) (persist tree,
advance winners, OMT handling, compute placements). Battle admin UI:
`src/app/admin/lop/[id]/cup/battle-admin.tsx`.

---

## 11. Database connection — IMPORTANT operational gotcha

[src/db/client.ts](src/db/client.ts) is tuned for Supabase's **transaction pooler
(pgbouncer, port 6543)** under Vercel serverless. Lessons already baked in from
production incidents (see git history) — **do not regress these**:

- `prepare: false` — pgbouncer transaction mode forbids prepared statements.
- `max: 3` — small per-instance pool. Vercel freezes/kills instances holding open
  sockets, and the pooler pins one backend per socket; a large `max` lets a few
  instances exhaust the pooler → queries queue → 500s ("max client connections
  reached").
- `idle_timeout`, `max_lifetime`, `connect_timeout`,
  `idle_in_transaction_session_timeout` — drop/recycle stale sockets and reap
  transactions left open by a frozen instance.
- The client is **memoised on `globalThis`** — without this, every `db` access
  would open a fresh pool and exhaust the pooler.
- **Never pipeline many queries onto one connection.** postgres.js pipelines when
  concurrent queries exceed free connections, and a wide pipeline stalls over the
  transaction pooler. Keep page reads **sequential** (or ≤ a couple parallel).
  (This is why commit `fda7b38` switched parallel DB queries to sequential.)

Use the **Session pooler** connection string in `DATABASE_URL`.

---

## 12. Configuration & environment variables

From [DEPLOY.md](DEPLOY.md). Server-only secrets except the two `NEXT_PUBLIC_`
values.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres (**Session pooler** string; app sets `prepare:false`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (staff auth). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` also accepted). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; admin invite flow. |
| `DEV_ADMIN_EMAIL` | **Local dev only.** Act as this seeded admin when Supabase auth is unconfigured. Never in production. |

Local env files: `.env` / `.env.local` (loaded for CLI scripts by
`src/db/load-env.ts`). `.nvmrc` pins Node 20.

Automated dependency updates via Dependabot (`.github/dependabot.yml`).

---

## 13. Local development & scripts

```bash
nvm use                 # Node 20
npm install
npm run db:migrate      # apply drizzle/*.sql to the database
npm run db:seed         # default classes (Pro, Semi-Pro) + one admin user
npm run db:check        # verify connection + tables
npm run dev             # http://localhost:3000
```

All npm scripts (`package.json`):

| Script | Does |
|---|---|
| `dev` / `build` / `start` | Next.js dev / production build / serve |
| `lint` | `next lint` |
| `typecheck` | `tsc --noEmit` |
| `test` / `test:watch` | Vitest (unit + PGlite integration) |
| `db:generate` | `drizzle-kit generate` — create a migration from schema changes |
| `db:migrate` | apply `drizzle/*.sql` (via `tsx src/db/migrate.ts`) |
| `db:studio` | `drizzle-kit studio` — DB GUI |
| `db:seed` | seed classes + admin |
| `db:check` | verify connection + tables |

Optional: `npx tsx src/db/seed-demo.ts` creates a fully-scored demo event
(deletable from the admin UI afterwards).

**Bare local setup** (no Supabase): set `DEV_ADMIN_EMAIL=admin@example.com` and
leave `NEXT_PUBLIC_SUPABASE_URL` empty in `.env.local` to browse admin as the
seeded admin.

### Changing the schema
1. Edit `src/db/schema/tables.ts` (and `enums.ts`/`relations.ts` as needed).
2. `npm run db:generate` → new SQL in `drizzle/`.
3. `npm run db:migrate` locally; run migrate against production `DATABASE_URL` on
   deploy (**migrations are not automatic**).

---

## 14. Testing

- **Vitest**, Node environment, `src/**/*.test.ts`.
- **Pure domain tests** (fast, no infra): `scoring`, `ranking`, `seeding`,
  `bracket`, `placements`, `permissions`, `lib/validation`. These must cover, at
  minimum: `seedingOrder(16)`/`(32)` match the spec exactly; every tie-break level
  resolves; a 32-bracket with 16 drivers collapses its first round to byes;
  bronsefinale fed by the two semifinal losers.
- **PGlite integration tests** (in-memory Postgres): `db/schema.test.ts`,
  `server/recompute.test.ts`, `server/cup-engine.test.ts` — exercise real schema
  constraints, the recompute pipeline, and the cup engine.
- `server-only` is stubbed via `src/test/server-only-stub.ts` (aliased in
  `vitest.config.ts`) so server modules are importable under test.

**Definition of done for any change:** `npm run typecheck`, `npm test`, and
`npm run build` all pass, plus the behaviour is manually verified.

---

## 15. Deployment (Vercel + Supabase)

From [DEPLOY.md](DEPLOY.md):

1. Import the repo in Vercel (framework auto-detected as Next.js).
2. Add all env vars (§12) under **Project → Settings → Environment Variables**.
3. Deploy. **Run `npm run db:migrate` against production `DATABASE_URL` on every
   schema change** (locally or in CI) — not automatic.
4. Confirm Supabase **backup retention** on your tier and that the plan covers the
   ~2000-viewer read peak. Public endpoints are CDN-cached (`s-maxage=5`), so the
   origin sees ~1 hit per race per 5s.

**Staff auth in production:** link each app user to their Supabase auth identity
via `users.auth_user_id`. The invite flow (create → invite → set password) uses
`SUPABASE_SERVICE_ROLE_KEY`.

**Full lifecycle smoke test:** create event → race → assign three criterion
judges → add & register drivers → judges score & confirm → lock qualifying →
publish leaderboard → generate bracket → decide battles → podium → driver page
shows history.

---

## 16. Conventions & rules for new development

- **Norwegian UI only.** All user-facing strings go in
  [src/copy/nb.ts](src/copy/nb.ts) (`nb.*`). No i18n framework. English terms may
  appear as bracketed code comments.
- **Route slugs are Norwegian**: `/arrangementer` (events), `/lop` (races),
  `/brukere` (users), `/forere` (drivers), `/klasser` (classes), `/logg` (audit),
  `/kvalifisering`, `/resultater`, `/cup`, `/foerer/[uuid]`, `/logg-inn`.
- **New write action?** Follow the §8 pattern exactly: `guardAction` →
  `requireCapability` → Zod → transaction with `recomputeRace` (if scores/ranks)
  + `writeAudit` → `revalidatePath` → `ok/fail`.
- **New capability?** Add it to the `Capability` union and role arrays in
  `src/domain/permissions.ts` (and test), then reference it via
  `requireCapability`.
- **New risky algorithm?** Put it in `src/domain/` as a pure function with tests
  before wiring any DB/UI.
- **Public data?** Serve it from a cached `/api/...` route reading cached columns;
  never expose the DB or run heavy recompute per request.
- **Deleting things?** Gate on results via `src/server/guards.ts`.
- **Parameterized queries only** (Drizzle default) — never string-build SQL.
- **Secrets stay server-side** — anything importing `@/db/client` or Supabase
  service keys must be server-only.

---

## 17. Quick reference — where things live

| I want to… | Go to |
|---|---|
| Change scoring/tie-break/seeding math | `src/domain/*.ts` (+ tests) |
| Change who can do what | `src/domain/permissions.ts` |
| Add/alter a table | `src/db/schema/tables.ts` → `db:generate` → `db:migrate` |
| Add a staff write action | `src/server/actions/*.ts` |
| Change what the public leaderboard/bracket returns | `src/server/queries/{leaderboard,bracket}.ts` + `src/app/api/lop/[id]/*` |
| Refresh derived/cached values | `src/server/recompute.ts` |
| Cup progression / battle advance / OMT | `src/server/cup-engine.ts` |
| Change UI text | `src/copy/nb.ts` |
| DB connection / pooler tuning | `src/db/client.ts` (read §11 first) |
| Audit logging | `src/server/audit.ts` |
| Env vars / deploy | `DEPLOY.md` + §12/§15 here |

---

*Behavioural questions → [acceptance_criteria.md](acceptance_criteria.md) is the
source of truth. This document reflects the implemented MVP (milestones M0–M8).*
