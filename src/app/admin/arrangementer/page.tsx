import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Arrangementer folded into the Dashboard (UX_review1 §4). */
export default function ArrangementerRedirect() {
  redirect("/admin");
}
