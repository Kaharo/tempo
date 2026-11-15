import { createHash } from "node:crypto";

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_src|cmpid|ocid|smid|at_medium|at_campaign)/i;

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString().replace(/^http:/, "https:");
  } catch {
    return raw.trim();
  }
}

const STOP = new Set(("a an the and or of to in on for with by from at as is are was were be been it its this that " +
  "after before over under into about new says say said will would could can may might how why what who").split(" "));

export function titleTokens(title: string): string[] {
  return [...new Set(
    title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  )];
}

export function fingerprint(title: string): string {
  return createHash("sha1").update(titleTokens(title).sort().join(" ")).digest("hex").slice(0, 16);
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  const inter = a.filter((x) => sb.has(x)).length;
  return inter / (a.length + b.length - inter);
}

export function stripHtml(s: string | undefined | null, max = 1200): string | null {
  if (!s) return null;
  const t = s.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}
