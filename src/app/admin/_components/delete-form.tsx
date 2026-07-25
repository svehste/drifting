"use client";

import { useFormState } from "react-dom";
import type { ActionResult } from "@/server/actions/_result";
import { ConfirmButton } from "./confirm-button";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
const EMPTY: ActionResult = { ok: true };

/** Inline delete form with a confirmation prompt and error display. */
export function DeleteForm({
  action,
  hidden,
  label,
  confirm,
}: {
  action: Action;
  hidden: Record<string, string>;
  label: string;
  confirm: string;
}) {
  const [state, formAction] = useFormState(action, EMPTY);
  return (
    <form action={formAction} className="inline-form">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ConfirmButton label={label} confirm={confirm} />
      {!state.ok ? <span className="error">{state.error}</span> : null}
    </form>
  );
}
