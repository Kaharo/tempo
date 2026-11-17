import { NextResponse } from "next/server";
import { googleEnabled, redirectUri, STATE_COOKIE } from "@/lib/auth/google";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/login?error=google_off", req.url), 303);
  const next = new URL(req.url).searchParams.get("next") ?? "/";
  const nonce = crypto.randomUUID();
  const state = `${nonce}|${next.startsWith("/") && !next.startsWith("//") ? next : "/"}`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(req), response_type: "code",
    scope: "openid email", state, prompt: "select_account", ...(process.env.TEMPO_ADMIN_EMAIL ? { login_hint: process.env.TEMPO_ADMIN_EMAIL } : {}),
  }).toString();
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
