"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that asks for confirmation first (Admin management AC 3:
 * destructive actions require confirmation). Place inside a <form action={…}>.
 */
export function ConfirmButton({
  label,
  confirm,
  variant = "danger",
}: {
  label: string;
  confirm: string;
  variant?: "danger" | "default";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={variant === "danger" ? "btn-danger" : "btn-secondary"}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "…" : label}
    </button>
  );
}
