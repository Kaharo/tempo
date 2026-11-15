export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <main style={{ maxWidth: 360, margin: "0 auto", padding: "14vh 20px" }}>
      <div className="wordmark" style={{ textAlign: "center", paddingBottom: 28, borderBottom: "1px solid var(--rule)", marginBottom: 32 }}>TEMPO</div>
      {sp.error && <p role="alert" style={{ marginBottom: 16, fontWeight: 600 }}>Неверный email или пароль.</p>}
      <form method="post" action="/api/login">
        <input type="hidden" name="next" value={sp.next ?? "/"} />
        <label className="field">Email<input name="email" type="email" required autoComplete="username" /></label>
        <label className="field">Пароль<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center", height: 44 }}>Войти</button>
      </form>
    </main>
  );
}
