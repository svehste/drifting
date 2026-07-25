"use client";

import { useFormState, useFormStatus } from "react-dom";
import { nb } from "@/copy/nb";
import type { Criterion } from "@/domain/types";
import { submitScore } from "@/server/actions/scoring";
import type { ScoreValue } from "@/server/queries/scoring";
import type { ActionResult } from "@/server/actions/_result";

const EMPTY: ActionResult = { ok: true };

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <div className="cell-buttons">
      <button type="submit" name="intent" value="save" className="btn-secondary" disabled={pending}>
        {nb.actions.save}
      </button>
      <button type="submit" name="intent" value="confirm" className="btn-primary" disabled={pending}>
        {nb.actions.confirm}
      </button>
    </div>
  );
}

export function ScoreCell({
  runId,
  criterion,
  value,
  editable,
  maxA,
  maxB,
}: {
  runId: string;
  criterion: Criterion;
  value: ScoreValue | null;
  editable: boolean;
  maxA: number;
  maxB?: number; // style: effort max (maxA = flow max)
}) {
  const [state, formAction] = useFormState(submitScore, EMPTY);
  const label = nb.criterion[criterion];
  const confirmed = value?.confirmed ?? false;

  if (!editable) {
    const shown =
      criterion === "style"
        ? value && (value.flow != null || value.effort != null)
          ? `${value.flow ?? 0}+${value.effort ?? 0}`
          : "—"
        : (value?.points ?? "—");
    return (
      <div className={`score-cell ${confirmed ? "is-confirmed" : ""}`}>
        <span className="cell-label">{label}</span>
        <span className="cell-readonly">
          {shown} {confirmed ? "✓" : ""}
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} className={`score-cell ${confirmed ? "is-confirmed" : ""}`}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="criterion" value={criterion} />
      <span className="cell-label">
        {label} {confirmed ? "✓" : ""}
      </span>
      {criterion === "style" ? (
        <div className="cell-inputs">
          <input
            type="number"
            name="flow"
            min={0}
            max={maxA}
            defaultValue={value?.flow ?? ""}
            aria-label={nb.criterion.flow}
            placeholder={nb.criterion.flow}
          />
          <input
            type="number"
            name="effort"
            min={0}
            max={maxB}
            defaultValue={value?.effort ?? ""}
            aria-label={nb.criterion.effort}
            placeholder={nb.criterion.effort}
          />
        </div>
      ) : (
        <input
          type="number"
          name="points"
          min={0}
          max={maxA}
          defaultValue={value?.points ?? ""}
          aria-label={label}
        />
      )}
      <Buttons />
      {!state.ok ? <span className="error">{state.error}</span> : null}
    </form>
  );
}
