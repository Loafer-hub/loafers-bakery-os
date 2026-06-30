// product-type-settings-v1
export const PRODUCT_TYPES = [
  { value: "bread", label: "Bread", unitName: "loaf", formulaMode: "bakers", icon: "🥖" },
  { value: "bagel", label: "Bagels", unitName: "bagel", formulaMode: "bakers", icon: "🥯" },
  { value: "bun", label: "Buns / rolls", unitName: "bun", formulaMode: "bakers", icon: "🍞" },
  { value: "cake", label: "Cakes", unitName: "cake", formulaMode: "bakers", icon: "🍰" },
  { value: "pastry", label: "Pastries", unitName: "pastry", formulaMode: "bakers", icon: "🥐" },
  { value: "hot_sauce", label: "Hot sauces", unitName: "bottle", formulaMode: "batch", icon: "🌶️" },
  { value: "vinegar", label: "Vinegars", unitName: "bottle", formulaMode: "batch", icon: "🍾" },
  { value: "infused_oil", label: "Infused oils", unitName: "bottle", formulaMode: "batch", icon: "🫒" },
  { value: "other", label: "Other item", unitName: "item", formulaMode: "batch", icon: "🏷️" },
];

export const PRODUCT_TYPE_ORDER = PRODUCT_TYPES.map((type) => type.value);

const DEFAULT_PRODUCT_TYPE_COPY = {
  bread: {
    description: "Naturally leavened loaves baked in small batches.",
    safetyNotes: "Contains wheat. May share equipment with dairy, seeds, and other allergens.",
    presets: [
      { label: "Loaf", units: 1, price: 13, capacityUnits: 1 },
      { label: "Half loaf", units: 0.5, price: 7, capacityUnits: 1 },
    ],
  },
  bagel: {
    description: "Chewy sourdough bagels sold in useful breakfast packs.",
    safetyNotes: "Contains wheat. Toppings may include seeds, dairy, or alliums.",
    presets: [
      { label: "Half dozen", units: 6, price: 15, capacityUnits: 1 },
      { label: "Dozen", units: 12, price: 28, capacityUnits: 2 },
    ],
  },
  bun: {
    description: "Soft rolls and buns for dinners, sandwiches, and gatherings.",
    safetyNotes: "Contains wheat and may contain dairy, eggs, or butter depending on the recipe.",
    presets: [
      { label: "Half dozen", units: 6, price: 16, capacityUnits: 1 },
      { label: "Dozen", units: 12, price: 30, capacityUnits: 2 },
    ],
  },
  cake: {
    description: "Small-batch cakes and sweet bakes made to order.",
    safetyNotes: "May contain wheat, dairy, eggs, nuts, chocolate, or other common allergens.",
    presets: [
      { label: "Whole cake", units: 1, price: 24, capacityUnits: 2 },
      { label: "Half cake", units: 0.5, price: 14, capacityUnits: 1 },
    ],
  },
  pastry: {
    description: "Laminated, enriched, and pastry-style bakes for special runs.",
    safetyNotes: "Usually contains wheat and butter. May contain eggs, dairy, nuts, or chocolate.",
    presets: [
      { label: "Each", units: 1, price: 5, capacityUnits: 1 },
      { label: "Half dozen", units: 6, price: 27, capacityUnits: 2 },
    ],
  },
  hot_sauce: {
    description: "Bright fermented or cooked sauces bottled in small batches.",
    safetyNotes: "Refrigerate after opening. Heat level and acidity vary by batch; ask before ordering if you have sensitivities.",
    presets: [
      { label: "Bottle", units: 1, price: 9, capacityUnits: 0 },
      { label: "Three-pack", units: 3, price: 24, capacityUnits: 0 },
    ],
  },
  vinegar: {
    description: "Designed vinegars for cooking, finishing, shrubs, and dressings.",
    safetyNotes: "Acidic product. Use clean utensils, keep capped, and follow the baker’s storage guidance.",
    presets: [
      { label: "Bottle", units: 1, price: 12, capacityUnits: 0 },
      { label: "Three-pack", units: 3, price: 33, capacityUnits: 0 },
    ],
  },
  infused_oil: {
    description: "Infused oils for dipping, finishing, and savory cooking.",
    safetyNotes: "Follow storage directions closely. Refrigerate if instructed, especially for garlic, herbs, or fresh produce infusions.",
    presets: [
      { label: "Bottle", units: 1, price: 12, capacityUnits: 0 },
      { label: "Half dozen", units: 6, price: 66, capacityUnits: 0 },
    ],
  },
  other: {
    description: "Other small-batch goods and seasonal experiments.",
    safetyNotes: "Ingredients and storage vary by item. Check the product details and ask about allergens.",
    presets: [
      { label: "Each", units: 1, price: 10, capacityUnits: 1 },
    ],
  },
};

function slug(value) {
  return String(value || "option")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "option";
}

export function productTypeFor(value) {
  const key = typeof value === "string" ? value : value?.productType || value?.value;
  return PRODUCT_TYPES.find((type) => type.value === key) || PRODUCT_TYPES[0];
}

export function productTypeMap(settings) {
  return new Map(normalizeProductTypeSettings(settings).map((type) => [type.value, type]));
}

export function normalizeProductTypeSettings(settings = {}) {
  const rawTypes = Array.isArray(settings.productTypes) ? settings.productTypes : [];
  const byValue = new Map(rawTypes.map((type) => [type.value, type]));
  return PRODUCT_TYPES.map((base, defaultIndex) => {
    const incoming = byValue.get(base.value) || {};
    const copy = DEFAULT_PRODUCT_TYPE_COPY[base.value] || DEFAULT_PRODUCT_TYPE_COPY.other;
    const rawPresets = Array.isArray(incoming.packagePresets) && incoming.packagePresets.length
      ? incoming.packagePresets
      : copy.presets;
    return {
      ...base,
      enabled: incoming.enabled !== false,
      order: Number.isFinite(Number(incoming.order)) ? Number(incoming.order) : defaultIndex,
      unitName: String(incoming.unitName || base.unitName).trim() || base.unitName,
      description: String(incoming.description ?? copy.description).trim(),
      safetyNotes: String(incoming.safetyNotes ?? copy.safetyNotes).trim(),
      packagePresets: rawPresets.map((preset, index) => ({
        id: String(preset.id || `${base.value}-${slug(preset.label)}-${index + 1}`),
        label: String(preset.label || `Option ${index + 1}`).trim(),
        units: Math.max(0.5, Number(preset.units || 1)),
        price: Math.max(0, Number(preset.price || 0)),
        capacityUnits: Math.max(0, Math.min(6, Number(preset.capacityUnits ?? 1))),
      })),
    };
  }).sort((a, b) => a.order - b.order);
}

export function productTypeSettingsFor(settings, value) {
  const normalized = normalizeProductTypeSettings(settings);
  return normalized.find((type) => type.value === value) || normalized[0];
}
