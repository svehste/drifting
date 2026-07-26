# User stories with acceptance criteria

This application manages drifting events. It is written in **Norwegian**;
Norwegian terms are given in brackets on first use, e.g. Event [Arrangement].

Scoring, seeding, and battle rules follow the official **NM Drifting reglement**:
<https://bilsportboka.no/kapittel/drifting/nm-drifting-reglement/>
(qualifying §10 & §16, finals/seeding §11).

---

## Epic

1. This is an application to set up drifting events. Each event [arrangement] can
   have several races [løp]. Drivers [førere] will compete in one or several
   races in the same event.

2. A race has a **class** [klasse] (e.g. pro, semi-pro). An event can contain
   several races, including two races of the same class (e.g. two pro races).

3. Each race runs in two phases: first a **qualifying** [kvalifisering] where
   drivers are given a score by the judges [dommere], shown on a public
   leaderboard; then a **cup** [cup] where drivers compete 1v1 in a bracket.

4. The admin selects the cup size per race: 4, 8, 16 or 32 drivers. Placement in
   the bracket is decided by the qualifying result. The cup is publicly available.

5. Admins can create events and edit other users, drivers, and races.

6. Each driver can access their own page where they see their contact info,
   upcoming races, and historic races.

7. This application is in Norwegian; translations are given in brackets.

8. Admins and judges can e-mail drivers with updates and/or results
   (**not MVP**).

---

## Glossary [Ordliste]

| English | Norwegian |
|---|---|
| Event | Arrangement |
| Race | Løp |
| Class | Klasse |
| Qualifying | Kvalifisering |
| Cup / bracket | Cup |
| Battle | Battle / tvekamp |
| One More Time (rerun) | Omkjøring (OMT) |
| Run | Runde |
| Qualifying run | Kvalifiseringsrunde |
| Driver | Fører |
| Judge | Dommer |
| Secretary | Sekretær |
| Admin | Admin |
| Start number | Startnummer |
| Leaderboard | Resultatliste / tavle |
| Line / Angle / Style | Linje / Vinkel / Stil |
| Flow / Effort | Flyt / Innsats |
| Approved (run) | Godkjent |
| Seed / bracket ladder | Seeding / Stige |
| Bye | Oversitter |
| 3rd-place battle | Bronsefinale |
| Dummy number | Dummynummer |

---

## Roles & permissions [Roller og rettigheter]

There are four roles. A user can hold more than one role.

| Capability | Admin | Judge [dommer] | Secretary [sekretær] | Driver [fører] |
|---|:--:|:--:|:--:|:--:|
| Create / delete events | ✓ | | | |
| Edit event details | ✓ | | ✓ | |
| Create / edit / delete races | ✓ | | ✓ | |
| Create users & invite (non-admin roles) | ✓ | | ✓ | |
| Create admin users / grant admin role | ✓ | | | |
| Register / edit / delete drivers | ✓ | | ✓ | |
| Assign judges/secretaries to a race | ✓ | | ✓ | |
| Enter / edit qualifying scores | ✓ | ✓² | | |
| Publish leaderboard as official | ✓ | | ✓ | |
| Lock qualifying / generate bracket | ✓ | | ✓ | |
| Unlock qualifying / regenerate bracket | ✓ | | | |
| Decide battle winner / OMT | ✓ | ✓ | | |
| View audit log | ✓ | | | |
| View public leaderboard & bracket | ✓ | ✓ | ✓ | ✓ |
| View own driver page (read-only) | | | | ✓ |

**Secretary [sekretær]** can do everything an admin can **except**: enter/edit
scores, create or delete events, create admin users or grant the admin role, and
unlock qualifying / regenerate a bracket (destructive actions kept to admins).
Deciding battle outcomes is a judging function and is **not** a secretary right.

² Each judge enters and edits **only their own criterion** (line, angle, or
style).

**User story:** As an admin, I want role-based permissions, so that each
participant can only see and change what they are allowed to.

### ACs
1. Every action is authorized against the acting user's role(s); unauthorized
   actions are rejected with a clear message.
2. A driver can only ever access their own driver page, never admin/judge views.
3. Roles are **multi-select**: a user may hold several roles at once (e.g.
   admin + judge, or judge + driver). Access is the **union** of all their
   roles' rights. All people are stored in a single users table (see Users).

---

## Authentication & access [Innlogging og tilgang]

**User story:** As a staff member, I want to log in securely; as a driver, I want
to open my personal page from a private link without a password.

### ACs
1. Admins, judges, and secretaries authenticate with **email + password**.
2. Drivers do **not** log in; they access their page via a private URL
   containing their UUID, e.g. `/fører/<uuid>`.
3. The driver UUID is unguessable and not listed publicly.
4. A new staff user is created by an admin and receives an **invite** to set
   their password before they can log in.
5. Staff sessions expire after inactivity and can be logged out.
6. (Not MVP) Password reset via email.

---

## Events [Arrangement]

**User story:** As an admin, I want to create events, so that I can add admins,
judges, secretaries, drivers, and races to this event.

### ACs
1. An event has:
   - Name [navn]
   - Start date and end date [start- og sluttdato]
2. An admin can create, edit, and delete an event. A **secretary** can edit
   event details but cannot create or delete events.
3. An admin can assign staff (other admins, judges, secretaries) to an event.
4. Drivers are registered **per race** (see Races AC 5); "registered to the
   event" simply means registered to at least one of its races. An admin or
   secretary can register drivers.
5. An event contains one or more **races** [løp].
6. Deleting an event is **blocked** if any of its races has results (any
   confirmed qualifying score or battle outcome). An event with no results can be
   deleted with confirmation.
7. An event is listed with its status (upcoming / ongoing / finished).

---

## Races [Løp]

**User story:** As an admin, I want to set up races within an event, each with a
class and a cup size, so that drivers can compete in the right category.

### ACs
1. A race belongs to exactly one event.
2. A race has:
   - Name [navn]
   - Class [klasse] — selected from a shared, managed list of classes (see AC 9)
   - Cup size [cup-størrelse]: 4, 8, 16, or 32
   - **Scoring maxima** [poengmaks], configurable per race, with NM defaults:
     line 40, angle 30, style 30 (style split flow 15 / effort 15).
3. An event may contain **multiple races of the same class** (e.g. two pro races).
4. Each race has its own **qualifying** and its own **cup**; they are independent
   of other races.
5. A driver can be registered to one or several races within the same event.
6. An admin assigns the officiating judges to a race. Qualifying requires
   **three judges**, one per criterion: a **line judge** [linjedommer], an
   **angle judge** [vinkeldommer], and a **style judge** [stildommer]. The same
   people may also serve as battle judges for the cup.
7. A race has a status: `Registration` → `Qualifying` → `Cup` → `Finished`.
8. An admin or secretary can edit or delete a race. Deleting a race is
   **blocked** if it has results (any confirmed qualifying score or battle
   outcome).
9. Classes [klasser] are managed in a **shared list** (a Class entity), not free
   text, so the same class (e.g. "Pro") is consistent across events and seasons.
   This enables statistics such as "all Pro drivers this year". An admin can
   create, rename, and delete a class (deletion blocked while races reference it).

---

## Users [Brukere]

**User story:** As an admin, I want to create users with different roles, so I can
share data with other people and invite them to join.

### ACs
1. There is a **single users table**. Everyone — admins, judges, secretaries,
   drivers — is a user; their **role(s)** determine where they appear in the
   system and what they can do. A user has:
   - First name [fornavn]
   - Last name [etternavn]
   - Email [e-post]
   - Phone number [telefonnummer]
   - Role(s) [rolle] — **multi-select**: admin, judge [dommer], driver [fører],
     secretary [sekretær]
   - UUID (also used as the driver page link when the user is a driver)
   - Start number [startnummer] — used only when the user has the driver role
     (empty otherwise)
   - Club [klubb] — text, used only for drivers
   - Car [bil] — text, used only for drivers
2. Email is unique across users.
3. An admin can create, edit, and delete users and change their role(s),
   including the admin role.
4. A **secretary** can create and edit users with **non-admin** roles (judge,
   secretary, driver) and invite them, but cannot create admin users or grant
   the admin role.
5. Creating a staff user (admin/judge/secretary) triggers an invite (see
   Authentication).

---

## Drivers [Førere]

**User story:** As an admin or secretary, I can add and manage drivers in a
dedicated interface. A driver is a user with the role "driver".

### ACs
1. A driver is **not a separate entity**: it is a **user** (single users table)
   who holds the driver role. Driver-relevant fields come from that user record:
   name, email, phone, **club** [klubb], **car** [bil], **start number**
   (decided outside the app), and the user's **UUID** (used for the driver page
   link). There is no separate driver UUID.
2. Admins and secretaries can create, edit, and delete drivers.
3. A driver can be registered to one or more **races**, across **different
   events**. This per-race registration is what builds the cross-event history
   shown on the driver page.
4. Start number is used to identify the driver in qualifying and cup views.
5. Start numbers are **global** identifiers (assigned externally, outside the
   app), not scoped per event or race.
6. If a driver has no official start number, a **dummy number** [dummynummer]
   can be assigned so they can still be registered and scored. Dummy numbers are
   flagged/distinguishable from official ones.
7. Deleting a driver is **blocked** if they have any results (qualifying scores
   or battle outcomes) in any race, so history is preserved. A driver with no
   results can be deleted, or simply unregistered from a race.

---

## Driver page [Fører]

**User story:** As a driver, I want to see my upcoming races, my history of
previous races, and my personal info.

### ACs
1. The page is reached via the driver's private UUID link, no login.
2. Shows the driver's **contact info** (name, email, phone, club, car, start
   number).
3. Shows **upcoming races** [kommende løp]: event name, race/class, date.
4. Shows **historic races** [tidligere løp]: for each past race, the driver's
   qualifying result (score + rank) and cup result (how far they advanced /
   final placement).
5. The **entire page is read-only** for the driver. Contact info is maintained by
   admins/secretaries; the driver cannot edit their own details.

---

## Qualifying [Kvalifisering]

**User story:** As a judge, I want to score qualifying runs on my single
criterion (line, angle, or style), so that a fair ranking decides the seeding.

### ACs
1. Qualifying belongs to a single race (§10, §16).
2. Each registered driver drives **2 qualifying runs** [kvalifiseringsrunder]
   (minimum 1); the **best run's score counts**.
3. Three judges each score **one** criterion per run, each on their own device,
   up to the race's configured maxima (NM defaults shown):
   - **Line** [linje]: 0–40 points — entered by the line judge.
   - **Angle** [vinkel]: 0–30 points — entered by the angle judge.
   - **Style** [stil]: 0–30 points — entered by the style judge, split into
     flow [flyt] 0–15 and effort [innsats] 0–15.
4. A run's **score** = line + angle + style (max = sum of the race's maxima). No
   averaging; each criterion has exactly one responsible judge.
5. Each judge must **confirm** [bekreft] their score for a run. A run is
   **complete** only once **all three judges** have entered **and confirmed**
   their score. Until then the run's total is not published to the leaderboard.
   A judge may edit their own score before locking (see AC 9); re-editing a
   confirmed score returns the run to incomplete until re-confirmed.
6. A qualifying run is **approved** [godkjent] only if its score is **greater
   than 0**. Only drivers with at least one approved run may be placed in the
   bracket (finalestige).
7. A driver's **qualifying score** = their **highest** approved run score (HKS).
   Their other run is the low score (LKS) and is retained for tie-breaking.
8. Drivers are ranked by qualifying score, highest first. **Ties** are broken in
   this exact order (§10):
   1. Highest qualifying score (HKS)
   2. Lowest qualifying score (LKS)
   3. HKS line score
   4. HKS angle score
   5. HKS style score
   6. LKS line score
   7. LKS angle score
   8. LKS style score
9. Each assigned judge can enter and edit **only their own criterion** until
   qualifying is **locked**. Secretaries and drivers cannot enter scores.
10. An admin or secretary locks qualifying; after locking, scores are read-only
    and the bracket can be generated.
11. An admin can **unlock** a locked qualifying to correct scores. Unlocking
    requires confirmation and warns that it affects the generated bracket
    (see Cup AC 13). After corrections, qualifying is locked again.
12. A driver with **no approved run** (all runs score 0) is **not seeded** and
    cannot be placed in the bracket.

---

## Public leaderboard [Resultatliste / Tavle]

**User story:** As a member of the public, I want to see the qualifying results
live, so that I can follow the competition.

### ACs
1. The leaderboard is public (no login) per race.
2. Shows, per driver: rank, **start number**, **first name + last name**,
   **club**, **car**, each run's line/angle/style breakdown, the two run totals,
   and the qualifying score (best run). Unapproved runs (score 0) are indicated.
3. Updates **live**, but a run's score appears only once it is **complete** —
   i.e. all three judges have entered **and confirmed** their criterion
   (see Qualifying AC 5). Partially-scored runs are not shown as a total.
4. Live results are **unofficial** [uoffisiell] by default and clearly labelled
   as such.
5. A **secretary or admin** can **publish** the results as **official**
   [gjøre offisiell]. (This is distinct from a judge *confirming* a score in
   Qualifying AC 5 — publishing promotes the whole leaderboard.) Only after
   publishing are results presented as official.
6. If official results are later changed (e.g. after a score correction), the
   leaderboard reverts to **unofficial** until a secretary or admin publishes
   again.
7. Clearly indicates whether qualifying is in progress, unofficial, or official.
8. Displayed in Norwegian.

---

## Cup / bracket [Cup]

**User story:** As an admin, I want the bracket generated from qualifying results
and to run 1v1 battles with rerun (OMT) support, so that a winner is decided
fairly.

### ACs
1. The cup is generated for a race after qualifying is locked (§11).
2. Cup size is 4, 8, 16, or 32 (per race setting). Only drivers with an approved
   qualifying run are eligible.
3. Seeding is **classic direct elimination by qualifying position** and follows
   the standard seeded-bracket layout — see **Bracket seeding [Stigeoppsett]**
   below for the exact slot order, advancement paths, and byes.
4. If fewer drivers qualify than the cup size, the missing lower seeds are empty
   and the corresponding top seeds get a **bye** into the next round.
5. The bracket progresses through rounds until a final; round names are shown in
   Norwegian, mapped to bracket size:
   - Topp 32 → Topp 16 → Kvartfinale (Topp 8) → Semifinale (Topp 4) → Finale,
     plus a **Bronsefinale** (3rd-place battle) alongside the Finale.
   - Smaller cups start further along: a Topp 8 begins at Kvartfinale, a Topp 4
     at Semifinale.
6. Each **battle** [twin-battle / tvekamp] is 1v1 between two drivers.
7. Judges decide each battle's outcome — one of: **driver A wins**,
   **driver B wins**, or **One More Time (OMT)** [omkjøring].
8. On OMT the two drivers rerun the battle as soon as possible. A maximum of
   **one** OMT is allowed per battle; after that the judges **must** declare a
   winner.
9. The winner advances to the next round; the bracket updates automatically.
10. The two **losing semifinalists** contest a **3rd-place battle**
    [kamp om 3. plass / bronsefinale] to decide 3rd and 4th. It follows the same
    battle rules (winner / OMT, max 1 OMT).
11. Final placements: winner of the final = 1st, losing finalist = 2nd, winner of
    the 3rd-place battle = 3rd, loser = 4th. Lower placements (5–8, etc.) come
    from how far a driver advanced, ordered **within the same knockout round by
    qualifying position** (§11).
12. Only assigned judges and admins can set battle outcomes.
13. An admin can **regenerate the bracket** (e.g. after unlocking and correcting
    qualifying). Regenerating requires confirmation and **discards all existing
    battle results and OMT progress** for that race's cup, then re-seeds from the
    current qualifying ranking. Public views reflect the reset.

### Bracket seeding [Stigeoppsett]

**User story:** As an admin, I want the bracket built with standard seeded
placement from the qualifying ranking, so that the strongest qualifiers are kept
apart until late rounds and every matchup is determined purely by qualifying
position — matching the official NC/NM stige sheets.

### ACs
1. The bracket is a **fixed single-elimination stige**: all advancement paths are
   fixed at generation, and each battle winner moves along a predetermined line.
   There is **no re-seeding between rounds**.
2. Drivers are ranked by their qualifying result (best run + HKS/LKS tie-break)
   to give each eligible driver a **seed** (1 = top qualifier).
3. The **slot order** is produced by the standard recursive rule: begin with
   `[1, 2]`; to expand the bracket to size `2n`, replace each seed `s` with the
   pair `(s, 2n + 1 − s)`, preserving order. This yields, per cup size:
   - **Top 4:** (1‑4) (2‑3)
   - **Top 8:** (1‑8) (4‑5) (2‑7) (3‑6)
   - **Top 16:** (1‑16) (8‑9) (4‑13) (5‑12) (2‑15) (7‑10) (3‑14) (6‑11)
   - **Top 32:** (1‑32) (16‑17) (8‑25) (9‑24) (4‑29) (13‑20) (5‑28) (12‑21)
     (2‑31) (15‑18) (7‑26) (10‑23) (3‑30) (14‑19) (6‑27) (11‑22)
4. Every first-round pair sums to **N + 1** (e.g. Top 32: 1+32, 16+17, 8+25 …).
5. Seeds #1 and #2 are placed in **opposite halves** and can only meet in the
   **finale**; the recursion likewise spreads the next-strongest seeds across
   quarters. Winners advance along the fixed tree — e.g. in a Top 32, the winner
   of **1 v 32** meets the winner of **16 v 17** in the Top 16 round; that winner
   then meets the winner of the (8 v 25)/(9 v 24) block in the Top 8; and so on.
6. **Byes** [oversittere]: let D = number of **eligible** drivers (an approved
   qualifying run). Seeds 1…D are assigned by qualifying rank; slots for seeds
   D+1…N are **empty**. A battle whose opponent slot is empty is a bye — the
   present driver **advances automatically**, with no battle recorded. A node
   where **both** slots are empty produces an empty slot that advances upward.
   (This is why a Top 32 stige seeded with only 16 drivers collapses its first
   round to byes — as in the reference sheet.)
7. If more drivers are eligible than the cup size N, only the **top N** by
   qualifying rank enter the cup; the rest are not seeded.
8. The bracket is rendered as **two halves converging on a centre finale**, with
   the **bronsefinale** shown between the two semifinal losers — matching the
   NC PRO 2 Top 16 / Top 32 reference layouts.

---

## Public cup view [Offentlig cup-visning]

**User story:** As a member of the public, I want to see the live bracket, so I
can follow who advances.

### ACs
1. The bracket is public (no login) per race.
2. Shows each battle's two drivers (start number + name) and the winner as
   decided.
3. Shows OMT status when a battle is being rerun.
4. Shows the final placements (podium + lower positions) when the cup is finished.
5. Displayed in Norwegian.

---

## Admin management [Administrasjon]

**User story:** As an admin, I want to edit users, drivers, and races, so I can
correct mistakes and keep data accurate.

### ACs
1. An admin can edit any user, driver, race, or event.
2. An admin can reassign judges/secretaries to races.
3. Destructive actions (delete, unlock qualifying, regenerate a bracket) require
   confirmation.
4. All significant changes are recorded in an **audit log** (see below).

---

## Audit log [Logg]

**User story:** As an admin, I want a log of who changed what and when, so that
score and result changes are traceable and disputes can be resolved.

### ACs
1. The system logs significant actions with **who** (acting user), **what**
   (action + affected entity), and **when** (timestamp). At minimum:
   - Score entry, edit, and confirmation (which judge, which criterion, run).
   - Qualifying lock / unlock.
   - Bracket generation / regeneration.
   - Battle outcomes and OMT decisions.
   - Leaderboard published official / reverted to unofficial.
   - Creating/editing/deleting events, races, users, and drivers.
2. Log entries are **read-only** (append-only); they cannot be edited or deleted
   from the UI.
3. Only admins can view the audit log.

---

## E-mail notifications [E-post] (NOT MVP)

**User story:** As an admin or judge, I want to email drivers with updates and/or
results, so they stay informed.

### ACs
1. Admins/judges can send email to selected drivers or all drivers in a race.
2. Emails can include qualifying results and/or cup results.
3. This is explicitly out of scope for the MVP.

---

## Non-functional [Ikke-funksjonelle krav]

1. The entire UI is in Norwegian.
2. Public views (leaderboard, bracket) are accessible without authentication.
3. The app is usable on mobile (judges scoring trackside, public viewing).
4. The app must **scale to ~2000 concurrent public viewers** (leaderboard and
   bracket) per the expected peak load, while staff (admins, judges,
   secretaries) are only a handful. Public read views should scale/cache
   independently of the low-volume staff write path.

---

## Decisions log [Besluttet]

Resolved from the NM Drifting reglement (§10, §11, §16): judge-per-criterion
scoring, 40/30/30 point split, 2 runs (best counts, approved = score > 0),
HKS/LKS tie-break table, 1-vs-32 seeding, max 1 OMT, plus a 3rd-place battle
between the semifinal losers.

Resolved during specification:

1. **Point maxima** — configurable per race; NM default 40/30/30 (style 15/15).
2. **Byes** — handled as specified (empty high seeds auto-advance).
3. **Start numbers** — global, assigned externally; dummy numbers allowed and
   flagged for drivers without an official number.
4. **Leaderboard updates** — real-time, but a run publishes only after all three
   judges have entered **and confirmed** their score.
5. **Secretary permissions** — everything an admin can do **except** entering/
   editing scores, creating/deleting events, creating admins / granting the
   admin role, and unlock/regenerate (destructive). Battle decisions are a
   judging function, not a secretary right.
6. **Deletion** — blocked when an event/race has any results.
7. **Audit log** — yes; append-only, admin-viewable (see Audit log section).
8. **Judge scoring UX** — each judge enters scores on their own device.
9. **MVP scope** — the driver page is **read-only** (self-edit removed; contact
   info maintained by staff). Non-MVP: email notifications, password reset.
10. **Load / scaling** — must scale to ~2000 concurrent public viewers; only a
    few staff users. Public read path scales independently of staff writes
    (see Non-functional AC 4).
11. **Lock vs. official coupling** — kept **independent**: publishing the
    leaderboard official does not require qualifying to be locked, and vice
    versa.
12. **User model** — a **single users table**; role(s) are **multi-select** and
    determine access; a driver is just a user with the driver role (one shared
    UUID, no separate driver entity). Per-race registration (a user↔race link)
    enables cross-event driver history.
13. **Driver page edit** — removed; the page is read-only.
