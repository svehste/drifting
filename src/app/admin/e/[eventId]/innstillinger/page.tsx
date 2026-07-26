import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { isUuid } from "@/lib/validation";
import { deleteEvent, updateEvent } from "@/server/actions/events";
import { ActionForm } from "../../../_components/action-form";
import { DeleteForm } from "../../../_components/delete-form";

export const dynamic = "force-dynamic";

/** Innstillinger tab — event details (navn/datoer/status) and delete. */
export default async function EventSettingsPage({ params }: { params: { eventId: string } }) {
  if (!isUuid(params.eventId)) notFound();
  const [event] = await db.select().from(events).where(eq(events.id, params.eventId)).limit(1);
  if (!event) notFound();

  return (
    <>
      <h1>Innstillinger</h1>

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>{nb.actions.edit}</h3>
        <ActionForm action={updateEvent} submitLabel={nb.actions.save}>
          <input type="hidden" name="id" value={event.id} />
          <label className="field">
            <span>Navn</span>
            <input name="name" defaultValue={event.name} required />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Startdato</span>
              <input name="startDate" type="date" defaultValue={event.startDate} required />
            </label>
            <label className="field">
              <span>Sluttdato</span>
              <input name="endDate" type="date" defaultValue={event.endDate} required />
            </label>
          </div>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={event.status}>
              <option value="upcoming">{nb.eventStatus.upcoming}</option>
              <option value="ongoing">{nb.eventStatus.ongoing}</option>
              <option value="finished">{nb.eventStatus.finished}</option>
            </select>
          </label>
        </ActionForm>
        <div style={{ marginTop: "1rem" }}>
          <DeleteForm
            action={deleteEvent}
            hidden={{ id: event.id }}
            label={`${nb.actions.delete} arrangement`}
            confirm={`Slette «${event.name}»? Dette er blokkert om noen løp har resultater.`}
          />
        </div>
      </div>
    </>
  );
}
