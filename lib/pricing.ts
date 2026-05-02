/**
 * Deterministic line item matching — pure function, no LLM, no I/O except
 * the one Supabase fetch at the top of `matchLineItems`.
 *
 * Why no LLM here: this is a retrieval problem, not a reasoning problem.
 * Using Claude to filter 50 rows by category + keywords would be slower,
 * more expensive, and harder to debug. The only LLM step is item *selection*
 * (Claude call #2) — and it sees the curated candidate list this function
 * produces. At ~2k+ pricing items we'd swap this for embeddings.
 *
 * Algorithm per feature:
 *   1. Map feature.type → one or more categories.
 *   2. Filter pricing_items to those categories.
 *   3. Score each item: 2 pts per exact keyword/token match against the
 *      feature's materials/notes/dimensions, 1 pt per substring match.
 *   4. Return all items in the matching categories, sorted by score desc.
 *      We DON'T cut off at score > 0 — Claude needs the full menu in that
 *      category, even items that don't keyword-match, so it can pick
 *      complements (e.g. a base flagstone option even if Marcus only said
 *      "stone patio" without specifying material).
 *
 * In addition we always include "global" items (labor, permits, access fees,
 * project management, site protection) once per proposal so Claude can add
 * them where relevant even if no feature explicitly mentions them.
 */
import { supabase } from "./supabase";
import type {
  ExtractedFeature,
  ExtractedScope,
  FeatureCandidates,
  PricingItemRow,
  ScoredPricingCandidate,
} from "./types";

const FEATURE_TO_CATEGORIES: Record<string, string[]> = {
  patio: ["hardscape"],
  hardscape: ["hardscape"],
  walkway: ["hardscape"],
  path: ["hardscape"],
  pergola: ["pergola"],
  shade: ["pergola"],
  ramada: ["pergola"],
  fire_pit: ["fire_pit"],
  fireplace: ["fire_pit"],
  water_feature: ["water_feature"],
  fountain: ["water_feature"],
  waterfall: ["water_feature"],
  retaining_wall: ["retaining_wall"],
  wall: ["retaining_wall"],
  outdoor_kitchen: ["outdoor_kitchen"],
  bbq: ["outdoor_kitchen"],
  kitchen: ["outdoor_kitchen"],
  lighting: ["lighting"],
  irrigation: ["irrigation"],
  drip: ["irrigation"],
  sprinkler: ["irrigation"],
  artificial_turf: ["artificial_turf"],
  turf: ["artificial_turf"],
  lawn: ["artificial_turf"],
  planting: ["planting"],
  trees: ["planting"],
  shrubs: ["planting"],
  demolition: ["demolition"],
  access: ["access"],
  permit: ["permit"],
  labor: ["labor"],
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "have",
  "into",
  "over",
  "under",
  "near",
  "your",
  "their",
  "about",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;./()\-_]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function featureTokens(feature: ExtractedFeature): Set<string> {
  const tokens: string[] = [];
  for (const m of feature.materials) tokens.push(...tokenize(m));
  tokens.push(...tokenize(feature.notes));
  if (feature.dimensions) tokens.push(...tokenize(feature.dimensions));
  return new Set(tokens);
}

function itemTokens(item: PricingItemRow): Set<string> {
  return new Set([
    ...item.keywords.map((k) => k.toLowerCase()),
    ...tokenize(item.name),
    ...tokenize(item.description),
  ]);
}

function scoreItem(
  item: PricingItemRow,
  feature: ExtractedFeature
): { score: number; matched: string[] } {
  const ft = Array.from(featureTokens(feature));
  const it = itemTokens(item);
  const itArr = Array.from(it);
  let score = 0;
  const matched: string[] = [];

  for (const t of ft) {
    if (it.has(t)) {
      score += 2;
      matched.push(t);
      continue;
    }
    // Substring match (cheap fuzzy): "travertine" vs "travertine-style"
    for (const i of itArr) {
      if (i.length >= 4 && (i.includes(t) || t.includes(i))) {
        score += 1;
        matched.push(t);
        break;
      }
    }
  }

  return { score, matched: Array.from(new Set(matched)) };
}

async function loadAllItems(): Promise<PricingItemRow[]> {
  const { data, error } = await supabase()
    .from("pricing_items")
    .select("*")
    .order("category");
  if (error) throw new Error(`pricing_items fetch failed: ${error.message}`);
  return (data ?? []) as PricingItemRow[];
}

export async function matchLineItems(scope: ExtractedScope): Promise<{
  per_feature: FeatureCandidates[];
  global: ScoredPricingCandidate[];
}> {
  const all = await loadAllItems();

  const per_feature: FeatureCandidates[] = scope.features.map((feature) => {
    const cats = FEATURE_TO_CATEGORIES[feature.type] ?? ["hardscape"];
    const candidates: ScoredPricingCandidate[] = all
      .filter((i) => cats.includes(i.category))
      .map((i) => {
        const { score, matched } = scoreItem(i, feature);
        return { pricing_item: i, score, matched_on: matched };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6); // top-6 per feature keeps the drafting prompt tight

    return { feature, candidates };
  });

  // Global add-ons Claude should always have access to.
  const global: ScoredPricingCandidate[] = all
    .filter((i) => ["labor", "permit", "access", "demolition"].includes(i.category))
    .map((i) => ({ pricing_item: i, score: 0, matched_on: [] }));

  return { per_feature, global };
}

// Resolve LLM picks back into stored line items with computed totals.
// Server-side arithmetic — the LLM never gets to do customer-facing math.
export interface ResolvedLineItem {
  pricing_item_id: string;
  name: string;
  category: string;
  unit: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  notes: string;
}

export async function resolvePicksToLineItems(
  picks: { pricing_item_id: string; quantity: number; notes: string }[]
): Promise<{ line_items: ResolvedLineItem[]; subtotal_cents: number; missing_ids: string[] }> {
  if (picks.length === 0) {
    return { line_items: [], subtotal_cents: 0, missing_ids: [] };
  }

  const ids = picks.map((p) => p.pricing_item_id);
  const { data, error } = await supabase().from("pricing_items").select("*").in("id", ids);
  if (error) throw new Error(`pricing_items lookup failed: ${error.message}`);

  const byId = new Map<string, PricingItemRow>(
    ((data ?? []) as PricingItemRow[]).map((i) => [i.id, i])
  );

  const line_items: ResolvedLineItem[] = [];
  const missing_ids: string[] = [];
  let subtotal_cents = 0;

  for (const pick of picks) {
    const item = byId.get(pick.pricing_item_id);
    if (!item) {
      missing_ids.push(pick.pricing_item_id);
      continue;
    }
    const qty = Math.max(0, pick.quantity);
    const line_total_cents = Math.round(item.unit_price_cents * qty);
    subtotal_cents += line_total_cents;
    line_items.push({
      pricing_item_id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      unit_price_cents: item.unit_price_cents,
      quantity: qty,
      line_total_cents,
      notes: pick.notes,
    });
  }

  return { line_items, subtotal_cents, missing_ids };
}
