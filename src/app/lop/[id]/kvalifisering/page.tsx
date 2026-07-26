import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { races } from "@/db/schema";
import { can } from "@/domain/permissions";
import { isUuid } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Retired public scoring URL — scoring now lives inside the admin shell
 * (UX_review1 §3, §8). This is the one bookmark judges keep, so resolve the event
 * from the race and send them into the new Scoring tab. The redirect is auth-
 * conditional, so it's deliberately temporary (not a cacheable 308): a cached
 * permanent redirect could route the wrong user into /admin.
 */
export default async function LegacyScoringRedirect({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!isUuid(params.id)) redirect(user ? "/admin" : "/logg-inn");
  const [race] = await db.select().from(races).where(eq(races.id, params.id)).limit(1);
  if (!race) redirect(user ? "/admin" : "/logg-inn");

  if (!user) redirect("/logg-inn");
  if (!can(user.roles, "scores.enter")) redirect("/admin");
  redirect(`/admin/e/${race.eventId}/lop/${race.id}/scoring`);
}
