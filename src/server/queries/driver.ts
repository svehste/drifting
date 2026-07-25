/** Read queries for the public driver page (resolved by UUID, no auth). */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userRoles, users } from "@/db/schema";

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
