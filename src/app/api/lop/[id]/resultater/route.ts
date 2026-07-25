/**
 * Public leaderboard endpoint. Short CDN cache (s-maxage=5) so ~2000 viewers
 * polling every few seconds collapse to ~1 origin hit per race per 5s
 * (tech_stack: the 2000-viewer path). No auth.
 */
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/validation";
import { getLeaderboard } from "@/server/queries/leaderboard";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data = await getLeaderboard(params.id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
    },
  });
}
