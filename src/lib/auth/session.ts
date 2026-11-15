/** Single-owner auth: HMAC-signed session cookie. Edge-compatible (Web Crypto). */
const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(data: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET must be set (≥16 chars)");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
export const SESSION_COOKIE = "tempo_session";
export async function createSession(email: string, days = 30) {
  const payload = `${email}|${Date.now() + days * 86400_000}`;
  return `${btoa(payload)}.${await hmac(payload)}`;
}
export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  let payload: string;
  try { payload = atob(p); } catch { return null; }
  if ((await hmac(payload)) !== sig) return null;
  const [email, exp] = payload.split("|");
  return Number(exp) > Date.now() ? email : null;
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export function cronAuthorized(req: Request) {
  const s = process.env.CRON_SECRET;
  const h = req.headers.get("authorization") ?? "";
  return !!s && s !== "change-me" && safeEqual(h, `Bearer ${s}`);
}
