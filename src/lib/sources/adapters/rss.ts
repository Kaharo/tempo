import { XMLParser } from "fast-xml-parser";
import { stripHtml } from "@/lib/pipeline/normalize";
import type { FetchedItem, SourceAdapter } from "./types";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", trimValues: true });

const text = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") return text((v as Record<string, unknown>)["#text"]);
  return null;
};
const arr = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parses RSS 2.0, Atom 1.0 and RSS 1.0 (RDF) documents. Pure function — unit tested. */
export function parseFeed(xml: string, maxItems = 50): FetchedItem[] {
  const doc = parser.parse(xml);
  const out: FetchedItem[] = [];
  if (doc.rss?.channel) {
    for (const it of arr(doc.rss.channel.item)) {
      const link = text(it.link) ?? text(it.guid);
      const title = stripHtml(text(it.title), 400);
      if (!link || !title) continue;
      out.push({
        url: link, title,
        summary: stripHtml(text(it.description) ?? text(it["content:encoded"])),
        author: text(it["dc:creator"]) ?? text(it.author),
        publishedAt: parseDate(text(it.pubDate) ?? text(it["dc:date"])),
      });
    }
  } else if (doc.feed) {
    for (const e of arr(doc.feed.entry)) {
      const links = arr(e.link) as Record<string, string>[];
      const alt = links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0];
      const link = alt?.["@href"] ?? text(e.id);
      const title = stripHtml(text(e.title), 400);
      if (!link || !title) continue;
      out.push({
        url: link, title,
        summary: stripHtml(text(e.summary) ?? text(e.content)),
        author: text(e.author?.name),
        publishedAt: parseDate(text(e.published) ?? text(e.updated)),
      });
    }
  } else if (doc["rdf:RDF"]) {
    for (const it of arr(doc["rdf:RDF"].item)) {
      const link = text(it.link) ?? it["@rdf:about"];
      const title = stripHtml(text(it.title), 400);
      if (!link || !title) continue;
      out.push({ url: link, title, summary: stripHtml(text(it.description)), author: text(it["dc:creator"]), publishedAt: parseDate(text(it["dc:date"])) });
    }
  } else {
    throw new Error("Unrecognised feed format");
  }
  return out.slice(0, maxItems);
}

export const rssAdapter: SourceAdapter = {
  kind: "rss",
  async fetch({ url, etag, lastModified, timeoutMs, userAgent, maxItems }) {
    const headers: Record<string, string> = { "user-agent": userAgent, accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5" };
    if (etag) headers["if-none-match"] = etag;
    if (lastModified) headers["if-modified-since"] = lastModified;
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
      if (res.status === 304) return { status: "ok", items: [], notModified: true, etag, lastModified };
      if (!res.ok) return { status: "error", items: [], error: `HTTP ${res.status}` };
      const items = parseFeed(await res.text(), maxItems);
      return { status: "ok", items, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") };
    } catch (e) {
      return { status: "error", items: [], error: (e as Error).message };
    }
  },
};
