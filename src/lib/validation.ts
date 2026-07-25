import { z } from "zod";

/** True for a well-formed UUID — guards DB lookups on user-supplied ids. */
export function isUuid(value: string): boolean {
  return z.string().uuid().safeParse(value).success;
}
