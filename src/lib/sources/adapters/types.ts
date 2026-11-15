export type FetchedItem = {
  url: string;
  title: string;
  summary: string | null;
  author: string | null;
  publishedAt: Date | null;
  raw?: Record<string, unknown>;
};
export type FetchResult = {
  status: "ok" | "error" | "skipped" | "blocked";
  items: FetchedItem[];
  error?: string;
  etag?: string | null;
  lastModified?: string | null;
  notModified?: boolean;
};
export interface SourceAdapter {
  kind: string;
  fetch(opts: { url: string; etag?: string | null; lastModified?: string | null; timeoutMs: number; userAgent: string; maxItems: number }): Promise<FetchResult>;
}
