/**
 * Per-proposal cost computation.
 *
 * The pipeline logs `tokens_in` and `tokens_out` on every Claude event
 * (extracted, drafted). We don't store cost on the proposals row — we compute
 * it on the fly from the audit log so it stays consistent if pricing changes.
 *
 * Rates are Sonnet 4.6 published prices ($3 / $15 per million tok in/out).
 * If we ever route different stages to different models, the per-event payload
 * already carries `model`; extending this to look up rates per model is a
 * one-line change.
 */
import type { ProposalEventRow } from "./types";

const RATE_INPUT_PER_MTOK_USD = 3;
const RATE_OUTPUT_PER_MTOK_USD = 15;

export interface ProposalCost {
  tokens_in: number;
  tokens_out: number;
  cents: number;
  attempts: number;
  per_event: Array<{
    event_type: string;
    tokens_in: number;
    tokens_out: number;
    cents: number;
    attempts: number;
  }>;
}

export function computeProposalCost(events: ProposalEventRow[]): ProposalCost {
  let tokens_in = 0;
  let tokens_out = 0;
  let attempts = 0;
  const per_event: ProposalCost["per_event"] = [];

  for (const e of events) {
    const p = e.payload as { tokens_in?: number; tokens_out?: number; attempts?: number };
    const ein = typeof p.tokens_in === "number" ? p.tokens_in : 0;
    const eout = typeof p.tokens_out === "number" ? p.tokens_out : 0;
    if (ein === 0 && eout === 0) continue;
    const ecents = costCents(ein, eout);
    tokens_in += ein;
    tokens_out += eout;
    attempts += typeof p.attempts === "number" ? p.attempts : 0;
    per_event.push({
      event_type: e.event_type,
      tokens_in: ein,
      tokens_out: eout,
      cents: ecents,
      attempts: typeof p.attempts === "number" ? p.attempts : 0,
    });
  }

  return { tokens_in, tokens_out, cents: costCents(tokens_in, tokens_out), attempts, per_event };
}

function costCents(tokens_in: number, tokens_out: number): number {
  // (tokens / 1M) * $/Mtok * 100 cents/$ — rounded to nearest cent.
  return Math.round(
    ((tokens_in * RATE_INPUT_PER_MTOK_USD) + (tokens_out * RATE_OUTPUT_PER_MTOK_USD)) / 1_000_000 * 100
  );
}

export function formatCostCents(cents: number): string {
  if (cents < 100) {
    // sub-dollar costs are the common case — show as cents
    return `${cents.toFixed(2)}¢`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}
