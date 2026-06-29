export const FLOUR_PROFILES = [
  {
    name: "Bread flour",
    aliases: ["strong flour", "high-gluten flour", "high protein flour"],
    activity: 1,
    starterActivity: 1,
    doughLift: 1.15,
    starterLift: 1.1,
    waterDemand: 1,
    doughScience: "High gluten-forming protein usually gives the strongest gas-holding network and the tallest wheat loaf.",
    starterScience: "A steady, predictable feed flour. A controlled study found bread flour favored a different lactic-acid-bacteria balance than all-purpose or whole wheat.",
    watch: "Strong structure can make jar height look impressive even when gas production is similar to a softer flour.",
  },
  {
    name: "All-purpose flour",
    aliases: ["plain flour", "white flour"],
    activity: 0.98,
    starterActivity: 0.98,
    doughLift: 1,
    starterLift: 1,
    waterDemand: 0.96,
    doughScience: "Moderate protein gives balanced extensibility and strength, usually with slightly less height tolerance than bread flour.",
    starterScience: "Reliable and mild, but refined flour contributes fewer bran minerals and enzymes than whole grain. Flour choice can still shift the bacterial community.",
    watch: "Often needs a little less water than bread or whole-grain flour.",
  },
  {
    name: "Whole wheat",
    aliases: ["wholemeal", "whole wheat flour"],
    activity: 1.11,
    starterActivity: 1.12,
    doughLift: 0.87,
    starterLift: 1.02,
    waterDemand: 1.12,
    doughScience: "Bran and germ add minerals, enzymes, and water demand. Fermentation often moves faster, while bran particles interrupt the gluten network and reduce maximum volume.",
    starterScience: "Often accelerates new or sluggish starters. In a 2026 controlled study, whole wheat selected a distinct bacterial balance with more Companilactobacillus.",
    watch: "Watch the dough sooner than the clock and allow time for bran to hydrate.",
  },
  {
    name: "Whole rye",
    aliases: ["dark rye", "wholemeal rye", "pumpernickel flour"],
    activity: 1.18,
    starterActivity: 1.2,
    doughLift: 0.5,
    starterLift: 0.82,
    waterDemand: 1.2,
    doughScience: "High amylase activity and water-binding arabinoxylans promote rapid acidification, but rye has little useful gluten. Structure comes mostly from starch and pentosans.",
    starterScience: "A nutrient-rich, fast-acidifying feed that commonly wakes a starter quickly. Its weak gluten means jar height can understate microbial activity.",
    watch: "Acidity is structurally important in high-rye dough because it helps control amylase; expect a dense, tacky matrix rather than wheat-style stretch.",
  },
  {
    name: "Medium rye",
    aliases: ["light rye", "rye flour"],
    activity: 1.14,
    starterActivity: 1.16,
    doughLift: 0.6,
    starterLift: 0.86,
    waterDemand: 1.13,
    doughScience: "Retains rye's active enzymes and pentosans with less bran than whole rye, so it ferments readily but still weakens wheat-style gas retention.",
    starterScience: "Usually gives a quick, aromatic feed with less mineral load than whole rye and more activity than refined white wheat.",
    watch: "Even modest rye percentages can shorten the schedule; visible dough strength will not behave like bread flour.",
  },
  {
    name: "Spelt",
    aliases: ["spelt flour"],
    activity: 1.07,
    starterActivity: 1.08,
    doughLift: 0.84,
    starterLift: 0.94,
    waterDemand: 0.96,
    doughScience: "Spelt gluten is extensible but comparatively fragile. Dough can expand quickly, then lose strength if mixed hard or fermented too far.",
    starterScience: "Spelt supports robust lactic-acid-bacteria growth and organic-acid production, but its softer matrix may show a less dramatic peak.",
    watch: "Use gentle development and shorten bulk before the dough becomes slack.",
  },
  {
    name: "Einkorn",
    aliases: ["einkorn flour"],
    activity: 1.07,
    starterActivity: 1.09,
    doughLift: 0.68,
    starterLift: 0.76,
    waterDemand: 0.93,
    doughScience: "Einkorn forms a weak, sticky gluten network with limited gas retention. It can ferment actively without producing a tall modern-wheat loaf.",
    starterScience: "Studies of ancient-wheat sourdoughs show strong microbial growth and acid accumulation. Visible rise is a poor stand-alone measure of activity.",
    watch: "Avoid chasing a bread-flour rise percentage; use bubbles, aroma, and expansion together.",
  },
  {
    name: "Emmer / farro",
    aliases: ["emmer", "farro", "emmer flour", "farro flour"],
    activity: 1.06,
    starterActivity: 1.08,
    doughLift: 0.76,
    starterLift: 0.84,
    waterDemand: 1.02,
    doughScience: "Emmer brings active whole-grain fermentation and nutty flavor, with weaker gas retention than modern bread wheat.",
    starterScience: "Ancient-wheat fermentation research found substantial bacterial growth and organic-acid production in emmer sourdough.",
    watch: "Blend with stronger wheat for taller free-form loaves, or use a pan when emmer is the majority flour.",
  },
  {
    name: "Durum / semolina",
    aliases: ["durum", "semolina", "durum flour", "semola rimacinata"],
    activity: 0.99,
    starterActivity: 1,
    doughLift: 0.9,
    starterLift: 0.86,
    waterDemand: 1.07,
    doughScience: "Durum is protein-rich, but its gluten is less elastic than bread wheat. Fine semola hydrates slowly and gives a firm, golden dough.",
    starterScience: "Supports a stable wheat starter, though coarse particles may make early rise look slower while hydration catches up.",
    watch: "Give it an early soak and judge strength after full hydration.",
  },
  {
    name: "Khorasan",
    aliases: ["kamut", "khorasan flour", "kamut flour"],
    activity: 1.04,
    starterActivity: 1.06,
    doughLift: 0.84,
    starterLift: 0.88,
    waterDemand: 1.04,
    doughScience: "Khorasan is high in protein but tends to form a more extensible, less elastic network than modern bread wheat.",
    starterScience: "As a whole ancient wheat, it supplies minerals and fermentable substrates that can support active starter growth.",
    watch: "Handle gently and avoid extending bulk solely to chase more height.",
  },
  {
    name: "Barley",
    aliases: ["barley flour", "whole barley"],
    activity: 1.05,
    starterActivity: 1.07,
    doughLift: 0.34,
    starterLift: 0.58,
    waterDemand: 1.19,
    doughScience: "Beta-glucan binds substantial water, while barley contributes no wheat-like gluten. It adds softness and flavor but lowers free-standing loaf volume.",
    starterScience: "Ferments readily and can support acid production, but a barley-heavy starter may bubble more than it rises.",
    watch: "Use as a minority flour unless the formula has a pan or another structural system.",
  },
  {
    name: "Oat flour",
    aliases: ["oat", "whole oat flour"],
    activity: 1.02,
    starterActivity: 1.04,
    doughLift: 0.24,
    starterLift: 0.48,
    waterDemand: 1.2,
    doughScience: "Oat beta-glucan raises viscosity and water demand but provides no gluten network, so higher percentages reduce loaf height.",
    starterScience: "Can acidify and bubble, yet its paste-like structure makes peak height a weak measure of yeast power.",
    watch: "Increase water gradually and pair with strong flour for an open loaf.",
  },
  {
    name: "Buckwheat",
    aliases: ["buckwheat flour"],
    activity: 1.1,
    starterActivity: 1.11,
    doughLift: 0.18,
    starterLift: 0.55,
    waterDemand: 1.14,
    doughScience: "Buckwheat is gluten-free and mineral-rich. Sourdough fermentation can be vigorous, but the dough needs wheat gluten or another binder to retain gas.",
    starterScience: "Often acidifies actively and develops a strong aroma; bubbling and acidity matter more than jar height.",
    watch: "Treat it as a flavor and fermentation flour, not a structural flour, unless building a dedicated gluten-free system.",
  },
];

export const FLOUR_BRAND_DATABASE = [
  {
    id: "king-arthur-bread",
    brand: "King Arthur",
    name: "Bread Flour",
    style: "Retail bread flour",
    closestProfile: "Bread flour",
    protein: "12.7%",
    ash: "~0.50%",
    absorption: "High · 65–68%",
    strength: "Strong / elastic",
    starterEffect: "Predictable rise and clean wheat flavor; a dependable control flour for feeding or levain builds.",
    recipeEffect: "Builds gluten strength for open sourdough, pizza, bagels, and lean hearth loaves.",
    adjustment: "Start near your normal hydration. If swapping from AP, add water gradually and expect more chew.",
    sourceNote: "Published protein target; ash and absorption are practical baker ranges.",
  },
  {
    id: "cairnspring-trailblazer",
    brand: "Cairnspring Mills",
    name: "Trailblazer Bread Flour",
    style: "Type 85 stone-milled bread flour",
    closestProfile: "Bread flour",
    protein: "13–14.5%",
    ash: "Type 85 / higher ash",
    absorption: "Very high · 68–75%",
    strength: "Strong with whole-grain extensibility",
    starterEffect: "The mineral-rich extraction can wake a starter faster, while visible rise may look softer than white bread flour.",
    recipeEffect: "Adds wheat flavor, color, and fermentation activity; bran/germ demand more water and gentler handling.",
    adjustment: "Increase hydration in small steps and watch bulk sooner because higher extraction can ferment faster.",
    sourceNote: "Brand-published protein range and sift type; absorption depends heavily on crop and batch.",
  },
  {
    id: "central-milling-artisan",
    brand: "Central Milling",
    name: "Artisan Baker’s Craft",
    style: "Professional artisan bread flour",
    closestProfile: "Bread flour",
    protein: "≈11.5–12%",
    ash: "≈0.55–0.60%",
    absorption: "Moderate-high · 62–66%",
    strength: "Balanced / medium-strong",
    starterEffect: "Good everyday feed flour when you want steady activity without the extra mineral push of whole grain.",
    recipeEffect: "Balanced strength for baguettes, country loaves, pizza, and breads where extensibility matters.",
    adjustment: "Often needs a touch less water than high-protein bread flour; use folds for strength instead of overmixing.",
    sourceNote: "Typical mill-spec range; verify against the bag or spec sheet you buy.",
  },
  {
    id: "bobs-artisan-bread",
    brand: "Bob’s Red Mill",
    name: "Artisan Bread Flour",
    style: "Retail artisan bread flour",
    closestProfile: "Bread flour",
    protein: "≈13–14%",
    ash: "Not listed",
    absorption: "High · 65–70%",
    strength: "Strong / chewy",
    starterEffect: "High protein and malted barley support strong gas retention, so starter height can look bold.",
    recipeEffect: "Great for sourdough, baguettes, pizza, pretzels, and bagels where chew and crust matter.",
    adjustment: "Hydrate well and give the dough rest time before deciding it needs more flour.",
    sourceNote: "Nutrition-label protein converts near the upper bread-flour range; exact lot protein can vary.",
  },
  {
    id: "costco-ap",
    brand: "Costco / Kirkland-style",
    name: "All-Purpose Flour",
    style: "Bulk AP flour",
    closestProfile: "All-purpose flour",
    protein: "≈10–11.5%",
    ash: "Not listed",
    absorption: "Moderate · 58–63%",
    strength: "Medium",
    starterEffect: "Works fine for maintenance feeds, but may show less dramatic rise than strong bread flour.",
    recipeEffect: "Softer crumb and less chew; excellent for sandwich loaves, buns, cakes, and blended formulas.",
    adjustment: "Hold back water when swapping in for bread flour, or blend with stronger flour for tall hearth loaves.",
    sourceNote: "Bulk AP specs vary by supplier and region; treat as a calibration entry.",
  },
];

export const FLOUR_TYPES = FLOUR_PROFILES.map((profile) => profile.name);

const NORMALIZED_FLOUR_LOOKUP = new Map(
  FLOUR_PROFILES.flatMap((profile) => (
    [profile.name, ...profile.aliases].map((name) => [name.toLowerCase(), profile])
  )),
);

export function getFlourProfile(name = "") {
  const normalized = String(name).trim().toLowerCase();
  if (!normalized) return FLOUR_PROFILES[0];
  const exact = NORMALIZED_FLOUR_LOOKUP.get(normalized);
  if (exact) return exact;
  return FLOUR_PROFILES.find((profile) => (
    [profile.name, ...profile.aliases].some((alias) => {
      const value = alias.toLowerCase();
      return normalized.includes(value) || value.includes(normalized);
    })
  )) || {
    ...FLOUR_PROFILES[1],
    name: String(name).trim(),
    aliases: [],
    doughScience: "Custom flour uses neutral wheat assumptions until you choose a known flour profile.",
    starterScience: "Custom flour uses neutral starter assumptions; calibrate it with your own peak logs.",
    watch: "Observe water absorption, gas retention, and peak timing, then rely on your logged results.",
  };
}

export function weightedFlourMetric(blend = [], metric, fallback = 1) {
  if (!blend.length) return fallback;
  const total = blend.reduce((sum, item) => sum + Number(item.percent || 0), 0) || 100;
  return blend.reduce((sum, item) => (
    sum + Number(getFlourProfile(item.type)[metric] || fallback) * Number(item.percent || 0) / total
  ), 0);
}

export function rateLabel(value, low = 0.94, high = 1.07) {
  if (value >= high) return "faster";
  if (value <= low) return "slower";
  return "steady";
}

export function liftLabel(value) {
  if (value >= 1.04) return "strong";
  if (value >= 0.82) return "moderate";
  if (value >= 0.5) return "low";
  return "very low";
}
