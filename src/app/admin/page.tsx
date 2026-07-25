import Link from "next/link";
import { nb } from "@/copy/nb";
import { getCurrentUser } from "@/server/auth";

const cards = [
  { href: "/admin/arrangementer", title: nb.nav.events, desc: "Opprett og administrer arrangementer og løp." },
  { href: "/admin/klasser", title: nb.nav.classes, desc: "Den delte klasselisten (Pro, Semi-Pro …)." },
  { href: "/admin/brukere", title: nb.nav.users, desc: "Stab: admin, dommer, sekretær." },
  { href: "/admin/forere", title: nb.nav.drivers, desc: "Førere med klubb, bil og startnummer." },
  { href: "/admin/logg", title: nb.nav.auditLog, desc: "Hvem endret hva og når." },
];

export default async function AdminHome() {
  const user = await getCurrentUser();
  return (
    <>
      <h1>Administrasjon</h1>
      <p className="muted">
        Innlogget som {user?.firstName} {user?.lastName} · roller:{" "}
        {user?.roles.map((r) => nb.roles[r]).join(", ") || "ingen"}
      </p>
      <div className="card-grid">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="panel card-link">
            <h3>{c.title}</h3>
            <p className="muted">{c.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
