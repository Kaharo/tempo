export type GenerateRequest = {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens: number;
  topP?: number;
  /** Ask the provider for a JSON object if it supports a native JSON mode. */
  json?: boolean;
  /** Used by the manual provider to name request/response files. */
  runId: string;
};
export type GenerateResult = { text: string; inputTokens: number | null; outputTokens: number | null; model: string };

export interface ModelProvider {
  id: string;
  kind: string;
  available(): { ok: true } | { ok: false; reason: string };
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

/** Thrown by the manual provider when a response has not been supplied yet. */
export class ManualResponsePending extends Error {
  constructor(public requestPath: string, public responsePath: string) {
    super(`Manual response pending. Request written to ${requestPath}; place the JSON response at ${responsePath} and re-run.`);
  }
}
