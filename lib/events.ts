/**
 * Audit log helper — every state transition + side effect goes here.
 * Logging never blocks the caller's success path; failures are console-warned.
 */
import { supabase } from "./supabase";
import type { ProposalEventType } from "./types";

export async function logEvent(
  proposal_id: string,
  event_type: ProposalEventType,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabase()
      .from("proposal_events")
      .insert({ proposal_id, event_type, payload });
    if (error) console.warn(`[events] insert failed (${event_type}):`, error.message);
  } catch (err) {
    console.warn(`[events] threw (${event_type}):`, err);
  }
}
