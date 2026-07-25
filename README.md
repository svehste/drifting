# Drifting event manager [Driftingarrangement]

A web app for running drifting events [arrangement]: set up races [løp] per class
[klasse], score **qualifying** [kvalifisering] with judges [dommere], and run a
1v1 knockout **cup** with live public leaderboards and brackets. Norwegian UI
(English terms in brackets).

## Start here

**Building this?** Read [build_plan.md](build_plan.md) — it sequences the whole
MVP into milestones a fresh session can execute top to bottom.

## The documents (read in this order)

| # | Document | What it is |
|---|---|---|
| 1 | [acceptance_criteria.md](acceptance_criteria.md) | **Source of truth.** User stories + acceptance criteria for every feature. |
| 2 | [data_model.md](data_model.md) | Entities, fields, relationships, constraints. |
| 3 | [tech_stack.md](tech_stack.md) | Technology choices + the safety/simplicity rules. |
| 4 | [build_plan.md](build_plan.md) | Milestones M0–M8 with a definition of done each. |

## Stack (at a glance)

TypeScript · Next.js · PostgreSQL (Supabase) · Drizzle · Zod · Vercel.
One app, one database — **boring on purpose**: no realtime/WebSockets, no RLS,
no queues. Public views scale via short-cached endpoints + polling. See
[tech_stack.md](tech_stack.md) for the reasoning.

## Scope

MVP covers everything in the acceptance criteria **except** email notifications
and password reset (both explicitly deferred). The driver page is read-only.

## Status

Planning complete (docs 1–4). Implementation starts at **M0** in
[build_plan.md](build_plan.md).
