import { NextResponse } from "next/server";
import { ProposalIntakeSchema } from "@/lib/schemas";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * POST /api/proposals
 *
 * Creates a new proposal in `draft` state from intake form data.
 * Pipeline (extract → draft → slack) is kicked off by separate endpoints,
 * orchestrated client-side from the intake form so each step is observable.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ProposalIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sb = supabase();
  const { data, error } = await sb
    .from("proposals")
    .insert({ ...parsed.data, status: "draft" })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/proposals] insert failed:", error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  await logEvent(data.id, "created", { customer_name: data.customer_name });
  return NextResponse.json({ proposal: data }, { status: 201 });
}

/**
 * GET /api/proposals — list, newest first. Drives the dashboard page.
 */
export async function GET() {
  const { data, error } = await supabase()
    .from("proposals")
    .select("id, customer_name, project_address, status, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[GET /api/proposals] failed:", error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ proposals: data });
}
