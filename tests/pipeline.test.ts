import { describe, it, expect } from "vitest";
import { parseFeed } from "@/lib/sources/adapters/rss";
import { parseRobots } from "@/lib/sources/robots";
import { canonicalUrl, fingerprint } from "@/lib/pipeline/normalize";
import { clusterItems, verifyCluster, routeCluster } from "@/lib/pipeline/process";
import { validateOutput } from "@/lib/agents/output";
import { loadAgent, loadAllAgents } from "@/lib/agents/config";

const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>T</title>
<item><title>Lab releases &amp; open model</title><link>https://ex.com/a?utm_source=x</link><pubDate>Sat, 14 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description><dc:creator>Ann</dc:creator></item>
<item><title>No link</title></item></channel></rss>`;
const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">Atom item</title><link rel="alternate" href="https://ex.org/b"/><updated>2026-11-14T08:00:00Z</updated><summary>Sum</summary><author><name>Bo</name></author></entry></feed>`;
const rdf = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><item rdf:about="https://arxiv.org/abs/1"><title>Paper</title><link>https://arxiv.org/abs/1</link><dc:date>2026-11-14</dc:date></item></rdf:RDF>`;

describe("feed parsing", () => {
  it("parses RSS 2.0 and strips HTML, skips items without links", () => {
    const items = parseFeed(rss);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Lab releases & open model", summary: "Hello world", author: "Ann" });
    expect(items[0].publishedAt?.toISOString()).toBe("2026-11-14T10:00:00.000Z");
  });
  it("parses Atom and RDF", () => {
    expect(parseFeed(atom)[0]).toMatchObject({ url: "https://ex.org/b", author: "Bo" });
    expect(parseFeed(rdf)[0]).toMatchObject({ url: "https://arxiv.org/abs/1", title: "Paper" });
  });
  it("rejects non-feeds", () => { expect(() => parseFeed("<html><body/></html>")).toThrow(); });
});

describe("normalisation", () => {
  it("canonicalises URLs", () => {
    expect(canonicalUrl("http://www.Ex.com/a/?utm_source=x&b=2&a=1#frag")).toBe("https://ex.com/a?a=1&b=2");
  });
  it("fingerprints are order/stopword insensitive", () => {
    expect(fingerprint("OpenAI releases new model")).toBe(fingerprint("New model releases: OpenAI"));
  });
  it("robots: specific group beats *", () => {
    expect(parseRobots("User-agent: *\nDisallow: /private\n\nUser-agent: tempo\nDisallow: /feeds", "tempo")).toEqual(["/feeds"]);
    expect(parseRobots("User-agent: *\nDisallow:\n", "tempo")).toEqual([]);
  });
});

const mk = (id: string, providerId: string, title: string, tier = 2, h = 2) => ({
  id, providerId, url: `https://${providerId}.com/${id}`, canonicalUrl: `https://${providerId}.com/${id}`, title, summary: null, author: null,
  publishedAt: new Date(Date.now() - h * 3600_000), retrievedAt: new Date(), retrievalMethod: "rss", language: "en",
  topics: ["ai", "technology"], fingerprint: fingerprint(title), clusterId: null, raw: null, tier,
});

describe("dedup / verification / routing", () => {
  const items = [
    mk("1", "bbc", "EU agrees landmark AI Act enforcement rules for general purpose models"),
    mk("2", "guardian", "EU agrees AI Act enforcement rules for general-purpose models"),
    mk("3", "nasa", "NASA telescope spots water vapour on distant exoplanet", 1),
  ];
  const clusters = clusterItems(items, 0.42);
  it("clusters the same event from two outlets", () => {
    expect(clusters).toHaveLength(2);
    expect(clusters.find((c) => c.items.length === 2)!.items.map((i) => i.id).sort()).toEqual(["1", "2"]);
  });
  it("merges an announcement with a differently-worded report of it", () => {
    const a = { ...mk("w1", "openai", "Introducing ChatGPT Wallet", 1), summary: "ChatGPT Wallet lets agents complete purchases" };
    const b = { ...mk("w2", "techcrunch", "ChatGPT's new Wallet lets AI agents shop and check out for you"), summary: "OpenAI launched a wallet for agents" };
    const c = { ...mk("w3", "bbc", "Wallet sales rise as shoppers return to stores"), summary: "Leather goods retailers report growth" };
    const cl = clusterItems([a, b, c], 0.42);
    expect(cl).toHaveLength(2);
    expect(cl.find((x) => x.items.length === 2)!.items.map((i) => i.id).sort()).toEqual(["w1", "w2"]);
  });
  it("marks multi-provider stories corroborated, tier-1 singles as single_source", () => {
    expect(verifyCluster(clusters.find((c) => c.items.length === 2)!.items).status).toBe("corroborated");
    expect(verifyCluster([items[2]]).status).toBe("single_source");
    expect(verifyCluster([mk("4", "x", "Rumour", 3)]).status).toBe("unverified");
  });
  it("flags future-dated items", () => {
    const f = { ...mk("5", "y", "t"), publishedAt: new Date(Date.now() + 5 * 3600_000) };
    expect(verifyCluster([f]).notes.join(" ")).toMatch(/future/);
  });
  it("routes AI regulation story to ORBIX and/or APEX", () => {
    const r = routeCluster(clusters.find((c) => c.items.length === 2)!, loadAllAgents());
    expect(r.some((a) => ["orbix", "apex"].includes(a))).toBe(true);
  });
});

describe("agent configs & QA gate", () => {
  it("loads all six agents with valid, independent configs", () => {
    const ids = loadAllAgents().map((a) => a.config.id).sort();
    expect(ids).toEqual(["apex", "archive", "gaya", "lexicon", "meridian", "orbix"]);
    expect(new Set(loadAllAgents().map((a) => a.contentHash)).size).toBe(6);
  });
  const cfg = loadAgent("orbix").config;
  const body = Array(80).fill("слово").join(" ");
  const good = { cluster_id: "c1", perspective: { headline: "Заголовок новости", body, refs: [1] }, article: null };
  it("accepts a grounded output", () => { expect(validateOutput(good, cfg, 2, new Set(["c1"])).errors).toEqual([]); });
  it("rejects invented citations and unknown stories", () => {
    const bad = { ...good, cluster_id: "zzz", perspective: { ...good.perspective, refs: [7] } };
    const e = validateOutput(bad, cfg, 2, new Set(["c1"])).errors.join(" | ");
    expect(e).toMatch(/\[7\] is not in the source pack/);
    expect(e).toMatch(/was not in the pack/);
  });
  it("rejects banned phrases", () => {
    const bad = { ...good, perspective: { ...good.perspective, body: body + " революционный" } };
    expect(validateOutput(bad, cfg, 2, new Set(["c1"])).errors.join()).toMatch(/banned/);
  });
});

import { readSse } from "@/lib/ai/providers/openai";
describe("streaming answers", () => {
  it("joins content deltas split across network chunks and reads usage", async () => {
    const sse = 'data: {"model":"m","choices":[{"delta":{"content":"{\\"ok\\":"}}]}\n\ndata: {"choices":[{"delta":{"reasoning":"skip me"}}]}\n\ndata: {"choices":[{"delta":{"content":" true}"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":5}}\n\ndata: [DONE]\n\n';
    const bytes = new TextEncoder().encode(sse);
    const stream = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < bytes.length; i += 37) c.enqueue(bytes.slice(i, i + 37)); c.close(); } });
    expect(await readSse(stream)).toEqual({ text: '{"ok": true}', inputTokens: 12, outputTokens: 5, model: "m" });
  });
});
