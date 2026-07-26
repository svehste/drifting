import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { races } from "@/db/schema";
import { isUuid } from "@/lib/validation";
import { requireUser } from "@/server/authz";
import { NavLink } from "../../../../_components/nav-link";

export const dynamic = "force-dynamic";

/**
 * Race workspace chrome — persistent tabs that stay visible across Påmelding,
 * Scoring, Kvalifisering and Finaler. Gates on login only (leaves keep their own
 * capability checks). Guards that [raceId] actually belongs to [eventId] so a
 * crafted /admin/e/<A>/lop/<raceOfB> URL 404s (UX_review1 §8).
 */
export default async function RaceWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { eventId: string; raceId: string };
}) {
  await requireUser();
  if (!isUuid(params.raceId)) notFound();
  const [race] = await db.select().from(races).where(eq(races.id, params.raceId)).limit(1);
  if (!race || race.eventId !== params.eventId) notFound();

  const base = `/admin/e/${params.eventId}/lop/${race.id}`;

  return (
    <>
      <div className="workspace-head">
        <div className="workspace-title">
          <Link href={`/admin/e/${params.eventId}`} className="muted">
            ← {nb.nav.races}
          </Link>
          <h1>
            {race.name} <span className="muted">· {nb.raceStatus[race.status]}</span>
          </h1>
        </div>
        <Link href={`/lop/${race.id}/resultater`} className="btn-secondary" target="_blank">
          Se offentlig tavle ↗
        </Link>
      </div>
      <nav className="workspace-tabs">
        <NavLink href={base} label={nb.raceStatus.registration} exact />
        <NavLink href={`${base}/scoring`} label="Scoring" />
        <NavLink href={`${base}/kvalifisering`} label={nb.raceStatus.qualifying} />
        <NavLink href={`${base}/finaler`} label={nb.raceStatus.cup} />
      </nav>
      {children}
    </>
  );
}
