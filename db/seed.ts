/**
 * Seed pricing_items with a representative slice of Greenscape's catalog.
 *
 * NOTE: A real shop would have ~200 SKUs across more granular sub-categories
 * (different paver patterns, drip-line specs, fixture wattages, etc.). For the
 * take-home we ship ~50 items spanning every category Marcus's quotes touch,
 * with realistic Phoenix-market unit prices. Documented in README.
 *
 * Run: `npm run seed`
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { supabase } from "../lib/supabase";
import type { PricingUnit } from "../lib/types";

interface SeedItem {
  category: string;
  name: string;
  unit: PricingUnit;
  unit_price_cents: number;
  description: string;
  keywords: string[];
}

const ITEMS: SeedItem[] = [
  // ----------------------------------------------------------------- hardscape
  {
    category: "hardscape",
    name: "Travertine paver — 16x24, French pattern",
    unit: "sqft",
    unit_price_cents: 2200,
    description: "Premium travertine, French pattern layout, sand-set on compacted base.",
    keywords: ["travertine", "paver", "patio", "french-pattern", "stone"],
  },
  {
    category: "hardscape",
    name: "Concrete paver — 6x9 holland, charcoal",
    unit: "sqft",
    unit_price_cents: 1450,
    description: "Standard concrete paver, holland pattern. Workhorse patio surface.",
    keywords: ["concrete", "paver", "patio", "holland", "charcoal"],
  },
  {
    category: "hardscape",
    name: "Flagstone — Arizona buff, irregular",
    unit: "sqft",
    unit_price_cents: 1850,
    description: "Locally sourced flagstone, mortared on slab.",
    keywords: ["flagstone", "arizona", "stone", "patio", "buff"],
  },
  {
    category: "hardscape",
    name: "Stamped concrete — slate texture",
    unit: "sqft",
    unit_price_cents: 1100,
    description: "Poured-in-place concrete, slate stamp, integral color.",
    keywords: ["stamped", "concrete", "patio", "slate"],
  },
  {
    category: "hardscape",
    name: "Decomposed granite path — 3in compacted",
    unit: "sqft",
    unit_price_cents: 380,
    description: "DG path, edged with steel, compacted in two lifts.",
    keywords: ["dg", "decomposed-granite", "path", "walkway"],
  },
  {
    category: "hardscape",
    name: "Concrete border curb — 6in",
    unit: "linear_ft",
    unit_price_cents: 2400,
    description: "Cast-in-place concrete border, mowing strip profile.",
    keywords: ["border", "curb", "edging", "concrete"],
  },
  {
    category: "hardscape",
    name: "Steel landscape edging — corten",
    unit: "linear_ft",
    unit_price_cents: 1800,
    description: "1/8 in corten steel edging, 4 in tall, staked every 18 in.",
    keywords: ["edging", "steel", "corten", "border"],
  },

  // ---------------------------------------------------------- retaining_walls
  {
    category: "retaining_wall",
    name: "Retaining wall — split-face CMU, < 4ft",
    unit: "sqft",
    unit_price_cents: 6800,
    description: "Engineered CMU retaining wall under 4 ft, no permit, no rebar schedule revision.",
    keywords: ["retaining", "wall", "cmu", "block", "splitface"],
  },
  {
    category: "retaining_wall",
    name: "Retaining wall — boulder stack, dry",
    unit: "sqft",
    unit_price_cents: 5400,
    description: "Hand-stacked Arizona boulders, dry-laid, geo-grid backfill.",
    keywords: ["boulder", "retaining", "wall", "stack", "natural"],
  },
  {
    category: "retaining_wall",
    name: "Engineered wall package — > 4ft (permit required)",
    unit: "lump_sum",
    unit_price_cents: 450000,
    description: "Engineering, permit, inspections for any wall over 4 ft tall in Maricopa County.",
    keywords: ["engineered", "permit", "wall", "structural"],
  },

  // -------------------------------------------------------------------- pergola
  {
    category: "pergola",
    name: "Cedar pergola — 12x14, freestanding",
    unit: "each",
    unit_price_cents: 850000,
    description: "6x6 cedar posts, 2x10 beams, 2x6 rafters, sealed clear coat.",
    keywords: ["pergola", "cedar", "wood", "shade"],
  },
  {
    category: "pergola",
    name: "Aluminum louvered pergola — 14x16, motorized",
    unit: "each",
    unit_price_cents: 2200000,
    description: "Motorized louvered roof, integrated LED, rain sensor.",
    keywords: ["pergola", "aluminum", "louvered", "motorized", "shade"],
  },
  {
    category: "pergola",
    name: "Steel shade structure — powder-coated",
    unit: "sqft",
    unit_price_cents: 8800,
    description: "Custom steel shade, powder-coat finish, anchored to slab.",
    keywords: ["shade", "steel", "structure", "ramada"],
  },

  // ----------------------------------------------------------------- fire_pit
  {
    category: "fire_pit",
    name: "Gas fire pit — 48 in round, lava rock",
    unit: "each",
    unit_price_cents: 480000,
    description: "Stone-clad gas fire pit, 48 in, manual ignition, lava rock fill.",
    keywords: ["fire", "pit", "gas", "round", "stone"],
  },
  {
    category: "fire_pit",
    name: "Gas fire pit — linear 60 in, glass media",
    unit: "each",
    unit_price_cents: 620000,
    description: "Linear 60 in gas fire feature, electronic ignition, glass media.",
    keywords: ["fire", "pit", "linear", "gas", "glass"],
  },
  {
    category: "fire_pit",
    name: "Wood-burning fire pit — flagstone",
    unit: "each",
    unit_price_cents: 280000,
    description: "Wood-burning fire pit ring, flagstone surround, 60 in OD.",
    keywords: ["fire", "pit", "wood", "flagstone"],
  },

  // ------------------------------------------------------------ water_feature
  {
    category: "water_feature",
    name: "Pondless waterfall — 8 ft drop",
    unit: "each",
    unit_price_cents: 950000,
    description: "Pondless waterfall, 8 ft drop, basin, pump, rock work.",
    keywords: ["waterfall", "pondless", "water", "feature"],
  },
  {
    category: "water_feature",
    name: "Bubbler urn — single, 36 in",
    unit: "each",
    unit_price_cents: 220000,
    description: "Glazed ceramic urn, recirculating bubbler, gravel basin.",
    keywords: ["bubbler", "urn", "water", "feature"],
  },
  {
    category: "water_feature",
    name: "Spillway / sheer descent — 24 in",
    unit: "each",
    unit_price_cents: 180000,
    description: "Stainless sheer descent, 24 in lip, pump, plumbing.",
    keywords: ["spillway", "sheer", "water", "feature"],
  },

  // ---------------------------------------------------------- artificial_turf
  {
    category: "artificial_turf",
    name: "Premium turf — 80 oz, pet-grade",
    unit: "sqft",
    unit_price_cents: 1450,
    description: "Pet-grade synthetic turf, 80 oz face weight, antimicrobial infill.",
    keywords: ["turf", "synthetic", "pet", "grass", "artificial"],
  },
  {
    category: "artificial_turf",
    name: "Standard turf — 60 oz",
    unit: "sqft",
    unit_price_cents: 1100,
    description: "Standard residential turf, 60 oz, sand infill.",
    keywords: ["turf", "synthetic", "grass", "artificial"],
  },
  {
    category: "artificial_turf",
    name: "Putting green turf — 40 oz",
    unit: "sqft",
    unit_price_cents: 1850,
    description: "Putting green nylon, 40 oz, with cup install.",
    keywords: ["turf", "putting", "green", "golf"],
  },

  // ------------------------------------------------------------------ irrigation
  {
    category: "irrigation",
    name: "Drip line — 1/2 in, with emitters",
    unit: "linear_ft",
    unit_price_cents: 320,
    description: "Pressure-compensating drip line, emitters every 18 in.",
    keywords: ["drip", "irrigation", "line", "emitter"],
  },
  {
    category: "irrigation",
    name: "Pop-up spray head — 4 in",
    unit: "each",
    unit_price_cents: 2800,
    description: "4 in pop-up with adjustable nozzle.",
    keywords: ["spray", "head", "popup", "irrigation"],
  },
  {
    category: "irrigation",
    name: "Smart controller — Wi-Fi, 8 zone",
    unit: "each",
    unit_price_cents: 38000,
    description: "Wi-Fi irrigation controller, weather-based, 8 zone.",
    keywords: ["controller", "smart", "wifi", "irrigation"],
  },
  {
    category: "irrigation",
    name: "Zone valve — 1 in, with valve box",
    unit: "each",
    unit_price_cents: 18000,
    description: "1 in solenoid valve, valve box, wiring whip.",
    keywords: ["valve", "zone", "irrigation"],
  },
  {
    category: "irrigation",
    name: "Backflow preventer — 1 in PVB",
    unit: "each",
    unit_price_cents: 42000,
    description: "1 in pressure vacuum breaker, code compliant.",
    keywords: ["backflow", "pvb", "irrigation"],
  },

  // ----------------------------------------------------------- outdoor_kitchen
  {
    category: "outdoor_kitchen",
    name: "Outdoor kitchen island — 8 ft, stucco + tile",
    unit: "each",
    unit_price_cents: 1200000,
    description: "8 ft kitchen island, stucco base, tile counter, grill cutout.",
    keywords: ["kitchen", "island", "outdoor", "bbq"],
  },
  {
    category: "outdoor_kitchen",
    name: "Built-in gas grill — 36 in, stainless",
    unit: "each",
    unit_price_cents: 380000,
    description: "36 in stainless built-in grill, 4 burner.",
    keywords: ["grill", "bbq", "gas", "stainless"],
  },
  {
    category: "outdoor_kitchen",
    name: "Side burner — 12 in",
    unit: "each",
    unit_price_cents: 95000,
    description: "12 in single side burner, stainless.",
    keywords: ["burner", "side", "kitchen"],
  },
  {
    category: "outdoor_kitchen",
    name: "Refrigerator — outdoor rated, 24 in",
    unit: "each",
    unit_price_cents: 165000,
    description: "24 in outdoor-rated refrigerator.",
    keywords: ["refrigerator", "fridge", "outdoor"],
  },
  {
    category: "outdoor_kitchen",
    name: "Concrete countertop — 2 in, integral color",
    unit: "sqft",
    unit_price_cents: 14500,
    description: "Cast concrete countertop, 2 in, integral color, sealed.",
    keywords: ["countertop", "concrete", "kitchen"],
  },

  // ---------------------------------------------------------------- lighting
  {
    category: "lighting",
    name: "Path light — 12V LED, brass",
    unit: "each",
    unit_price_cents: 18500,
    description: "Solid brass path light, 12V LED, integrated transformer.",
    keywords: ["path", "light", "led", "brass", "lighting"],
  },
  {
    category: "lighting",
    name: "Uplight — 12V LED, well-mount",
    unit: "each",
    unit_price_cents: 16000,
    description: "Well-mount uplight, 12V LED, adjustable.",
    keywords: ["uplight", "led", "lighting", "well"],
  },
  {
    category: "lighting",
    name: "String light — commercial grade, 24 ft",
    unit: "each",
    unit_price_cents: 22000,
    description: "Commercial-grade string lights, 24 ft run, 12 sockets.",
    keywords: ["string", "light", "patio", "cafe"],
  },
  {
    category: "lighting",
    name: "Transformer — 300W, multi-tap",
    unit: "each",
    unit_price_cents: 48000,
    description: "300W multi-tap transformer, photocell + timer.",
    keywords: ["transformer", "lighting", "power"],
  },

  // ------------------------------------------------------------------ planting
  {
    category: "planting",
    name: "Desert tree — 24in box (mesquite, palo verde)",
    unit: "each",
    unit_price_cents: 38000,
    description: "24 in box specimen tree, planted with stakes and basin.",
    keywords: ["tree", "desert", "mesquite", "palo-verde", "planting"],
  },
  {
    category: "planting",
    name: "Saguaro cactus — 6 ft, transplant",
    unit: "each",
    unit_price_cents: 95000,
    description: "6 ft saguaro, transplanted with permit.",
    keywords: ["saguaro", "cactus", "desert", "planting"],
  },
  {
    category: "planting",
    name: "Agave / accent succulent — 5 gal",
    unit: "each",
    unit_price_cents: 8500,
    description: "5 gal agave or accent succulent.",
    keywords: ["agave", "succulent", "planting", "accent"],
  },
  {
    category: "planting",
    name: "Shrub — 5 gal",
    unit: "each",
    unit_price_cents: 4800,
    description: "5 gal flowering or evergreen shrub.",
    keywords: ["shrub", "planting"],
  },
  {
    category: "planting",
    name: "Decorative gravel — 1/2 in screened, 3 in deep",
    unit: "sqft",
    unit_price_cents: 220,
    description: "1/2 in screened gravel, 3 in deep over fabric.",
    keywords: ["gravel", "rock", "ground", "cover"],
  },

  // ---------------------------------------------------------------- demolition
  {
    category: "demolition",
    name: "Concrete demo + haul — slab",
    unit: "sqft",
    unit_price_cents: 480,
    description: "Existing slab demo, haul-off included.",
    keywords: ["demo", "demolition", "concrete", "haul"],
  },
  {
    category: "demolition",
    name: "Sod / lawn removal",
    unit: "sqft",
    unit_price_cents: 180,
    description: "Sod cut and haul-off.",
    keywords: ["sod", "lawn", "removal", "demo"],
  },
  {
    category: "demolition",
    name: "Tree removal — under 20 ft",
    unit: "each",
    unit_price_cents: 65000,
    description: "Tree removal, under 20 ft, including stump grind.",
    keywords: ["tree", "removal", "demo"],
  },

  // -------------------------------------------------------------------- labor
  {
    category: "labor",
    name: "Labor — skilled crew, hourly",
    unit: "hour",
    unit_price_cents: 8500,
    description: "Skilled crew labor, per man-hour.",
    keywords: ["labor", "hourly", "crew"],
  },
  {
    category: "labor",
    name: "Project management — design build",
    unit: "lump_sum",
    unit_price_cents: 250000,
    description: "PM, scheduling, supplier coordination, owner communication.",
    keywords: ["project", "management", "pm", "coordination"],
  },
  {
    category: "labor",
    name: "Site protection + dust control",
    unit: "lump_sum",
    unit_price_cents: 65000,
    description: "Dust fence, plywood protection, daily cleanup.",
    keywords: ["protection", "dust", "site"],
  },

  // ------------------------------------------------------------------- access
  {
    category: "access",
    name: "Tight access fee — wheelbarrow / micro skid",
    unit: "lump_sum",
    unit_price_cents: 180000,
    description: "Premium for jobs without truck or skid-steer access.",
    keywords: ["access", "tight", "wheelbarrow", "skid"],
  },
  {
    category: "access",
    name: "Crane / boom service — half day",
    unit: "lump_sum",
    unit_price_cents: 220000,
    description: "Crane / material lift, 4 hr min, used for boulders / specimen trees.",
    keywords: ["crane", "boom", "lift"],
  },

  // -------------------------------------------------------------------- permit
  {
    category: "permit",
    name: "City permit + plan review (Phoenix)",
    unit: "lump_sum",
    unit_price_cents: 95000,
    description: "City of Phoenix permit fees and plan review for hardscape > 30 in.",
    keywords: ["permit", "city", "phoenix", "plan", "review"],
  },
  {
    category: "permit",
    name: "HOA submittal package",
    unit: "lump_sum",
    unit_price_cents: 45000,
    description: "Drawings + materials package for HOA architectural review.",
    keywords: ["hoa", "submittal", "review", "homeowners"],
  },
];

async function main() {
  const sb = supabase();

  // Idempotent reseed: wipe existing rows, then insert.
  const { error: delErr } = await sb.from("pricing_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) {
    console.error("Failed to clear pricing_items:", delErr.message);
    process.exit(1);
  }

  const { error: insErr, count } = await sb
    .from("pricing_items")
    .insert(ITEMS, { count: "exact" });

  if (insErr) {
    console.error("Seed failed:", insErr.message);
    process.exit(1);
  }

  console.log(`Seeded ${count ?? ITEMS.length} pricing items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
