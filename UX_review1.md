# UX review 1 — Event-centric navigation

> **Status:** proposal for iteration (v2). Nothing here is built yet. This
> document describes *where things should live and how you move between them*,
> not visual styling. Grounded in the current code so we can plan the migration
> concretely. v2 folds in the review decisions — see the changelog at the bottom.

---

## 1. The problem, concretely

Running a race today means walking the whole tree every time:

```
Arrangementer → (pick event) → scroll past the edit form to the race table →
(pick race) → click "Scoring"
```

Two things then go wrong:

1. **You leave the admin shell entirely.** The scoring screen is a *public*
   route — [`/lop/[id]/kvalifisering`](src/app/lop/[id]/kvalifisering/page.tsx) —
   rendered outside [`src/app/admin/layout.tsx`](src/app/admin/layout.tsx). So the
   top nav and every "tab" vanish. Same for the public leaderboard and bracket
   views.
2. **The "tabs" were never tabs.** `Påmelding · Scoring · Kvalifisering ·
   Finaler-admin` is a single line of muted links on the race page
   ([page.tsx:98–103](src/app/admin/lop/[id]/page.tsx#L98-L103)). They don't
   persist, don't show which one you're on, and half of them jump you out of
   `/admin`.

There is also **no notion of "the event I'm working on."** Every screen is
reached from the global list, so context is re-established by hand on each visit.

---

## 2. Goal

Model the real workflow: **you work inside one event at a time, and switching is
rare.** So:

- **Land on a Dashboard** that is an event picker (plus the rarely-touched global
  lists: Arrangementer, Klasser, all drivers, all users, global log).
- **Select an event once** → everything after that is scoped to it, with a stable
  top bar and stable sub-tabs. You never lose your place.
- **Switch events** only by returning to the Dashboard — deliberately a small
  speed bump, because it's a rare action.

---

## 3. Proposed information architecture

### Top bar (inside an event)

Replace the current global bar with an **event-scoped** one:

```
[Event name ▾]   Løp   Førere   Brukere   Logg   Innstillinger      Ola Nordmann · Logg ut
   └ click to return to Dashboard / switch event
```

| Item | Scope | Contents |
|---|---|---|
| **Dashboard** (via the event-name button) | global | Event picker, create event, **Arrangementer**, **Klasser**, **Alle førere**, **Alle brukere**, **Global logg** |
| **Løp** | this event | The event's races → each opens the **race workspace** (§5) |
| **Førere** | this event | Read-only roster of drivers registered across this event's races; "Ny fører" shortcut into the global pool |
| **Brukere** | this event | Staff assigned to this event via `event_staff`; **assign/remove staff here** |
| **Logg** | this event | Audit entries filtered to this event |
| **Innstillinger** | this event | Event edit (navn/datoer/status), delete event |

This implements the requested bar (`Dashboard | Løp | Førere | Brukere | Logg`),
plus an **Innstillinger** tab for event edit/delete, with **Arrangementer /
Klasser / all-drivers / all-users / global-log** moved onto the Dashboard.

### Global vs. event-scoped — both are kept

Every list exists in two forms; we **do not replace** the global page with the
event one:

- **Førere** — event tab = read-only roster over `registrations` for this event's
  races. Global `/admin/forere` stays the full driver CRUD (klubb/bil/startnr,
  edit/delete). Actual registration is per-race and stays in the **Påmelding**
  tab (§5); the event Førere tab does not register/unregister. A **"Ny fører"**
  button on the event tab creates into the global pool (reuse `createDriver`) so
  walk-up entries don't require a Dashboard round-trip.
- **Brukere** — event tab = staff on this event via `event_staff`, **including
  the assign/remove UI** (this write path does not exist yet — see §7 phase 6 and
  the risk note). Global `/admin/brukere` stays the full user + role CRUD.
- **Logg** — event tab = `audit_logs` filtered to this event (see §4.1 for the
  schema change this needs). Global `/admin/logg` stays on the Dashboard for
  cross-event / security review.

### Why the split maps onto real tables

- **Førere (event)** → `registrations` (drivers registered to this event's
  races), read-only roster.
- **Brukere (event)** → `event_staff` (staff assigned to this event) + a new
  assign/remove action.
- **Logg (event)** → `audit_logs` filtered by `event_id` (new column, §4.1).

Data split for staff-vs-driver already exists
([admin/page.tsx:8–9](src/app/admin/page.tsx#L8-L9)).

---

## 4. Route map (old → new)

The cleanest fix for "never lose context" is to **put the event id in the URL**
and add a per-event layout that renders the bar + tabs. Context then survives
refresh, back button, and bookmarking — no hidden global state. (Open Q4: URL,
confirmed.)

```
/admin/e/[eventId]/…            ← new event-scoped segment with its own layout.tsx
```

| Today | Proposed | Notes |
|---|---|---|
| `/admin` (card grid) | `/admin` → **Dashboard** | Event picker + links to all global lists |
| `/admin/arrangementer` | `/admin` (folded into Dashboard) | Event list + create |
| `/admin/arrangementer/[id]` | `/admin/e/[eventId]` → **Løp** tab | Event landing = its race list + create-race |
| — (event edit/delete lived on the detail page) | `/admin/e/[eventId]/innstillinger` | **New** Innstillinger tab (event edit + delete) |
| `/admin/lop/[id]` | `/admin/e/[eventId]/lop/[raceId]` | Race workspace (§5) |
| **`/lop/[id]/kvalifisering`** (public!) | `/admin/e/[eventId]/lop/[raceId]/scoring` | **Moves into the admin shell** — this is the core fix |
| `/admin/lop/[id]/cup` | `/admin/e/[eventId]/lop/[raceId]/finaler` | Bracket admin as a tab |
| `/admin/forere` | **stays** (global CRUD) **+** `/admin/e/[eventId]/forere` | Keep both — global pool *and* event roster |
| `/admin/brukere` | **stays** (global CRUD) **+** `/admin/e/[eventId]/brukere` | Keep both — global accounts *and* event staff |
| `/admin/klasser` | `/admin/klasser` (linked from Dashboard) | Global, rarely touched, unchanged |
| `/admin/logg` | **stays** (global) **+** `/admin/e/[eventId]/logg` | Keep both — global log *and* event-filtered |

**Public routes are unchanged** and stay outside `/admin`:
`/lop/[id]/resultater` (leaderboard), `/lop/[id]/cup` (bracket),
`/foerer/[uuid]` (driver page). Staff link *out* to these for the audience view;
staff *data entry* happens inside `/admin`.

> **Convenience cookie (optional):** store `lastEventId` when an event is opened,
> so the Dashboard can offer "Fortsett i «Vindrift 2026»" and a fresh login can
> jump straight back in. The URL stays the source of truth; the cookie is only a
> shortcut.

### 4.1 Required schema change — `audit_logs.event_id`

Event-scoped Logg is **not** a pure read. [`audit_logs`](src/db/schema/tables.ts#L278)
has only `entityType` (free text) and `entityId` — no event reference. Filtering
to one event would otherwise mean assembling entity-id sets across races,
registrations, qualifying_runs, run_scores, cup_matches, race_officials,
event_staff and the event row, then matching a free-text type string. Instead:

- Add `event_id uuid` (nullable, FK → `events`, `on delete set null`) to
  `audit_logs`.
- Set it at write time in the audit helper (most writes already know the event or
  can derive it from the race).
- Backfill existing rows where the event is derivable; leave the rest null.
- Event Logg = `where event_id = :eventId`; global Logg = unchanged.

This means phases 1–5 need no schema change, but **phase 6 does** (this column).

### 4.2 `revalidatePath` migration (do not skip)

Every mutating action revalidates **literal** paths that are moving:
[qualifying.ts:36–37](src/server/actions/qualifying.ts#L36-L37),
[races.ts](src/server/actions/races.ts),
[cup.ts](src/server/actions/cup.ts),
[registrations.ts](src/server/actions/registrations.ts),
[events.ts](src/server/actions/events.ts). Under the new nesting these become
`/admin/e/[eventId]/lop/[raceId]/…`, and actions that today receive only
`raceId` (qualifying, cup, registrations) must **look up `eventId`** to build the
path. If missed, mutations succeed but the screen shows stale data. Treat this as
a per-phase checklist item, not an afterthought.

---

## 5. The race workspace — real persistent tabs

Opening a race gives a workspace whose tabs live in a **shared layout**
(`/admin/e/[eventId]/lop/[raceId]/layout.tsx`) so they persist across every
sub-screen and highlight the active one:

```
← Løp   |   Pro 1  ·  Kvalifisering (status)              [Se offentlig tavle ↗]
─────────────────────────────────────────────────────────────────────────────
  Påmelding    Scoring    Kvalifisering    Finaler
  ─────────
  (active tab content)
```

| Tab | What it is | Source today |
|---|---|---|
| **Påmelding** | Register drivers, assign judges, race settings, lock/publish | [admin/lop/[id]/page.tsx](src/app/admin/lop/[id]/page.tsx) |
| **Scoring** | Judge score entry grid | [lop/[id]/kvalifisering/page.tsx](src/app/lop/[id]/kvalifisering/page.tsx) — **relocated in** |
| **Kvalifisering** | Leaderboard + lock/publish controls | wraps [queries/leaderboard.ts](src/server/queries/leaderboard.ts) |
| **Finaler** | Bracket admin (generate/regenerate/decide) | [admin/lop/[id]/cup/page.tsx](src/app/admin/lop/[id]/cup/page.tsx) |

Because the whole workspace now sits under the admin layout, the top bar **and**
these tabs stay visible on every screen — including scoring. That is the change
that fixes "once scoring is opened, I lose the tabs and where I am."

> **Naming caution (open Q3: keep "Kvalifisering").** The *existing* public URL
> `/lop/[id]/kvalifisering` is actually the **scoring** screen
> ([getScoringData](src/app/lop/[id]/kvalifisering/page.tsx#L38)); the leaderboard
> is `/resultater`. In the new tabs "Kvalifisering" = **leaderboard**. So the
> phase-3 redirect from the old `kvalifisering` URL must point at the new
> **Scoring** tab, not the Kvalifisering tab. Easy to get backwards.

The Påmelding page today is a long stack of five panels
([edit / qualifying / officials / registrations](src/app/admin/lop/[id]/page.tsx#L105-L296));
splitting scoring and finaler out into their own tabs already shortens it. We can
further group its remaining panels ("Oppsett" vs "Påmelding") in a later pass.

### Auth note (must not regress) — resolved

Today [admin/layout.tsx:18–19](src/app/admin/layout.tsx#L18-L19) gates only on
`getCurrentUser()` (logged-in), **not** on role — judges already render the admin
shell; leaf pages gate via `requireCapability`. So the earlier worry ("if the
admin layout only expected admin/secretary") does not apply. Rules going forward
(open Q2: judges see all bars):

- **Layouts** (`/admin/e/[eventId]` and the race workspace) gate on
  `requireUser()` only — never a role/admin capability, or judges lose the shell.
- **Leaf pages/actions** keep their own `requireCapability` — Scoring keeps
  `scores.enter` and the per-criterion `editable` check
  ([kvalifisering/page.tsx:41–57](src/app/lop/[id]/kvalifisering/page.tsx#L41-L57)).
- Judges see every tab; capability-gated pages they can't fully use (Brukere,
  Finaler writes) should **degrade gracefully** (read-only / "du har ikke
  tilgang") rather than throw a full-page `AuthzError`.

---

## 6. Dashboard (the landing page)

Where you land after login and the only place you switch events.

```
Dashboard

  Pågående arrangement
  ┌───────────────────┐ ┌───────────────────┐
  │ Vindrift 2026     │ │ Sommerdrift 2026  │   ← click = open (sets context)
  │ Pågår · 3 løp     │ │ Kommende · 1 løp  │
  └───────────────────┘ └───────────────────┘

  [+ Nytt arrangement]   Administrer: Klasser · Alle førere · Alle brukere · Global logg
```

- **Primary action:** pick an event → go to its Løp tab.
- **Secondary:** create event; reach the global lists (Klasser, the full driver
  pool, all staff accounts, the global audit log) that used to sit in the top bar.
- Sort/emphasise by status (`ongoing` first) so the live event is one click away.

---

## 7. Suggested build phases

Each phase is independently shippable and testable (`typecheck` / `test` /
`build` + manual smoke, per the DoD in [documentation.md](documentation.md#L478)).
Each route-moving phase includes its **`revalidatePath` updates** (§4.2).

1. **Event-scoped shell.** Add `/admin/e/[eventId]/layout.tsx` with the new top
   bar + event name; move the race list under it as the default **Løp** tab; add
   the **Innstillinger** tab (event edit/delete moved off the old detail page).
   Old routes redirect (§ deep-links). *No behaviour change beyond navigation.*
2. **Race workspace tabs.** Add `/admin/e/[eventId]/lop/[raceId]/layout.tsx` with
   the four persistent tabs; relocate the Cup admin page under `/finaler`. Add
   the `[raceId] belongs to [eventId]` mismatch guard.
3. **Relocate scoring into the shell** (the core fix). New `scoring` tab wraps the
   existing scoring UI + actions; keep the `scores.enter` gate. Old public
   `/lop/[id]/kvalifisering` redirects `scores.enter` users into the new Scoring
   tab, other logged-in users → Dashboard, anonymous → `/logg-inn` (§8).
4. **Kvalifisering tab.** Leaderboard view + lock/publish controls in one place.
5. **Dashboard.** Convert `/admin` into the event picker; fold in Arrangementer;
   link out to Klasser / all-drivers / all-users / global-log.
6. **Event-scope Førere / Brukere / Logg.**
   - Førere: read-only event roster over `registrations` + "Ny fører" shortcut.
     Global `/admin/forere` unchanged.
   - Brukere: event-staff list over `event_staff` **plus a new assign/remove
     action** (net-new — `event_staff` has no write path today). Global
     `/admin/brukere` unchanged.
   - Logg: add `audit_logs.event_id` (§4.1), set it on writes, backfill, filter
     the event tab. Global `/admin/logg` unchanged.
7. **Polish.** Group the Påmelding panels, add status chips, "continue where you
   left off" via `lastEventId`.

**Schema changes:** phases 1–5 need none. **Phase 6 adds `audit_logs.event_id`**
and introduces the first `event_staff` write path. `registrations` and
`event_staff` tables already exist
([documentation.md §5](documentation.md#L165)); note `event_staff` is currently
**unused** in app/server code, so event-Brukere is partly new functionality, not
a pure relocation.

---

## 8. Deep-link & redirect behaviour (open Q5)

**Decided rule:** when the target event is derivable, resolve it and redirect to
the correct nested URL; **bounce to the Dashboard only when the event genuinely
cannot be resolved.** Concretely:

- **Moved internal admin routes** (`/admin/lop/[id]`, `/admin/lop/[id]/cup`) →
  `301` that resolves `eventId` from the race (`races.eventId` is `NOT NULL`) and
  lands on the nested URL (`…/lop/[raceId]` and `…/lop/[raceId]/finaler`). The
  context is derivable, so this is a clean redirect, not a bounce.
- **Old public staff scoring URL** `/lop/[id]/kvalifisering` — the one bookmark
  judges keep. Resolve `race → event` and:
  - logged-in with `scores.enter` → `301` into the new **Scoring** tab
    (`/admin/e/[eventId]/lop/[raceId]/scoring`);
  - logged-in **without** `scores.enter` → Dashboard (they have no scoring reason
    to be there);
  - anonymous → `/logg-inn`.

  If the `raceId` is invalid or the race no longer exists, fall through to the
  Dashboard (logged-in) / `/logg-inn` (anonymous). The other public views on the
  same prefix — `/lop/[id]/resultater`, `/lop/[id]/cup` — are **unchanged and stay
  public**; only the scoring URL is redirected.
- **Bounce to Dashboard** for genuinely un-resolvable context: an event-scoped
  URL with a missing / invalid / nonexistent `eventId`, or a `raceId` that can't
  be resolved to a race.
- **Mismatch guard:** in the workspace layout, verify `[raceId]` belongs to
  `[eventId]`; on mismatch `notFound()`, so nobody can craft
  `/admin/e/<A>/lop/<raceOfB>`.

Redirects are permanent (`301`) since the old URLs are retired; keep them in place
at least one season so external bookmarks/QR codes resolve.

---

## 9. Resolved decisions (was "Open questions")

1. **Førere/Brukere scope** → keep **both** global and event-focused (§3, §4).
2. **Judges see the full bar** (not a trimmed one). Gate at leaf pages; degrade
   gracefully (§5 auth note).
3. **Naming** → keep **"Kvalifisering"** for the leaderboard tab (mind the URL
   collision, §5).
4. **URL vs cookie** → **URL** (`/admin/e/[eventId]/…`); cookie only as a
   "last event" shortcut.
5. **Deep-link fallback** → **resolve-and-redirect when the event is derivable;
   bounce to Dashboard only when it isn't.** The old scoring URL redirects
   `scores.enter` users straight into the new Scoring tab (§8).

---

## Changelog (v1 → v2)

- Global **Førere / Brukere / Logg** pages are **kept** alongside new
  event-scoped variants (was: replaced).
- Added an **Innstillinger** tab for event edit/delete (was: homeless after the
  detail page folded into Løp).
- Called out the **`audit_logs.event_id` schema change** required for event Logg
  (§4.1); phase 6 is no longer schema-free.
- Called out that **`event_staff` is unused today** — event-Brukere needs a new
  assign/remove write path (§3, §7).
- Added the **`revalidatePath` migration** as an explicit per-phase task (§4.2).
- Noted the **`kvalifisering` URL = scoring** naming collision for the phase-3
  redirect (§5).
- Auth note updated: admin layout already gates on login only; keep capability
  gates at leaves (§5).
- Resolved all open questions (§9) and firmed up deep-link behaviour (§8):
  resolve-and-redirect when the event is derivable, Dashboard bounce only when it
  isn't, and the old scoring URL sends `scores.enter` users into the Scoring tab.
