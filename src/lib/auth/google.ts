/** Google sign-in for the single owner. Active only when both env vars are set. */
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const STATE_COOKIE = "tempo_oauth_state";
export function redirectUri(req: Request) {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto}://${host}/api/auth/google/callback`;
}
