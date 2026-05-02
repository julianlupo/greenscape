/**
 * Happy path integration test.
 *
 * Hits real Anthropic + real Supabase. Costs ~$0.03 per run (two Claude
 * Sonnet 4.6 calls). Run before deploying:
 *
 *     npm run test:happy
 *
 * Asserts:
 *   1. Proposal row creates in `draft`.
 *   2. Scope extraction produces ≥1 feature with valid complexity.
 *   3. Drafting produces ≥1 line item, non-zero total, valid markdown,
 *      and transitions status to `pending_approval`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { supabase } from "../lib/supabase";
import { runProposalDrafting, runScopeExtraction } from "../lib/pipeline";
import type { ProposalRow } from "../lib/types";

const SAMPLE_NOTES = `Met with the Hendersons at 4421 E Stanford Dr. Backyard re-do. They want:
- 600 sqft travertine patio off the slider, French pattern, charcoal grout
- 12x14 cedar pergola over the patio, sealed clear
- Linear gas fire pit on the south end of the patio, 60in, glass media
- Pondless waterfall on the east wall, 6-8ft drop
- Replace 1200 sqft of dead lawn with pet-grade turf — they have 2 dogs
- Smart drip system on the new planting bed along the back wall (~80 ft)
- Path lighting, brass — maybe 8-10 fixtures, plus 4 uplights on the saguaro
HOA review needed (Stonebridge). Tight side gate — won't fit a skid steer.
Slope toward the house at the east corner — drainage matters here.
Budget they floated: ~$45-55K. I'd bring in PM + dust control given the dogs.`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function main() {
  console.log("Happy path test starting\n");
  console.log("Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY\n");

  const sb = supabase();

  // 1. Create proposal
  console.log("1/4 Creating proposal...");
  const { data: proposal, error: insertErr } = await sb
    .from("proposals")
    .insert({
      customer_name: "Happy Path Test (Henderson)",
      customer_email: "happypath@example.com",
      customer_phone: "(602) 555-0182",
      project_address: "4421 E Stanford Dr, Phoenix AZ 85018",
      site_walk_notes: SAMPLE_NOTES,
      status: "draft",
    })
    .select()
    .single();
  assert(!insertErr && proposal, `proposal create: ${insertErr?.message}`);
  console.log(`    ✓ Created ${proposal.id}\n`);

  // 2. Scope extraction
  console.log("2/4 Running scope extraction (Claude call #1)...");
  const t1 = Date.now();
  const scope = await runScopeExtraction(proposal.id);
  const t1ms = Date.now() - t1;
  assert(scope.features.length >= 1, `expected ≥1 feature, got ${scope.features.length}`);
  assert(
    ["simple", "moderate", "complex"].includes(scope.estimated_complexity),
    `bad complexity ${scope.estimated_complexity}`
  );
  console.log(`    ✓ ${scope.features.length} features, complexity=${scope.estimated_complexity} (${t1ms}ms)`);
  console.log(`    features: ${scope.features.map((f) => f.type).join(", ")}\n`);

  // 3. Drafting
  console.log("3/4 Running proposal drafting (Claude call #2)...");
  const t2 = Date.now();
  const drafted = await runProposalDrafting(proposal.id);
  const t2ms = Date.now() - t2;
  assert(drafted.line_items.length >= 1, `expected ≥1 line item, got ${drafted.line_items.length}`);
  assert(drafted.total_cents > 0, `expected total > 0, got ${drafted.total_cents}`);
  assert(
    ["high", "medium", "low"].includes(drafted.draft.confidence),
    `bad confidence ${drafted.draft.confidence}`
  );
  console.log(
    `    ✓ ${drafted.line_items.length} items, total $${(drafted.total_cents / 100).toLocaleString()}, confidence=${drafted.draft.confidence} (${t2ms}ms)\n`
  );

  // 4. Verify final state
  console.log("4/4 Verifying final state...");
  const { data: finalRow } = await sb.from("proposals").select("*").eq("id", proposal.id).single();
  assert(finalRow, "couldn't reload proposal");
  const final = finalRow as ProposalRow;
  assert(
    final.status === "pending_approval",
    `expected pending_approval, got ${final.status}`
  );
  assert(
    final.proposal_markdown && final.proposal_markdown.length > 100,
    `proposal_markdown too short (${final.proposal_markdown?.length ?? 0} chars)`
  );
  assert(final.subtotal_cents === drafted.subtotal_cents, "subtotal mismatch");
  console.log(`    ✓ status=${final.status}, markdown=${final.proposal_markdown!.length} chars\n`);

  console.log("✅ Happy path passed");
  console.log(`   Proposal: ${proposal.id}`);
  console.log(`   Status:   ${final.status}`);
  console.log(`   Total:    $${(final.total_cents / 100).toLocaleString()}`);
  console.log(`   Review:   ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/review/${proposal.id}`);
}

main().catch((err) => {
  console.error("\n❌ Happy path FAILED");
  console.error(err);
  process.exit(1);
});
