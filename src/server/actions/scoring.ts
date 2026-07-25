"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { qualifyingRuns, raceOfficials, races, registrations, runScores } from "@/db/schema";
import type { Criterion } from "@/domain/types";
import { writeAudit, type Tx } from "@/server/audit";
import { requireCapability } from "@/server/authz";
import { recomputeRace } from "@/server/recompute";
import { fail, guardAction, ok, type ActionResult } from "./_result";

interface RunContext {
  raceId: string;
  qualifyingLocked: boolean;
  maxLine: number;
  maxAngle: number;
  maxStyleFlow: number;
  maxStyleEffort: number;
}

async function loadRunContext(runId: string): Promise<RunContext | null> {
  const rows = await db
    .select({
      raceId: races.id,
      qualifyingLocked: races.qualifyingLocked,
      maxLine: races.maxLine,
      maxAngle: races.maxAngle,
      maxStyleFlow: races.maxStyleFlow,
      maxStyleEffort: races.maxStyleEffort,
    })
    .from(qualifyingRuns)
    .innerJoin(registrations, eq(registrations.id, qualifyingRuns.registrationId))
    .innerJoin(races, eq(races.id, registrations.raceId))
    .where(eq(qualifyingRuns.id, runId))
    .limit(1);
  return rows[0] ?? null;
}

/** A judge may score only their assigned criterion; an admin may score any. */
async function mayScore(
  userId: string,
  roles: readonly string[],
  raceId: string,
  criterion: Criterion,
): Promise<boolean> {
  if (roles.includes("admin")) return true;
  const rows = await db
    .select({ id: raceOfficials.id })
    .from(raceOfficials)
    .where(
      and(
        eq(raceOfficials.raceId, raceId),
        eq(raceOfficials.duty, criterion),
        eq(raceOfficials.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Publishing reverts to unofficial when a published result later changes (AC 6). */
async function revertOfficialIfNeeded(tx: Tx, raceId: string) {
  await tx
    .update(races)
    .set({ leaderboardStatus: "unofficial" })
    .where(and(eq(races.id, raceId), eq(races.leaderboardStatus, "official")));
}

const schema = z.object({
  runId: z.string().uuid(),
  criterion: z.enum(["line", "angle", "style"]),
  intent: z.enum(["save", "confirm"]),
  points: z.coerce.number().int().min(0).optional(),
  flow: z.coerce.number().int().min(0).optional(),
  effort: z.coerce.number().int().min(0).optional(),
});

/**
 * Enter (intent=save, unconfirmed) or confirm (intent=confirm) a judge's own
 * criterion score for a run (Qualifying AC 3, 5). Editing a confirmed score with
 * save returns the run to incomplete until re-confirmed. Recomputes the race
 * caches and reverts an official board to unofficial on change.
 */
export async function submitScore(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("scores.enter");
    const parsed = schema.safeParse({
      runId: formData.get("runId"),
      criterion: formData.get("criterion"),
      intent: formData.get("intent"),
      points: formData.get("points") ?? undefined,
      flow: formData.get("flow") ?? undefined,
      effort: formData.get("effort") ?? undefined,
    });
    if (!parsed.success) return fail(nb.errors.invalidInput);
    const { runId, criterion, intent } = parsed.data;

    const ctx = await loadRunContext(runId);
    if (!ctx) return fail(nb.errors.notFound);
    if (ctx.qualifyingLocked) return fail("Kvalifiseringen er låst.");
    if (!(await mayScore(user.id, user.roles, ctx.raceId, criterion))) {
      return fail(nb.errors.unauthorized);
    }

    // Values + per-race maxima validation.
    const points = criterion === "style" ? null : (parsed.data.points ?? 0);
    const flow = criterion === "style" ? (parsed.data.flow ?? 0) : null;
    const effort = criterion === "style" ? (parsed.data.effort ?? 0) : null;
    if (criterion === "line" && (points ?? 0) > ctx.maxLine) return fail("Over maks linje.");
    if (criterion === "angle" && (points ?? 0) > ctx.maxAngle) return fail("Over maks vinkel.");
    if (criterion === "style") {
      if ((flow ?? 0) > ctx.maxStyleFlow) return fail("Over maks flyt.");
      if ((effort ?? 0) > ctx.maxStyleEffort) return fail("Over maks innsats.");
    }

    const confirmed = intent === "confirm";

    await db.transaction(async (tx) => {
      await tx
        .insert(runScores)
        .values({ runId, criterion, judgeUserId: user.id, points, flow, effort, confirmed, confirmedAt: confirmed ? new Date() : null })
        .onConflictDoUpdate({
          target: [runScores.runId, runScores.criterion],
          set: { judgeUserId: user.id, points, flow, effort, confirmed, confirmedAt: confirmed ? new Date() : null },
        });
      await recomputeRace(tx, ctx.raceId);
      await revertOfficialIfNeeded(tx, ctx.raceId);
      await writeAudit(tx, {
        actorUserId: user.id,
        action: confirmed ? "score.confirm" : "score.save",
        entityType: "RunScore",
        entityId: runId,
        details: { criterion, points, flow, effort },
      });
    });

    revalidatePath(`/lop/${ctx.raceId}/kvalifisering`);
    return ok(confirmed ? "Bekreftet" : "Lagret");
  });
}
