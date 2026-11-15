import { NextResponse } from "next/server";
import { createSession, safeEqual, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? ""); const password = String(form.get("password") ?? "");
  const okEmail = process.env.TEMPO_ADMIN_EMAIL ?? ""; const okPass = process.env.TEMPO_ADMIN_PASSWORD ?? "";
  if (!okPass || okPass === "change-me" || !safeEqual(email, okEmail) || !safeEqual(password, okPass)) {
    return NextResponse.redirect(new URL("/login?error=1", req.url), 303);
  }
  const next = String(form.get("next") ?? "/");
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", req.url), 303);
  res.cookies.set(SESSION_COOKIE, await createSession(email), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return res;
}
