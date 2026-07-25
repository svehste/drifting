"use client";

import { useFormState, useFormStatus } from "react-dom";
import { nb } from "@/copy/nb";
import { signIn, type SignInState } from "@/server/actions/auth-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "…" : nb.nav.signIn}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState<SignInState, FormData>(signIn, {});
  return (
    <form action={formAction} className="stack">
      <label className="field">
        <span>{nb.driverPage.email}</span>
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <label className="field">
        <span>Passord</span>
        <input type="password" name="password" required autoComplete="current-password" />
      </label>
      {state.error ? <p className="error">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
