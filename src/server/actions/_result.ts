import { nb } from "@/copy/nb";
import { AuthzError } from "@/server/authz";

/** Result returned by every write action. `useFormState`-friendly. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export const ok = (message?: string): ActionResult => ({ ok: true, message });
export const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Run an action body, converting known failures into a friendly Norwegian
 * ActionResult. Note: Next's redirect() throws a special error — rethrow it so
 * navigation still happens.
 */
export async function guardAction(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (err) {
    // Let Next's redirect/notFound control-flow errors propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    if (err instanceof AuthzError) return fail(err.message);
    console.error("action error:", err);
    return fail(nb.errors.generic);
  }
}
