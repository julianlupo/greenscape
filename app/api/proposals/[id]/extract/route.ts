import { NextResponse } from "next/server";
import { runScopeExtraction, PipelineError } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/proposals/[id]/extract
 * Runs scope extraction (Claude call #1). Idempotent on success: re-running
 * an already-extracted draft re-runs Claude and overwrites extracted_scope.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const scope = await runScopeExtraction(params.id);
    return NextResponse.json({ ok: true, scope });
  } catch (err) {
    if (err instanceof PipelineError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/proposals/[id]/extract] unexpected:", message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
