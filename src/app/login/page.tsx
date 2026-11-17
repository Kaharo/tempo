import { googleEnabled } from "@/lib/auth/google";
export const dynamic = "force-dynamic";
const ERR: Record<string, string> = {
  "1": "Неверный email или пароль.",
  google_off: "Вход через Google ещё не настроен.",
  google_state: "Не удалось подтвердить вход через Google. Попробуйте ещё раз.",
  google_token: "Google не подтвердил вход. Попробуйте ещё раз.",
  google_account: "Этот аккаунт Google не является владельцем TEMPO.",
};
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next ?? "/";
  return (
    <main style={{ maxWidth: 360, margin: "0 auto", padding: "14vh 20px" }}>
      <div className="wordmark" style={{ textAlign: "center", paddingBottom: 28, borderBottom: "1px solid var(--rule)", marginBottom: 32 }}>TEMPO</div>
      {sp.error && <p role="alert" style={{ marginBottom: 16, fontWeight: 600 }}>{ERR[sp.error] ?? "Не удалось войти."}</p>}
      {googleEnabled() && (
        <>
          <a className="btn" href={`/api/auth/google?next=${encodeURIComponent(next)}`} style={{ width: "100%", justifyContent: "center", height: 44 }}>Войти через Google</a>
          <p className="cap" style={{ textAlign: "center", margin: "18px 0" }}>или по паролю</p>
        </>
      )}
      <form method="post" action="/api/login">
        <input type="hidden" name="next" value={next} />
        <label className="field">Email<input name="email" type="email" required autoComplete="username" /></label>
        <label className="field">Пароль<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center", height: 44, ...(googleEnabled() ? { background: "#fff", color: "var(--ink)", border: "1px solid var(--ink)" } : {}) }}>Войти</button>
      </form>
      <p className="fine" style={{ textAlign: "center" }}>Пароль хранится в Vercel: проект tempo → Settings → Environment Variables → TEMPO_ADMIN_PASSWORD.</p>
    </main>
  );
}
