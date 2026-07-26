"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * A nav/tab link that highlights when active. `exact` matches the path exactly;
 * otherwise a match also covers nested sub-paths. `extraActive` lists further
 * prefixes that also count as active — used by a section-root tab (e.g. "Løp",
 * whose href is the event root) so it lights up under its children without also
 * lighting up for sibling tabs nested under the same root.
 */
export function NavLink({
  href,
  label,
  exact = false,
  extraActive = [],
}: {
  href: string;
  label: string;
  exact?: boolean;
  extraActive?: string[];
}) {
  const pathname = usePathname();
  const active =
    (exact ? pathname === href : matches(pathname, href)) ||
    extraActive.some((prefix) => matches(pathname, prefix));
  return (
    <Link href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
}
