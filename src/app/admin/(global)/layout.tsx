import Link from "next/link";
import { nb } from "@/copy/nb";
import { signOut } from "@/server/actions/auth-actions";
import { requireUser } from "@/server/authz";
import { NavLink } from "../_components/nav-link";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/admin/klasser", label: nb.nav.classes },
  { href: "/admin/forere", label: nb.nav.drivers },
  { href: "/admin/brukere", label: nb.nav.users },
  { href: "/admin/logg", label: nb.nav.auditLog },
];

/** Chrome for the global (cross-event) pages: the Dashboard and the global lists. */
export default async function GlobalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <header className="admin-header">
        <nav className="admin-nav">
          <Link href="/admin" className="brand">
            {nb.appName}
          </Link>
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
        <div className="admin-user">
          <span className="muted">
            {user.firstName} {user.lastName}
          </span>
          <form action={signOut}>
            <button type="submit" className="btn-secondary">
              {nb.nav.signOut}
            </button>
          </form>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
