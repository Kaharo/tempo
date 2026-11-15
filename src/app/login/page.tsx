// Functional login form. Visual styling follows the approved design once references are provided.
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <main style={{ maxWidth: 360, margin: "15vh auto", fontFamily: "system-ui" }}>
      <h1>TEMPO</h1>
      {sp.error && <p role="alert">Неверный email или пароль.</p>}
      <form method="post" action="/api/login">
        <input type="hidden" name="next" value={sp.next ?? "/"} />
        <p><label>Email<br /><input name="email" type="email" required autoComplete="username" /></label></p>
        <p><label>Пароль<br /><input name="password" type="password" required autoComplete="current-password" /></label></p>
        <button type="submit">Войти</button>
      </form>
    </main>
  );
}
