import { permanentRedirect, redirect } from "next/navigation";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Old event detail page → the event's Løp tab (UX_review1 §4, §8). */
export default function EventDetailRedirect({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) redirect("/admin");
  permanentRedirect(`/admin/e/${params.id}`);
}
