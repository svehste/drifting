/** Read queries for the public driver page (resolved by UUID, no auth). */
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, events, races, registrations, userRoles, users } from "@/db/schema";
import type { RaceStatus } from "@/domain/types";

export interface DriverContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  club: string | null;
  car: string | null;
  startNumber: string | null;
  startNumberIsDummy: boolean;
}

/**
 * Resolve a driver by their user id (the private page token). Returns null when
 * the id doesn't exist or the user isn't a driver — the page then 404s.
 */
export async function getDriverByUuid(uuid: string): Promise<DriverContact | null> {
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      club: users.club,
      car: users.car,
      startNumber: users.startNumber,
      startNumberIsDummy: users.startNumberIsDummy,
    })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "driver")))
    .where(eq(users.id, uuid))
    .limit(1);

  return rows[0] ?? null;
}

export interface DriverRaceEntry {
  registrationId: string;
  eventName: string;
  raceName: string;
  className: string;
  raceStatus: RaceStatus;
  startDate: string;
  qualifyingScore: number | null;
  qualifyingRank: number | null;
  finalPlace: number | null;
}

export interface DriverProfile {
  contact: DriverContact;
  upcoming: DriverRaceEntry[];
  historic: DriverRaceEntry[];
}

/**
 * The full read-only driver page (Driver page ACs): contact info, upcoming races,
 * and historic races (finished) with qualifying + cup results. History spans
 * events through Registration.
 */
export async function getDriverProfile(uuid: string): Promise<DriverProfile | null> {
  const contact = await getDriverByUuid(uuid);
  if (!contact) return null;

  const entries: DriverRaceEntry[] = await db
    .select({
      registrationId: registrations.id,
      eventName: events.name,
      raceName: races.name,
      className: classes.name,
      raceStatus: races.status,
      startDate: events.startDate,
      qualifyingScore: registrations.qualifyingScore,
      qualifyingRank: registrations.qualifyingRank,
      finalPlace: registrations.finalPlace,
    })
    .from(registrations)
    .innerJoin(races, eq(races.id, registrations.raceId))
    .innerJoin(events, eq(events.id, races.eventId))
    .innerJoin(classes, eq(classes.id, races.classId))
    .where(eq(registrations.userId, uuid))
    .orderBy(desc(events.startDate));

  return {
    contact,
    upcoming: entries.filter((e) => e.raceStatus !== "finished"),
    historic: entries.filter((e) => e.raceStatus === "finished"),
  };
}
