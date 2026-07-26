"use client";

import { useState } from "react";
import { nb } from "@/copy/nb";
import type { Role } from "@/domain/types";

/** Driver columns prefilled when editing an existing user with the driver role. */
export interface DriverDefaults {
  club: string | null;
  car: string | null;
  startNumber: string | null;
  startNumberIsDummy: boolean;
}

const ALL_ROLES: Role[] = ["admin", "judge", "secretary", "driver"];
const STAFF_ROLES: Role[] = ["admin", "judge", "secretary"];

/**
 * Role checkboxes plus the fields tied to each role: a login password for staff
 * roles (admin/dommer/sekretær) and the driver details for fører. Each section
 * shows only while its role is ticked, so the server action receives — and
 * persists — just the fields relevant to the selected roles.
 */
export function UserRoleFields({
  selected = [],
  driver,
}: {
  selected?: Role[];
  driver?: DriverDefaults;
}) {
  const [roles, setRoles] = useState<Set<Role>>(() => new Set(selected));

  const toggle = (role: Role, on: boolean) =>
    setRoles((prev) => {
      const next = new Set(prev);
      if (on) next.add(role);
      else next.delete(role);
      return next;
    });

  const showStaff = STAFF_ROLES.some((r) => roles.has(r));
  const showDriver = roles.has("driver");

  return (
    <>
      <div className="checkbox-row">
        {ALL_ROLES.map((role) => (
          <label key={role} className="checkbox">
            <input
              type="checkbox"
              name="roles"
              value={role}
              checked={roles.has(role)}
              onChange={(e) => toggle(role, e.target.checked)}
            />
            {nb.roles[role]}
          </label>
        ))}
      </div>

      {showStaff ? (
        <fieldset className="role-fields">
          <legend>{nb.usersForm.staffSection}</legend>
          <label className="field">
            <span>{nb.usersForm.password}</span>
            <input name="password" type="password" autoComplete="new-password" minLength={8} />
            <small>{nb.usersForm.passwordHint}</small>
          </label>
        </fieldset>
      ) : null}

      {showDriver ? (
        <fieldset className="role-fields">
          <legend>{nb.usersForm.driverSection}</legend>
          <div className="grid-2">
            <label className="field">
              <span>{nb.leaderboard.startNumber}</span>
              <input name="startNumber" defaultValue={driver?.startNumber ?? ""} />
            </label>
            <label className="checkbox" style={{ alignSelf: "end" }}>
              <input
                type="checkbox"
                name="startNumberIsDummy"
                defaultChecked={driver?.startNumberIsDummy}
              />
              {nb.driverPage.dummyTag}
            </label>
            <label className="field">
              <span>{nb.leaderboard.club}</span>
              <input name="club" defaultValue={driver?.club ?? ""} />
            </label>
            <label className="field">
              <span>{nb.leaderboard.car}</span>
              <input name="car" defaultValue={driver?.car ?? ""} />
            </label>
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
