"use client";

import { useFormState, useFormStatus } from "react-dom";
import { nb } from "@/copy/nb";
import { decideBattle } from "@/server/actions/cup";
import type { ActionResult } from "@/server/actions/_result";
import type { BracketBattle } from "@/server/queries/bracket";

const EMPTY: ActionResult = { ok: true };

function OutcomeButton({ value, label, primary }: { value: string; label: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="outcome"
      value={value}
      className={primary ? "btn-primary" : "btn-secondary"}
      disabled={pending}
    >
      {label}
    </button>
  );
}

export function BattleAdmin({ battle }: { battle: BracketBattle }) {
  const [state, formAction] = useFormState(decideBattle, EMPTY);
  const w = battle.winnerRegistrationId;
  const bothPresent = Boolean(battle.a && battle.b);
  const decided = battle.status === "decided" || battle.status === "bye";

  const name = (d: typeof battle.a) => (d ? `${d.startNumber ? `#${d.startNumber} ` : ""}${d.name}` : "—");

  return (
    <div className={`bd-battle admin status-${battle.status}`}>
      <div className={`bd-driver ${w && battle.a?.registrationId === w ? "is-winner" : ""}`}>
        {name(battle.a)}
      </div>
      <div className={`bd-driver ${w && battle.b?.registrationId === w ? "is-winner" : ""}`}>
        {name(battle.b)}
      </div>

      {decided ? (
        <span className="muted">
          {battle.status === "bye" ? nb.leaderboard.bye : "Avgjort"}
        </span>
      ) : bothPresent ? (
        <form action={formAction} className="decide-buttons">
          <input type="hidden" name="battleId" value={battle.id} />
          <OutcomeButton value="a" label="A" primary />
          <OutcomeButton value="b" label="B" primary />
          {battle.omtCount < 1 ? <OutcomeButton value="omt" label={nb.actions.omt} /> : null}
          {battle.status === "omt" ? <span className="bd-omt">{nb.actions.omt}</span> : null}
          {!state.ok ? <span className="error">{state.error}</span> : null}
        </form>
      ) : (
        <span className="muted">Venter på førere</span>
      )}
    </div>
  );
}
