export const SALES_OPTION_PRESETS = [
  { label: "Each", units: 1 },
  { label: "Half dozen", units: 6 },
  { label: "Dozen", units: 12 },
  { label: "Loaf", units: 1 },
  { label: "Half loaf", units: 0.5 },
  { label: "Custom pack", units: 1 },
];

function optionId(label, index = 0) {
  const safe = String(label || "option")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safe || "option"}-${index + 1}`;
}

export function defaultSalesOptions(recipe = {}) {
  const unitName = String(recipe.unitName || "loaf").trim() || "loaf";
  const label = unitName.toLowerCase() === "loaf" ? "Loaf" : `Each ${unitName}`;
  return [{
    id: "default",
    label,
    units: 1,
    price: Number(recipe.price || 0),
    capacityUnits: 1,
  }];
}

export function normalizedSalesOptions(recipe = {}) {
  const options = Array.isArray(recipe.salesOptions) && recipe.salesOptions.length
    ? recipe.salesOptions
    : defaultSalesOptions(recipe);
  return options.map((option, index) => ({
    id: String(option.id || optionId(option.label, index)),
    label: String(option.label || `Option ${index + 1}`).trim(),
    units: Math.max(0.5, Number(option.units || 1)),
    price: Math.max(0, Number(option.price ?? recipe.price ?? 0)),
    capacityUnits: Math.max(1, Math.min(6, Number(option.capacityUnits || 1))),
  }));
}

export function lowestSalesPrice(recipe = {}) {
  const prices = normalizedSalesOptions(recipe).map((option) => option.price);
  return prices.length ? Math.min(...prices) : Number(recipe.price || 0);
}

export function optionDisplay(option, unitName = "item") {
  const units = Number(option.units || 1);
  const unit = String(unitName || "item");
  const plural = pluralUnit(unit, units);
  return `${option.label} · ${units} ${plural}`;
}

export function pluralUnit(unitName = "item", count = 2) {
  const unit = String(unitName || "item").trim();
  if (Number(count) === 1) return unit;
  if (unit.toLowerCase() === "loaf") return "loaves";
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(unit)) return `${unit}es`;
  return `${unit}s`;
}
