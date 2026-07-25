/**
 * The single authorization point (tech_stack: "one place for authorization").
 * Every protected read and every write calls one of these before touching data.
 */
import "server-only";
import { nb } from "@/copy/nb";
import { can, type Capability } from "@/domain/permissions";
import type { Role } from "@/domain/types";
import { getCurrentUser, type CurrentUser } from "./auth";

/** Thrown when a request is not allowed; carries an HTTP-ish status for handlers. */
export class AuthzError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthzError";
    this.status = status;
  }
}

/** Require an authenticated staff user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthzError("Ikke innlogget.", 401);
  return user;
}

/** Require a capability from the permission matrix (Roles & permissions AC 1). */
export async function requireCapability(capability: Capability): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.roles, capability)) {
    throw new AuthzError(nb.errors.unauthorized);
  }
  return user;
}

/** Require at least one of the given roles (union of the user's roles). */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.some((r) => user.roles.includes(r))) {
    throw new AuthzError(nb.errors.unauthorized);
  }
  return user;
}
