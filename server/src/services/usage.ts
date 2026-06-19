// Cumulative Claude usage tracking. The Agent SDK's terminal `result` message reports
// per-call token counts and a client-side cost ESTIMATE (total_cost_usd) — we accumulate
// those here so the app can show "how much you've used". Persisted best-effort to a JSON
// file so a server restart doesn't always reset to zero; the `since` timestamp tells the
// user what window the totals cover. NOTE: these are estimates, not authoritative billing,
// and (on the subscription) usage draws on the plan, not pay-per-use credits.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type Usage = {
  /** When counting started (ms epoch). */
  since: number;
  /** Number of chat replies generated. */
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  /** Client-side cost estimate, summed across calls (USD). */
  estimatedCostUsd: number;
};

const USAGE_FILE = process.env.USAGE_FILE || path.join(os.tmpdir(), 'iphone-claude-usage.json');

function blank(): Usage {
  return {
    since: Date.now(),
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    estimatedCostUsd: 0,
  };
}

let usage: Usage = load();

function load(): Usage {
  try {
    const raw = fs.readFileSync(USAGE_FILE, 'utf8');
    return { ...blank(), ...(JSON.parse(raw) as Partial<Usage>) };
  } catch {
    return blank();
  }
}

function persist(): void {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage));
  } catch {
    /* best-effort — a read-only FS just means totals reset on restart */
  }
}

/** Record one completed reply. `raw` is the SDK `result` message (loosely typed). */
export function recordResult(raw: any): void {
  const u = raw?.usage ?? {};
  usage.requests += 1;
  usage.inputTokens += Number(u.input_tokens ?? 0);
  usage.outputTokens += Number(u.output_tokens ?? 0);
  usage.cacheReadTokens += Number(u.cache_read_input_tokens ?? 0);
  usage.cacheCreationTokens += Number(u.cache_creation_input_tokens ?? 0);
  usage.estimatedCostUsd += Number(raw?.total_cost_usd ?? 0);
  persist();
}

export function getUsage(): Usage {
  return usage;
}

export function resetUsage(): Usage {
  usage = blank();
  persist();
  return usage;
}
