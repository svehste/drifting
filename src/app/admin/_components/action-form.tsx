"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionResult } from "@/server/actions/_result";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const EMPTY: ActionResult = { ok: true };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "…" : label}
    </button>
  );
}

/**
 * A form bound to a server action via useFormState. Shows a Norwegian error or
 * success message and (optionally) resets its fields after a successful submit.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  resetOnSuccess = false,
  className = "stack",
}: {
  action: Action;
  submitLabel: string;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, EMPTY);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="form-footer">
        <Submit label={submitLabel} />
        {!state.ok ? <span className="error">{state.error}</span> : null}
      </div>
    </form>
  );
}
