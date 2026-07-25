/**
 * Final placements [sluttplasseringer] (Cup AC 11). Pure.
 *
 * 1st = final winner, 2nd = final loser, 3rd = bronsefinal winner,
 * 4th = bronsefinal loser. Lower places come from how far a driver advanced,
 * grouped by the round they were eliminated in (later round = better place) and
 * ordered within a round by qualifying position (best rank first).
 */
import type { BuiltBattle } from "./bracket";
import type { BattleRound } from "./types";

export interface Placement {
  driverId: string;
  place: number;
}

/** A decided battle between two real drivers; null otherwise (byes have no loser). */
function realLoser(b: BuiltBattle): string | null {
  if (b.driverA && b.driverB && b.winner) {
    return b.winner === b.driverA ? b.driverB : b.driverA;
  }
  return null;
}

/**
 * @param battles  the resolved bracket (winners filled in for decided battles)
 * @param rankOf   driver id → qualifying rank (1 = top qualifier)
 */
export function finalPlacements(
  battles: BuiltBattle[],
  rankOf: (driverId: string) => number,
): Placement[] {
  const placements: Placement[] = [];
  const placed = new Set<string>();
  const assign = (driverId: string | null, place: number) => {
    if (driverId && !placed.has(driverId)) {
      placed.add(driverId);
      placements.push({ driverId, place });
    }
  };

  const final = battles.find((b) => b.round === "final");
  const bronse = battles.find((b) => b.round === "bronsefinal");

  if (final?.winner) {
    assign(final.winner, 1);
    assign(realLoser(final), 2);
  }
  if (bronse?.winner) {
    assign(bronse.winner, 3);
    assign(realLoser(bronse), 4);
  }

  // Losers of earlier rounds, from latest round to earliest. Semifinal losers are
  // already placed via the bronsefinal, so that round is excluded here.
  const loserRounds: BattleRound[] = ["quarterfinal", "top16", "top32"];
  let place = 5;
  for (const round of loserRounds) {
    const losers = battles
      .filter((b) => b.round === round)
      .map(realLoser)
      .filter((id): id is string => id !== null && !placed.has(id));
    losers.sort((a, b) => rankOf(a) - rankOf(b));
    for (const id of losers) {
      assign(id, place);
      place += 1;
    }
  }

  return placements.sort((a, b) => a.place - b.place);
}
