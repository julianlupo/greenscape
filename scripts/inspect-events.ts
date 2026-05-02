import { config } from "dotenv";
config({ path: ".env.local" });
import { supabase } from "../lib/supabase";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: tsx scripts/inspect-events.ts <proposal_id>");
    process.exit(1);
  }

  const sb = supabase();
  const { data } = await sb
    .from("proposal_events")
    .select("event_type, payload, created_at")
    .eq("proposal_id", id)
    .order("created_at");

  for (const e of data ?? []) {
    console.log(`${e.created_at}  ${e.event_type}`);
    if (Object.keys(e.payload as object).length > 0) {
      console.log(`  ${JSON.stringify(e.payload)}`);
    }
  }
}

main();
