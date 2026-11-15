import { rssAdapter } from "./rss";
import type { SourceAdapter } from "./types";

/** Adapter registry — add API-based sources (e.g. NewsAPI, GDELT, FRED) here. */
export const adapters: Record<string, SourceAdapter> = { rss: rssAdapter, atom: rssAdapter };
