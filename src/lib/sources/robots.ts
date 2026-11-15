/** Minimal robots.txt check: honours Disallow rules for `*` and our UA token. Cached per origin. */
const cache = new Map<string, { rules: string[]; at: number }>();

export async function robotsAllows(url: string, userAgent: string, timeoutMs = 8000): Promise<boolean> {
  const u = new URL(url);
  const origin = u.origin;
  let entry = cache.get(origin);
  if (!entry || Date.now() - entry.at > 6 * 3600_000) {
    let rules: string[] = [];
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) rules = parseRobots(await res.text(), "tempo");
    } catch { /* unreachable robots.txt → treat as allowed (RFC 9309 §2.3.1.3) */ }
    entry = { rules, at: Date.now() };
    cache.set(origin, entry);
  }
  const p = u.pathname + u.search;
  return !entry.rules.some((r) => r && p.startsWith(r));
}

export function parseRobots(text: string, token: string): string[] {
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const line of text.split(/\r?\n/)) {
    const m = line.replace(/#.*/, "").trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m; const key = k.toLowerCase();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], disallow: [], allow: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase()); lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if (key === "disallow") cur.disallow.push(v);
      if (key === "allow") cur.allow.push(v);
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.disallow).filter((d) => d.length > 0);
}
