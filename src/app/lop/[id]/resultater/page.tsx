import { notFound } from "next/navigation";
import { isUuid } from "@/lib/validation";
import { getLeaderboard } from "@/server/queries/leaderboard";
import { LeaderboardView } from "./leaderboard-view";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const data = await getLeaderboard(params.id);
  if (!data) notFound();

  return (
    <main className="container">
      <LeaderboardView initial={data} />
    </main>
  );
}
