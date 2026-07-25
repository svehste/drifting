import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import {
  classes,
  events,
  raceOfficials,
  races,
  registrations,
  userRoles,
  users,
} from "@/db/schema";
import type { Criterion } from "@/domain/types";
import { isUuid } from "@/lib/validation";
import {
  addBattleJudge,
  removeOfficial,
  setCriterionJudge,
  updateRace,
} from "@/server/actions/races";
import {
  lockQualifying,
  publishLeaderboard,
  unlockQualifying,
} from "@/server/actions/qualifying";
import { registerDriver, unregisterDriver } from "@/server/actions/registrations";
import { ActionForm } from "../../_components/action-form";
import { DeleteForm } from "../../_components/delete-form";

export const dynamic = "force-dynamic";

const criteria: Criterion[] = ["line", "angle", "style"];

export default async function RaceDetailPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const [race] = await db.select().from(races).where(eq(races.id, params.id)).limit(1);
  if (!race) notFound();

  const [[event], classRows, officials, judges, regs, drivers] = await Promise.all([
    db.select().from(events).where(eq(events.id, race.eventId)).limit(1),
    db.select().from(classes).orderBy(asc(classes.sortOrder), asc(classes.name)),
    db
      .select({
        id: raceOfficials.id,
        duty: raceOfficials.duty,
        userId: raceOfficials.userId,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(raceOfficials)
      .innerJoin(users, eq(users.id, raceOfficials.userId))
      .where(eq(raceOfficials.raceId, race.id)),
    db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "judge")))
      .orderBy(asc(users.lastName)),
    db
      .select({
        id: registrations.id,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        startNumber: users.startNumber,
      })
      .from(registrations)
      .innerJoin(users, eq(users.id, registrations.userId))
      .where(eq(registrations.raceId, race.id))
      .orderBy(asc(users.lastName)),
    db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "driver")))
      .orderBy(asc(users.lastName)),
  ]);

  const criterionJudge = new Map(officials.filter((o) => o.duty !== "battle").map((o) => [o.duty, o]));
  const battleJudges = officials.filter((o) => o.duty === "battle");
  const registeredIds = new Set(regs.map((r) => r.userId));
  const availableDrivers = drivers.filter((d) => !registeredIds.has(d.id));
  const judgeName = (j: { firstName: string; lastName: string }) => `${j.firstName} ${j.lastName}`;

  return (
    <>
      <p className="muted">
        <Link href={`/admin/arrangementer/${race.eventId}`}>← {event?.name ?? nb.nav.events}</Link>
      </p>
      <h1>{race.name}</h1>
      <p className="muted">
        {nb.raceStatus[race.status]} ·{" "}
        <Link href={`/lop/${race.id}/kvalifisering`}>Scoring</Link> ·{" "}
        <Link href={`/lop/${race.id}/resultater`}>{nb.leaderboard.title}</Link> ·{" "}
        <Link href={`/admin/lop/${race.id}/cup`}>Cup-admin</Link>
      </p>

      {/* Qualifying controls */}
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>{nb.raceStatus.qualifying}</h3>
        <p className="muted">
          Status: {race.qualifyingLocked ? "låst" : "åpen"} · Tavle:{" "}
          {nb.leaderboard[race.leaderboardStatus === "official" ? "official" : race.leaderboardStatus === "unofficial" ? "unofficial" : "inProgress"]}
        </p>
        <div className="row-actions">
          {race.qualifyingLocked ? (
            <ActionForm action={unlockQualifying} submitLabel={nb.actions.unlock} className="inline-form">
              <input type="hidden" name="raceId" value={race.id} />
            </ActionForm>
          ) : (
            <ActionForm action={lockQualifying} submitLabel={nb.actions.lock} className="inline-form">
              <input type="hidden" name="raceId" value={race.id} />
            </ActionForm>
          )}
          <ActionForm action={publishLeaderboard} submitLabel={nb.actions.publish} className="inline-form">
            <input type="hidden" name="raceId" value={race.id} />
          </ActionForm>
        </div>
      </div>

      {/* Edit race */}
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>{nb.actions.edit}</h3>
        <ActionForm action={updateRace} submitLabel={nb.actions.save}>
          <input type="hidden" name="id" value={race.id} />
          <input type="hidden" name="eventId" value={race.eventId} />
          <div className="grid-2">
            <label className="field">
              <span>Navn</span>
              <input name="name" defaultValue={race.name} required />
            </label>
            <label className="field">
              <span>Klasse</span>
              <select name="classId" defaultValue={race.classId}>
                {classRows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cup-størrelse</span>
              <select name="cupSize" defaultValue={race.cupSize}>
                {["4", "8", "16", "32"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid-4">
            <label className="field">
              <span>Maks linje</span>
              <input name="maxLine" type="number" defaultValue={race.maxLine} />
            </label>
            <label className="field">
              <span>Maks vinkel</span>
              <input name="maxAngle" type="number" defaultValue={race.maxAngle} />
            </label>
            <label className="field">
              <span>Maks flyt</span>
              <input name="maxStyleFlow" type="number" defaultValue={race.maxStyleFlow} />
            </label>
            <label className="field">
              <span>Maks innsats</span>
              <input name="maxStyleEffort" type="number" defaultValue={race.maxStyleEffort} />
            </label>
          </div>
        </ActionForm>
      </div>

      {/* Officials */}
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>Dommere</h3>
        <p className="muted">Én dommer per kriterium (Løp AC 6).</p>
        {criteria.map((duty) => {
          const current = criterionJudge.get(duty);
          return (
            <ActionForm
              key={duty}
              action={setCriterionJudge}
              submitLabel={nb.actions.save}
              className="inline-form"
            >
              <input type="hidden" name="raceId" value={race.id} />
              <input type="hidden" name="duty" value={duty} />
              <span style={{ width: "5rem" }}>{nb.criterion[duty]}</span>
              <select name="userId" defaultValue={current?.userId ?? ""} required>
                <option value="" disabled>
                  Velg dommer …
                </option>
                {judges.map((j) => (
                  <option key={j.id} value={j.id}>
                    {judgeName(j)}
                  </option>
                ))}
              </select>
            </ActionForm>
          );
        })}

        <h4 style={{ marginTop: "1rem" }}>Battle-dommere</h4>
        <ul className="chip-list">
          {battleJudges.map((b) => (
            <li key={b.id} className="chip">
              {judgeName(b)}
              <DeleteForm
                action={removeOfficial}
                hidden={{ id: b.id, raceId: race.id }}
                label="×"
                confirm={`Fjerne ${judgeName(b)} som battle-dommer?`}
              />
            </li>
          ))}
          {battleJudges.length === 0 ? <li className="muted">Ingen ennå.</li> : null}
        </ul>
        <ActionForm action={addBattleJudge} submitLabel="Legg til" className="inline-form">
          <input type="hidden" name="raceId" value={race.id} />
          <select name="userId" required defaultValue="">
            <option value="" disabled>
              Velg dommer …
            </option>
            {judges.map((j) => (
              <option key={j.id} value={j.id}>
                {judgeName(j)}
              </option>
            ))}
          </select>
        </ActionForm>
      </div>

      {/* Registrations */}
      <div className="panel">
        <h3>Påmeldte førere</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Startnr.</th>
              <th>Navn</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {regs.map((r) => (
              <tr key={r.id}>
                <td>{r.startNumber ?? "—"}</td>
                <td>
                  {r.firstName} {r.lastName}
                </td>
                <td>
                  <DeleteForm
                    action={unregisterDriver}
                    hidden={{ registrationId: r.id, raceId: race.id }}
                    label="Meld av"
                    confirm={`Melde av ${r.firstName} ${r.lastName}?`}
                  />
                </td>
              </tr>
            ))}
            {regs.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  Ingen påmeldte ennå.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {availableDrivers.length > 0 ? (
          <ActionForm action={registerDriver} submitLabel="Meld på" className="inline-form">
            <input type="hidden" name="raceId" value={race.id} />
            <select name="userId" required defaultValue="">
              <option value="" disabled>
                Velg fører …
              </option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </option>
              ))}
            </select>
          </ActionForm>
        ) : (
          <p className="muted">Alle førere er påmeldt (eller ingen førere finnes).</p>
        )}
      </div>
    </>
  );
}
