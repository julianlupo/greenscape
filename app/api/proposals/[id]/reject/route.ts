import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import type { ProposalRow } from "@/lib/types";

export const runtime = "nodejs";

const RejectSchema = z.object({ reason: z.string().max(2000).optional().default("") });

/**
 * POST /api/proposals/[id]/reject
 * Marcus killed the draft. State guard: must be `pending_approval`.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const sb = supabase();
  const { data: row, error: fetchErr } = await sb
    .from("proposals")
    .select("status")
    .eq("id", params.id)
    .single();
  if (fetchErr || !row) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if ((row as Pick<ProposalRow, "status">).status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot reject: status is '${(row as Pick<ProposalRow, "status">).status}'` },
      { status: 409 }
    );
  }

  const rejectedAt = new Date().toISOString();
  const { error } = await sb
    .from("proposals")
    .update({ status: "rejected", rejected_at: rejectedAt })
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await logEvent(params.id, "rejected", { reason: parsed.data.reason, rejected_at: rejectedAt });
  return NextResponse.json({ ok: true });
}
