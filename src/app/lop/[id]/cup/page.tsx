import { notFound } from "next/navigation";
import { isUuid } from "@/lib/validation";
import { getBracket } from "@/server/queries/bracket";
import { BracketView } from "./bracket-view";

export const dynamic = "force-dynamic";

export default async function CupPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const data = await getBracket(params.id);
  if (!data) notFound();

  return (
    <main className="container">
      <BracketView initial={data} />
    </main>
  );
}
