/** Public bracket endpoint. Short CDN cache for the 2000-viewer polling path. */
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/validation";
import { getBracket } from "@/server/queries/bracket";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const data = await getBracket(params.id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
  });
}
