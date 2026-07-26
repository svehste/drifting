import { eq } from "drizzle-orm";
import { permanentRedirect, redirect } from "next/navigation";
import { db } from "@/db/client";
import { races } from "@/db/schema";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Old cup admin page → the Finaler tab in the race workspace (UX_review1 §8). */
export default async function CupRedirect({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) redirect("/admin");
  const [race] = await db.select().from(races).where(eq(races.id, params.id)).limit(1);
  if (!race) redirect("/admin");
  permanentRedirect(`/admin/e/${race.eventId}/lop/${race.id}/finaler`);
}
