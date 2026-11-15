import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ManualResponsePending, type ModelProvider } from "../types";

/**
 * Development / manual-execution mode. Writes the exact prompt to
 * runs/manual/<runId>.request.md and reads the answer from
 * runs/manual/<runId>.response.json. Whoever writes the response (a human,
 * or Claude in a chat session) is recorded as provider "manual" — outputs
 * are never presented as unattended API runs.
 */
export function manualProvider(id = "manual"): ModelProvider {
  const dir = path.join(process.cwd(), "runs", "manual");
  return {
    id, kind: "manual",
    available: () => ({ ok: true }),
    async generate(req) {
      mkdirSync(dir, { recursive: true });
      const reqPath = path.join(dir, `${req.runId}.request.md`);
      const resPath = path.join(dir, `${req.runId}.response.json`);
      if (existsSync(resPath)) return { text: readFileSync(resPath, "utf8"), inputTokens: null, outputTokens: null, model: `manual:${req.model}` };
      writeFileSync(reqPath, `# SYSTEM\n\n${req.system}\n\n# USER\n\n${req.user}\n`);
      throw new ManualResponsePending(reqPath, resPath);
    },
  };
}
