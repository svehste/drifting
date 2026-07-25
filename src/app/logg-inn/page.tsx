import { nb } from "@/copy/nb";
import { LoginForm } from "./login-form";

export const metadata = { title: `${nb.nav.signIn} — ${nb.appName}` };

export default function LoginPage() {
  return (
    <main className="container narrow">
      <h1>{nb.nav.signIn}</h1>
      <p className="muted">Kun for arrangementsstab (admin, dommer, sekretær).</p>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <LoginForm />
      </div>
    </main>
  );
}
