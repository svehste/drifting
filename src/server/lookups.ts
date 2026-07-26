/**
 * Small id lookups shared by server actions — chiefly resolving the event a race
 * belongs to, so mutations that only receive a raceId can build the correct
 * `/admin/e/[eventId]/lop/[raceId]/…` revalidate paths (UX_review1 §4.2).
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { races } from "@/db/schema";

/** The event a race belongs to, or null if the race no longer exists. */
export async function raceEventId(raceId: string): Promise<string | null> {
  const [row] = await db
    .select({ eventId: races.eventId })
    .from(races)
    .where(eq(races.id, raceId))
    .limit(1);
  return row?.eventId ?? null;
}
