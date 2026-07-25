import { nb } from "@/copy/nb";

export default function HomePage() {
  return (
    <main className="container">
      <h1>{nb.appName}</h1>
      <p className="muted">{nb.tagline}</p>
      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <p>
          Appen kjører. {/* The app boots — M0 smoke check. */}
          Bygging følger milepælene M0–M8 i <code>build_plan.md</code>.
        </p>
      </div>
    </main>
  );
}
