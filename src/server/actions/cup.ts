"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { battles, cups, races, registrations } from "@/db/schema";
import type { CupSize } from "@/domain";
import { writeAudit } from "@/server/audit";
import { requireCapability } from "@/server/authz";
import {
  decideInTx,
  generateCup,
  loadRanked,
  persistBracket,
  type DecisionResult,
} from "@/server/cup-engine";
import { fail, guardAction, ok, type ActionResult } from "./_result";

/** Generate the bracket once qualifying is locked (Cup AC 1). Admin or secretary. */
export async function generateBracket(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("qualifying.lock");
    const raceId = z.string().uuid().parse(formData.get("raceId"));

    const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
    if (!race) return fail(nb.errors.notFound);
    if (!race.qualifyingLocked) return fail("Lås kvalifiseringen før du genererer stigen.");

    const existing = await db.select({ id: cups.id }).from(cups).where(eq(cups.raceId, raceId)).limit(1);
    if (existing.length > 0) return fail("Cup finnes allerede — bruk regenerering.");

    const eligible = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.raceId, raceId), eq(registrations.eligible, true)))
      .limit(1);
    if (eligible.length === 0) return fail("Ingen godkjente førere å seede.");

    await db.transaction(async (tx) => {
      const ranked = await loadRanked(tx, raceId);
      const cupId = await generateCup(tx, { id: raceId, cupSize: Number(race.cupSize) as CupSize }, ranked);
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "bracket.generate",
        entityType: "Cup",
        entityId: cupId,
        details: { size: race.cupSize, drivers: ranked.length },
      });
    });

    revalidatePath(`/admin/lop/${raceId}/cup`);
    revalidatePath(`/lop/${raceId}/cup`);
    return ok();
  });
}

/** Regenerate: discard battles and re-seed from current ranking (Cup AC 13). Admin only. */
export async function regenerateBracket(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("qualifying.unlock");
    const raceId = z.string().uuid().parse(formData.get("raceId"));

    const [cup] = await db.select().from(cups).where(eq(cups.raceId, raceId)).limit(1);
    if (!cup) return fail("Ingen cup å regenerere.");

    await db.transaction(async (tx) => {
      await tx.delete(battles).where(eq(battles.cupId, cup.id));
      await tx
        .update(registrations)
        .set({ finalPlace: null, seed: null })
        .where(eq(registrations.raceId, raceId));
      const ranked = await loadRanked(tx, raceId);
      await persistBracket(tx, cup.id, ranked, Number(cup.size) as CupSize);
      await tx
        .update(cups)
        .set({ status: "in_progress", regenerations: cup.regenerations + 1, generatedAt: new Date() })
        .where(eq(cups.id, cup.id));
      await tx.update(races).set({ status: "cup" }).where(eq(races.id, raceId));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "bracket.regenerate",
        entityType: "Cup",
        entityId: cup.id,
        details: { regenerations: cup.regenerations + 1 },
      });
    });

    revalidatePath(`/admin/lop/${raceId}/cup`);
    revalidatePath(`/lop/${raceId}/cup`);
    return ok();
  });
}

const outcomeSchema = z.enum(["a", "b", "omt"]);

/** Decide a battle: A wins, B wins, or OMT (max 1) — Cup AC 7–9. Judge or admin. */
export async function decideBattle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("battle.decide");
    const battleId = z.string().uuid().parse(formData.get("battleId"));
    const outcome = outcomeSchema.parse(formData.get("outcome"));

    let result: DecisionResult | undefined;
    await db.transaction(async (tx) => {
      result = await decideInTx(tx, battleId, outcome);
      if (result.ok) {
        await writeAudit(tx, {
          actorUserId: user.id,
          action: outcome === "omt" ? "battle.omt" : "battle.decide",
          entityType: "Battle",
          entityId: battleId,
          details: { outcome, winner: result.winner ?? null, round: result.round },
        });
      }
    });

    if (!result || !result.ok) return fail(result?.error ?? nb.errors.generic);

    revalidatePath(`/admin/lop/${result.raceId}/cup`);
    revalidatePath(`/lop/${result.raceId}/cup`);
    return ok();
  });
}
