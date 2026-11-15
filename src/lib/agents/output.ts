import { z } from "zod";
import type { AgentConfig } from "./config";

const refs = z.array(z.number().int().positive());
export const AgentOutput = z.object({
  cluster_id: z.string(),
  perspective: z.object({ headline: z.string().min(3), body: z.string().min(20), refs }),
  article: z.object({
    cluster_id: z.string(),
    headline: z.string().min(3),
    dek: z.string().min(10),
    paragraphs: z.array(z.object({ text: z.string().min(20), refs: refs.default([]) })).min(3),
    facts: z.array(z.object({ statement: z.string(), refs: refs.min(1), event_date: z.string().nullable().optional() })).min(1),
    interpretation: z.array(z.string()).default([]),
    uncertainties: z.array(z.string()).default([]),
  }).nullable(),
});
export type AgentOutput = z.infer<typeof AgentOutput>;

export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{"); const end = t.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in model output");
  return JSON.parse(t.slice(start, end + 1));
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Editorial QA gate. Hard errors reject the output; warnings are stored.
 * The key guarantee: every citation number must exist in the source pack
 * that was actually sent — so citations cannot be invented.
 */
export function validateOutput(o: AgentOutput, cfg: AgentConfig, packSize: number, clusterIds: Set<string>) {
  const errors: string[] = []; const warnings: string[] = [];
  const checkRefs = (where: string, r: number[]) => r.forEach((n) => { if (n < 1 || n > packSize) errors.push(`${where}: citation [${n}] is not in the source pack (1..${packSize})`); });
  if (!clusterIds.has(o.cluster_id)) errors.push(`perspective cluster_id ${o.cluster_id} was not in the pack`);
  checkRefs("perspective", o.perspective.refs);
  if (o.perspective.refs.length < cfg.quality.min_citations_perspective) errors.push("perspective has too few citations");
  const pw = words(o.perspective.body); const [pmin, pmax] = cfg.output.perspective_words;
  if (pw < pmin * 0.7 || pw > pmax * 1.4) errors.push(`perspective length ${pw} words outside ${pmin}–${pmax}`);
  else if (pw < pmin || pw > pmax) warnings.push(`perspective length ${pw} words slightly outside ${pmin}–${pmax}`);
  const all = [o.perspective.headline, o.perspective.body];
  if (o.article) {
    const a = o.article;
    if (!clusterIds.has(a.cluster_id)) errors.push(`article cluster_id ${a.cluster_id} was not in the pack`);
    a.paragraphs.forEach((p, i) => checkRefs(`paragraph ${i + 1}`, p.refs));
    a.facts.forEach((f, i) => checkRefs(`fact ${i + 1}`, f.refs));
    const distinct = new Set([...a.paragraphs.flatMap((p) => p.refs), ...a.facts.flatMap((f) => f.refs)]);
    if (distinct.size < cfg.quality.min_citations_article) errors.push(`article cites ${distinct.size} sources; needs ${cfg.quality.min_citations_article}`);
    const aw = a.paragraphs.reduce((s, p) => s + words(p.text), 0); const [amin, amax] = cfg.output.article_words;
    if (aw < amin * 0.7) errors.push(`article too short: ${aw} words (min ${amin})`);
    else if (aw < amin || aw > amax * 1.3) warnings.push(`article length ${aw} words outside ${amin}–${amax}`);
    const uncited = a.paragraphs.filter((p) => !p.refs.length).length;
    if (uncited > Math.ceil(a.paragraphs.length / 3)) warnings.push(`${uncited} paragraphs carry no citations`);
    all.push(a.headline, a.dek, ...a.paragraphs.map((p) => p.text));
  }
  const blob = all.join(" ").toLowerCase();
  for (const b of cfg.quality.banned_phrases) if (blob.includes(b.toLowerCase())) errors.push(`banned phrase: "${b}"`);
  return { errors, warnings };
}
