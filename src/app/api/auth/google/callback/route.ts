import { NextResponse, type NextRequest } from "next/server";
import { createSession, safeEqual, SESSION_COOKIE } from "@/lib/auth/session";
import { googleEnabled, redirectUri, STATE_COOKIE } from "@/lib/auth/google";
export const dynamic = "force-dynamic";

const fail = (req: Request, code: string) => { const r = NextResponse.redirect(new URL(`/login?error=${code}`, req.url), 303); r.cookies.delete(STATE_COOKIE); return r; };

export async function GET(req: NextRequest) {
  if (!googleEnabled()) return fail(req, "google_off");
  const q = req.nextUrl.searchParams;
  const state = q.get("state") ?? ""; const saved = req.cookies.get(STATE_COOKIE)?.value ?? "";
  const code = q.get("code");
  if (!code || !saved || !safeEqual(state, saved)) return fail(req, "google_state");

  // The ID token comes straight from Google's token endpoint over TLS, so its claims can be trusted as received.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(req), grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) return fail(req, "google_token");
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  let claims: { aud?: string; iss?: string; email?: string; email_verified?: boolean | string; exp?: number };
  try { claims = JSON.parse(Buffer.from((id_token ?? "").split(".")[1], "base64url").toString("utf8")); } catch { return fail(req, "google_token"); }
  const okIss = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!okIss || claims.aud !== process.env.GOOGLE_CLIENT_ID || !verified || !claims.email || (claims.exp ?? 0) * 1000 < Date.now()) return fail(req, "google_token");

  // Single-owner app: only the configured owner address may sign in.
  const owner = (process.env.TEMPO_ADMIN_EMAIL ?? "").toLowerCase();
  if (!owner || claims.email.toLowerCase() !== owner) return fail(req, "google_account");

  const next = saved.split("|").slice(1).join("|") || "/";
  const res = NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/", req.url), 303);
  res.cookies.set(SESSION_COOKIE, await createSession(owner), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
