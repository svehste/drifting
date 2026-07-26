# Data model [Datamodell]

Derived from [acceptance_criteria.md](acceptance_criteria.md). This is the logical
model (entities, fields, relationships) — not a migration. Field types are
generic: `uuid`, `text`, `int`, `bool`, `date`, `timestamptz`, `enum`, `jsonb`.

## Conventions

- Every table has `id uuid` (PK) unless noted, plus `created_at timestamptz` and
  `updated_at timestamptz`.
- "**Derived**" fields can be computed on the fly; they are marked **(cache)**
  where we recommend also storing them for query/scale reasons.
- FKs are `*_id`; `→ Entity` shows the reference.
- All money-free; this is a scoring/bracket domain.

---

## Enumerations

| Enum | Values |
|---|---|
| `role` | `admin`, `judge`, `secretary`, `driver` |
| `event_status` | `upcoming`, `ongoing`, `finished` |
| `race_status` | `registration`, `qualifying`, `cup`, `finished` |
| `cup_size` | `4`, `8`, `16`, `32` |
| `criterion` | `line`, `angle`, `style` |
| `official_duty` | `line`, `angle`, `style`, `battle` |
| `run_status` | `pending`, `complete` |
| `leaderboard_status` | `in_progress`, `unofficial`, `official` |
| `battle_round` | `top32`, `top16`, `quarterfinal`, `semifinal`, `final`, `bronsefinal` |
| `battle_status` | `pending`, `omt`, `decided`, `bye` |
| `advance_slot` | `a`, `b` |

---

## Entities

### 1. User [Bruker]
Single table for **all** people; role(s) decide access (AC: Users, Roles).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | Also the **driver page link** token (`/fører/<id>`). Unguessable. |
| `first_name` | text | |
| `last_name` | text | |
| `email` | text | **unique**. Login identity for staff. |
| `phone` | text | |
| `password_hash` | text? | Null for driver-only users (no login). Set via invite. |
| `start_number` | text? | Only meaningful for the driver role; else null. Global (external). |
| `start_number_is_dummy` | bool | True when a placeholder number was assigned. |
| `club` | text? | Driver's club [klubb]. Only meaningful for drivers. |
| `car` | text? | Driver's car [bil]. Only meaningful for drivers. |
| `status` | enum `invited`/`active` | Staff invite flow; drivers default `active`. |

- **Multi-role** via `user_role` (below). No `role` column on `User`.
- Uniqueness of `start_number`: **not** enforced by the app (numbers are global
  and external); dummies may collide — that's why the dummy flag exists.

### 2. UserRole [Brukerrolle]
Many-to-many; a user holds one or more roles.

| Field | Type | Notes |
|---|---|---|
| `user_id` | → User | |
| `role` | enum `role` | |

- **PK / unique**: (`user_id`, `role`).

### 3. Event [Arrangement]

| Field | Type | Notes |
|---|---|---|
| `name` | text | |
| `start_date` | date | |
| `end_date` | date | |
| `status` | enum `event_status` | **Derived (cache)** from dates + race statuses. |

### 4. EventStaff [Arrangementsstab]
Assigns admins/judges/secretaries to an event (AC: Events 3). Race-level judge
duties are separate (RaceOfficial).

| Field | Type | Notes |
|---|---|---|
| `event_id` | → Event | |
| `user_id` | → User | |

- **PK / unique**: (`event_id`, `user_id`).

### 5. Class [Klasse]
A **shared, global lookup** of competition classes (pro, semi-pro…), so the same
class is consistent across events and seasons and can be used for statistics
(AC: Races 9).

| Field | Type | Notes |
|---|---|---|
| `name` | text | e.g. Pro, Semi-Pro. **unique**. |
| `sort_order` | int? | Optional display ordering. |

- Referenced by `Race.class_id`. Deletion blocked while any race references it.

### 6. Race [Løp]
Belongs to one event; has its own qualifying + cup (AC: Races).

| Field | Type | Notes |
|---|---|---|
| `event_id` | → Event | |
| `name` | text | |
| `class_id` | → Class | Selected from the shared Class list. |
| `cup_size` | enum `cup_size` | 4/8/16/32. |
| `max_line` | int | Default 40. Configurable per race. |
| `max_angle` | int | Default 30. |
| `max_style_flow` | int | Default 15. |
| `max_style_effort` | int | Default 15. |
| `status` | enum `race_status` | registration→qualifying→cup→finished. |
| `qualifying_locked` | bool | Default false. |
| `leaderboard_status` | enum `leaderboard_status` | in_progress / unofficial / official. |

- An event may hold **several races of the same class** — no uniqueness on
  (`event_id`, `class_id`).

### 7. RaceOfficial [Løpsdommer]
Assigns judges to a race. Qualifying needs exactly one judge per criterion; the
same or other judges may be battle judges (AC: Races 6).

| Field | Type | Notes |
|---|---|---|
| `race_id` | → Race | |
| `user_id` | → User | Must hold the `judge` role. |
| `duty` | enum `official_duty` | `line`/`angle`/`style` (one each) or `battle`. |

- **Unique**: (`race_id`, `duty`) for `line`/`angle`/`style` (exactly one judge
  per criterion). Multiple `battle` rows allowed.
- **Unique**: (`race_id`, `user_id`, `duty`) to avoid duplicates.

### 8. Registration [Påmelding]
A driver registered to a **race**. The join that gives cross-event history
(AC: Drivers 3, Events 4).

| Field | Type | Notes |
|---|---|---|
| `race_id` | → Race | |
| `user_id` | → User | The driver. |
| `qualifying_score` | int? | **Derived (cache)** = best approved run total (HKS). |
| `qualifying_rank` | int? | **Derived (cache)** after ranking + tie-break. |
| `seed` | int? | Assigned at bracket generation (= rank, if within cup size). |
| `eligible` | bool | **Derived (cache)** = has ≥1 approved run. |
| `final_place` | int? | **Derived (cache)** final standing once cup finished. |

- **Unique**: (`race_id`, `user_id`).
- History for a driver = all `Registration` rows for that `user_id`.

### 9. QualifyingRun [Kvalifiseringsrunde]
Two runs per registration; best approved counts (AC: Qualifying 2–7).

| Field | Type | Notes |
|---|---|---|
| `registration_id` | → Registration | |
| `run_number` | int | 1 or 2. |
| `status` | enum `run_status` | `complete` once all 3 criterion scores confirmed. |
| `total` | int? | **Derived** = line + angle + (flow+effort). Null until complete. |
| `approved` | bool | **Derived** = `total > 0`. |

- **Unique**: (`registration_id`, `run_number`).

### 10. RunScore [Poeng]
One row per (run, criterion), entered by the responsible judge on their device
(AC: Qualifying 3–5).

| Field | Type | Notes |
|---|---|---|
| `run_id` | → QualifyingRun | |
| `criterion` | enum `criterion` | line / angle / style. |
| `judge_user_id` | → User | Who entered it. |
| `points` | int? | Used for `line`/`angle`. |
| `flow` | int? | Used for `style` (0–max_style_flow). |
| `effort` | int? | Used for `style` (0–max_style_effort). |
| `confirmed` | bool | Judge confirmed. Editing before lock clears this. |
| `confirmed_at` | timestamptz? | |

- **Unique**: (`run_id`, `criterion`).
- `criterion_total` (derived) = `points` for line/angle, `flow + effort` for style.
- A run is `complete` ⇔ all three criterion rows exist **and** `confirmed`.

### 11. Cup [Cup]
One cup per race; created when qualifying is locked (AC: Cup 1, 13).

| Field | Type | Notes |
|---|---|---|
| `race_id` | → Race | **unique** (one cup per race). |
| `size` | enum `cup_size` | Copied from race at generation. |
| `generated_at` | timestamptz | |
| `regenerations` | int | Count of regenerations (audit convenience). |
| `status` | enum `pending`/`in_progress`/`finished` | |

### 12. Battle [Battle / Tvekamp]
A node in the fixed bracket tree, including the bronsefinale (AC: Cup 6–11,
Bracket seeding).

| Field | Type | Notes |
|---|---|---|
| `cup_id` | → Cup | |
| `round` | enum `battle_round` | |
| `position` | int | Slot index within the round (tree order). |
| `driver_a_registration_id` | → Registration? | Null = empty slot / bye. |
| `driver_b_registration_id` | → Registration? | Null = empty slot / bye. |
| `winner_registration_id` | → Registration? | Null until decided. |
| `omt_count` | int | 0 or 1 (max 1). |
| `status` | enum `battle_status` | pending / omt / decided / bye. |
| `next_battle_id` | → Battle? | Where the **winner** advances. |
| `next_slot` | enum `advance_slot`? | Which slot the winner fills. |
| `loser_next_battle_id` | → Battle? | Semifinals only → feeds the bronsefinale. |
| `loser_next_slot` | enum `advance_slot`? | |

- **Unique**: (`cup_id`, `round`, `position`).
- **Byes**: a battle with exactly one non-null driver has `status = bye` and that
  driver auto-advances; both-null produces a null that advances upward.
- Advancement is the fixed tree (`next_battle_id`/`next_slot`); no re-seeding.

### 13. AuditLog [Logg]
Append-only record of significant actions (AC: Audit log).

| Field | Type | Notes |
|---|---|---|
| `actor_user_id` | → User | Who acted. |
| `action` | text | e.g. `score.confirm`, `qualifying.lock`, `bracket.regenerate`, `battle.decide`, `leaderboard.publish`, `event.delete`. |
| `entity_type` | text | e.g. `RunScore`, `Race`, `Battle`. |
| `entity_id` | uuid | |
| `details` | jsonb | Before/after or specifics (criterion, run, values…). |
| `created_at` | timestamptz | Only timestamp; rows are immutable. |

### Auxiliary (thin, can defer)
- **Invite** — `user_id`, `token`, `expires_at`, `accepted_at` (staff password
  setup). Could instead be fields on User.
- **Session** — staff auth sessions (or delegate to an auth library).

---

## Relationships (cardinality)

```mermaid
erDiagram
    User ||--o{ UserRole : has
    User ||--o{ EventStaff : "assigned via"
    User ||--o{ RaceOfficial : "judges via"
    User ||--o{ Registration : "drives via"
    User ||--o{ AuditLog : acts

    Event ||--o{ Race : contains
    Event ||--o{ EventStaff : staffed_by
    Class ||--o{ Race : categorizes

    Race ||--o{ RaceOfficial : officiated_by
    Race ||--o{ Registration : entries
    Race ||--|| Cup : has

    Registration ||--o{ QualifyingRun : runs
    QualifyingRun ||--o{ RunScore : scores

    Cup ||--o{ Battle : battles
    Registration ||--o{ Battle : "competes (a/b/winner)"
    Battle ||--o{ Battle : advances_to
```

---

## Derived vs. stored (recompute rules)

| Value | Rule | Recompute trigger |
|---|---|---|
| `QualifyingRun.total`, `.approved` | sum of criterion scores; `> 0` | run becomes complete / score edited |
| `Registration.qualifying_score` | max total over approved runs | any of the driver's runs changes |
| `Registration.qualifying_rank` | sort by score + HKS/LKS tie-break | qualifying scores change |
| `Registration.seed` | = rank at generation (top N only) | bracket generate / regenerate |
| `Registration.eligible` | has ≥1 approved run | run approval changes |
| `Registration.final_place` | from battle outcomes | battle decided / cup finished |
| `Event.status`, `Race.status` | lifecycle transitions | lock / generate / finish actions |

Storing these as **cache** columns is recommended for the ~2000-viewer public
read path (Non-functional AC 4): public leaderboard/bracket read cached values,
never recompute per request.

---

## Key constraints & rules (from ACs)

1. `RunScore` unique per (`run_id`, `criterion`); exactly one judge per criterion
   via `RaceOfficial` unique (`race_id`, `duty ∈ {line,angle,style}`).
2. A run is `complete` only when all three criterion scores are `confirmed`.
3. Only drivers with `eligible = true` may receive a `seed` / enter a `Battle`.
4. `Battle.omt_count ≤ 1`; when `status = omt` and a rerun resolves, set
   `winner_registration_id` and `status = decided`.
5. **Deletion blocked** when results exist: an `Event`/`Race`/driver `User` with
   any `RunScore` or decided `Battle` cannot be deleted.
6. Bracket **regeneration** deletes this cup's `Battle` rows and re-seeds from
   current `Registration` ranking; logged in `AuditLog`.
7. Tie-break ordering (HKS, LKS, then HKS line/angle/style, then LKS
   line/angle/style) is applied when computing `qualifying_rank`.

---

## AC coverage map

| Spec section | Entities |
|---|---|
| Roles & permissions | User, UserRole |
| Authentication | User (`password_hash`, `status`), Invite/Session |
| Events | Event, EventStaff |
| Races | Race, RaceOfficial, Class |
| Users / Drivers | User, UserRole, Registration |
| Driver page | User + Registration (history query) |
| Qualifying | QualifyingRun, RunScore, Registration |
| Public leaderboard | Registration/Run/Score (cache) + Race.`leaderboard_status` |
| Cup / bracket / seeding | Cup, Battle, Registration.`seed` |
| Public cup view | Cup, Battle |
| Audit log | AuditLog |

---

## Open modeling notes

- **Class scope** — `Class` is a **global** lookup (shared across all events and
  seasons) so statistics like "all Pro drivers this year" join cleanly through
  `Race.class_id`. If classes ever need per-event variants, add an optional
  `event_id` — not needed now.
- **`start_number` type** — `text` to allow dummy/prefixed values; switch to
  `int` if numbers are always numeric.
- **Result standings** — `Registration.final_place` is derived; a separate
  standings table is unnecessary unless you need frozen historical snapshots.
- **Battle judges vs. decision record** — battle outcomes are captured on
  `Battle` + `AuditLog`. If you later need per-judge battle votes, add a
  `BattleVote(battle_id, judge_user_id, choice)` table.
