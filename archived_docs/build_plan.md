# Build plan & milestones [Byggeplan]

> **For a fresh AI coding session: read this first.** This sequences the whole
> MVP. Do the milestones **in order** — each depends on the ones before. Finish a
> milestone's *Definition of done* (and commit) before starting the next.

## Read before coding

1. [acceptance_criteria.md](acceptance_criteria.md) — what to build (user stories + ACs). The source of truth.
2. [data_model.md](data_model.md) — entities, fields, constraints.
3. [tech_stack.md](tech_stack.md) — how to build it and the safety/simplicity rules.

## Ground rules (apply to every milestone)

- **Stack:** TypeScript · Next.js · PostgreSQL (Supabase) · Drizzle · Zod ·
  Vercel. Nothing else unless a milestone says so.
- **Boring on purpose:** one app, one database. No WebSockets, no realtime
  service, no queues, no GraphQL, no RLS. (See tech_stack "Safety & simplicity".)
- **Authorization in one place:** server-side, checked against the user's role(s)
  on every write and protected read. All DB access is server-side (browser never
  touches the DB).
- **Validate input with Zod** at every write boundary.
- **Audit log** every significant write, in the same transaction as the write.
- **Pure logic stays pure:** seeding/ranking/tie-break/placement are plain
  functions with no DB/framework imports, unit-tested in isolation.
- **Language:** all UI copy is **Norwegian**; keep strings in one `nb` module.
- **MVP scope:** build everything in the ACs **except** email notifications and
  password reset (both explicitly non-MVP). Driver page is **read-only**.
- **Definition of done includes:** typechecks, tests pass, and the milestone's
  behavior is manually verified before moving on.

## Dependency order

```
M0 Bootstrap
      │
M1 Domain logic (pure) ──┐
      │                  │
M2 Schema & migrations   │
      │                  │
M3 Auth & roles          │
      │                  │
M4 Admin CRUD ───────────┤
      │                  │
M5 Qualifying + leaderboard (uses M1 ranking)
      │
M6 Cup / bracket / battles (uses M1 seeding + placement)
      │
M7 Driver page
      │
M8 Hardening & deploy
```

---

## M0 — Project bootstrap

**Goal:** a running skeleton with the toolchain wired up.

**Build**
- Init git repo + Next.js (TypeScript, App Router) + ESLint/Prettier.
- Add Vitest, Zod, Drizzle + `drizzle-kit`, `postgres`/`pg` driver.
- Create a Supabase project; capture DB connection string + auth keys in
  `.env` (server-only; never exposed to the browser).
- Folder layout, e.g.: `src/domain` (pure logic), `src/db` (schema, client),
  `src/server` (actions, auth, authz), `src/app` (routes), `src/copy/nb.ts`.
- A trivial `/` page that renders and confirms the app boots.

**Definition of done**
- `npm run dev` serves the app; `npm test` runs (even with 0 tests); `npm run
  build` succeeds. DB connection verified from a server script.

---

## M1 — Domain logic (pure TypeScript, no infra)

**Goal:** the risky algorithms, fully unit-tested, before any DB or UI exists.

**Build** (in `src/domain`, no framework/DB imports)
- Domain types/enums mirroring [data_model.md](data_model.md) (role, criterion,
  cup_size, battle_round, battle_status, …).
- `runTotal(scores)` and `isApproved(total)` (approved ⇔ total > 0).
- `bestRun(runs)` → HKS; keep LKS for tie-break.
- `rankDrivers(drivers)` → ordering by qualifying score with the **exact HKS/LKS
  tie-break** (Qualifying AC 8).
- `seedingOrder(size)` → recursive slot order for 4/8/16/32 (Bracket seeding AC 3).
- `buildBracket(rankedDrivers, cupSize)` → full `Battle` tree: `next_battle`
  (winner) + `loser_next_battle` for semis → bronsefinale, and **byes** for empty
  high seeds (Bracket seeding AC 6–7).
- `finalPlacements(resolvedBracket)` → 1st/2nd/3rd/4th + 5–8… ordered by
  qualifying position (Cup AC 11).

**Definition of done**
- Vitest covers, at minimum:
  - `seedingOrder(16)` and `seedingOrder(32)` match the tables in the spec
    **exactly**.
  - Tie-break resolves each level of the HKS/LKS table.
  - A 32-bracket seeded with 16 drivers collapses its first round to byes
    (matches the reference sheet).
  - Bronsefinale is fed by the two semifinal losers.

---

## M2 — Database schema & migrations (Drizzle)

**Goal:** the data model as real tables.

**Build**
- Drizzle schema in `src/db/schema` for all entities in
  [data_model.md](data_model.md): User, UserRole, Event, EventStaff, Class, Race,
  RaceOfficial, Registration, QualifyingRun, RunScore, Cup, Battle, AuditLog.
- Enforce the **unique constraints** listed there (e.g. one judge per
  `(race_id, duty)` for line/angle/style; `(run_id, criterion)`;
  `(race_id, user_id)` registration; `(cup_id, round, position)`).
- Generate + apply migrations with `drizzle-kit`.
- A **seed script** for local dev: a default class list (Pro, Semi-Pro), and one
  admin user.

**Definition of done**
- Migrations apply cleanly to Supabase; `drizzle-kit studio` shows all tables;
  seed script runs; constraints verified (a duplicate insert is rejected).

---

## M3 — Auth & roles

**Goal:** staff can log in; access is role-gated; drivers resolve by UUID.

**Build**
- Supabase Auth for staff (email + password). **Invite flow**: admin creates a
  user → invite → user sets password (Authentication ACs).
- Load the user's role(s) from `user_role` on each request.
- `requireRole(...)` server helper = the single authorization point. Encode the
  permission matrix (Roles & permissions) and the secretary restrictions.
- Driver public route `/foerer/[uuid]` that resolves a user by `id` (read-only
  shell for now).

**Definition of done**
- Staff login works; a role-gated server action rejects an unauthorized role with
  a clear message; the driver UUID route resolves the right user (and 404s on a
  bad UUID).

---

## M4 — Admin CRUD

**Goal:** manage all the setup data, per the permission matrix, with audit logging.

**Build** (server actions + simple forms; Zod on every input)
- **Classes** — manage the shared list (Races AC 9).
- **Events** — create/edit/delete; **block delete when results exist**.
- **Races** — name, class, cup size, scoring maxima (defaults 40/30/30, style
  15/15), status; assign **three criterion judges** + battle judges
  (RaceOfficial); block delete when results exist.
- **Users** — create/edit, multi-select roles, invite; **secretary cannot create
  admins / grant admin role**.
- **Drivers** — create/edit/delete (club, car, start number, dummy-number flag);
  block delete when the driver has results.
- **Registrations** — register a driver to one or more races (per race).
- Weave **audit-log writes** into every create/edit/delete.

**Definition of done**
- Every entity is manageable per the matrix (admin vs secretary); deletion is
  blocked where results exist; each write produces an audit entry.

---

## M5 — Qualifying & public leaderboard

**Goal:** judges score; the leaderboard ranks and can be published.

**Build**
- **Judge scoring screen** (own device): a judge enters **only their criterion**
  for a run, then **confirms** it. A run becomes **complete** when all three
  criterion scores are confirmed (Qualifying AC 5).
- Recompute `run.total/approved`, and `registration.qualifying_score/rank/
  eligible` using the **M1** functions.
- **Lock / unlock** qualifying (lock: admin or secretary; unlock: admin only),
  with confirmation.
- **Public leaderboard**: a cached read endpoint (`s-maxage≈5`) + a page that
  **polls** it every few seconds. Columns per Leaderboard AC 2 (rank, start
  number, first+last name, club, car, per-run line/angle/style, run totals, best
  score). Shows unofficial/official state.
- **Publish as official** (admin/secretary); changing a published result reverts
  it to unofficial (Leaderboard AC 5–6).

**Definition of done**
- Three judges score a run → it completes → totals appear on the leaderboard;
  ranking + tie-break correct; lock/unlock works; publish flips to official and a
  later edit reverts to unofficial.

---

## M6 — Cup / bracket / battles

**Goal:** run the knockout from locked qualifying to a podium.

**Build**
- **Generate bracket** after qualifying is locked: call **M1** `buildBracket`,
  persist `Cup` + `Battle` rows (byes handled).
- **Battle admin**: set outcome — driver A / driver B / **OMT** (max 1), then a
  winner must be chosen. Winner advances via `next_battle`; semifinal losers feed
  the **bronsefinale**.
- **Regenerate bracket** (admin): confirm → discard this cup's battles → re-seed
  from current ranking.
- Compute **final placements** (M1) when the cup finishes.
- **Public bracket**: cached endpoint + polling page showing battles, OMT status,
  and final placements/podium (Public cup view ACs).

**Definition of done**
- Generate from a locked qualifying; play battles through to 1st–4th + lower
  placements; OMT capped at 1; regenerate wipes and re-seeds; public bracket
  matches the admin state within the cache TTL.

---

## M7 — Driver page

**Goal:** the read-only driver view.

**Build**
- Flesh out `/foerer/[uuid]`: contact info (name, email, phone, club, car, start
  number); **upcoming races**; **historic races** with qualifying result (score +
  rank) and cup result (how far they advanced / final placement). Fully
  **read-only** (Driver page ACs). History spans events via Registration.

**Definition of done**
- A driver with registrations across multiple events sees correct upcoming +
  historic results; nothing on the page is editable.

---

## M8 — Hardening & deploy

**Goal:** ship it, safely.

**Build**
- Zod validation and sensible error/empty states across all forms and endpoints.
- Mobile check: judge scoring trackside + public viewing (Non-functional AC 3).
- Norwegian copy pass (consistent `nb` strings).
- Enable **Renovate/Dependabot**; confirm Supabase **backup retention** and that
  the **tier covers a 2000-viewer peak** (bandwidth/DB).
- Deploy to **Vercel** + **Supabase**; smoke-test a full event lifecycle
  end-to-end (create event → race → register → qualify → publish → cup → podium →
  driver page).

**Definition of done**
- Deployed and reachable over HTTPS; the full lifecycle smoke test passes on the
  deployed environment; public pages stay responsive under repeated polling.

---

## Explicitly out of scope (do NOT build)

- E-mail notifications (spec: not MVP).
- Password reset via email (spec: not MVP).
- Driver self-editing of their own data (driver page is read-only).
- Row-Level Security, realtime/WebSockets, caching-revalidation machinery
  (deliberately excluded — see tech_stack).
