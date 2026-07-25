"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { races } from "@/db/schema";
import { writeAudit } from "@/server/audit";
import { requireCapability } from "@/server/authz";
import { fail, guardAction, ok, type ActionResult } from "./_result";

/** Lock qualifying (admin or secretary) — scores become read-only; bracket can be generated. */
export async function lockQualifying(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("qualifying.lock");
    const raceId = z.string().uuid().parse(formData.get("raceId"));

    await db.transaction(async (tx) => {
      // Locking finalises the board: in_progress → unofficial (publish is separate).
      await tx
        .update(races)
        .set({ qualifyingLocked: true, status: "cup" })
        .where(eq(races.id, raceId));
      await tx
        .update(races)
        .set({ leaderboardStatus: "unofficial" })
        .where(eq(races.id, raceId));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "qualifying.lock",
        entityType: "Race",
        entityId: raceId,
      });
    });
    revalidatePath(`/admin/lop/${raceId}`);
    revalidatePath(`/lop/${raceId}/kvalifisering`);
    return ok();
  });
}

/** Unlock qualifying (admin only) — allows corrections; warns it affects the bracket (Cup AC 13). */
export async function unlockQualifying(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("qualifying.unlock");
    const raceId = z.string().uuid().parse(formData.get("raceId"));

    await db.transaction(async (tx) => {
      await tx
        .update(races)
        .set({ qualifyingLocked: false, status: "qualifying", leaderboardStatus: "in_progress" })
        .where(eq(races.id, raceId));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "qualifying.unlock",
        entityType: "Race",
        entityId: raceId,
      });
    });
    revalidatePath(`/admin/lop/${raceId}`);
    revalidatePath(`/lop/${raceId}/kvalifisering`);
    return ok();
  });
}

/** Publish the leaderboard as official (admin or secretary). Independent of locking. */
export async function publishLeaderboard(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("leaderboard.publish");
    const raceId = z.string().uuid().parse(formData.get("raceId"));

    await db.transaction(async (tx) => {
      await tx.update(races).set({ leaderboardStatus: "official" }).where(eq(races.id, raceId));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "leaderboard.publish",
        entityType: "Race",
        entityId: raceId,
      });
    });
    revalidatePath(`/admin/lop/${raceId}`);
    revalidatePath(`/lop/${raceId}/resultater`);
    return ok();
  });
}
