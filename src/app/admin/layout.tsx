import Link from "next/link";
import { redirect } from "next/navigation";
import { nb } from "@/copy/nb";
import { signOut } from "@/server/actions/auth-actions";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/admin/arrangementer", label: nb.nav.events },
  { href: "/admin/klasser", label: nb.nav.classes },
  { href: "/admin/brukere", label: nb.nav.users },
  { href: "/admin/forere", label: nb.nav.drivers },
  { href: "/admin/logg", label: nb.nav.auditLog },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn");

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <nav className="admin-nav">
          <Link href="/admin" className="brand">
            {nb.appName}
          </Link>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
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
    </div>
  );
}
