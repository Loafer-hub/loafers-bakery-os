export const RESOURCE_BENCH_STORAGE_KEY = "loafers-resource-bench-v1";

export const seedResourceBenchItems = [
  {
    id: "bench-printable-recipe-cards",
    type: "article",
    title: "Printable recipe cards",
    summary: "Share polished recipes, ingredient notes, and customer-friendly instructions.",
    url: "",
    details: "Good first resource for customer handouts and downloadable product guides.",
    options: [],
    customerVisible: false,
    createdAt: "2026-07-06T12:00:00.000Z",
  },
  {
    id: "bench-product-launch-sheets",
    type: "information",
    title: "Product launch sheets",
    summary: "Bundle pricing, labels, photos, preorder windows, and batch notes for each new item.",
    url: "",
    details: "Use for weekly drops, seasonal products, or new menu categories.",
    options: [],
    customerVisible: false,
    createdAt: "2026-07-06T12:05:00.000Z",
  },
  {
    id: "bench-customer-education-library",
    type: "article",
    title: "Customer education library",
    summary: "Explain pickup, storage, reheating, fermentation, allergens, and specialty products.",
    url: "",
    details: "A customer-facing library can reduce repeated questions and make the storefront feel more professional.",
    options: [],
    customerVisible: false,
    createdAt: "2026-07-06T12:10:00.000Z",
  },
];

const BUILT_IN_RESOURCE_IDS = new Set(seedResourceBenchItems.map((item) => item.id));

export function formatResourceDate(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved resource";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function normalizeResourceBenchItems(items) {
  const list = Array.isArray(items) ? items : seedResourceBenchItems;
  return list
    .filter(Boolean)
    .map((item, index) => {
      const id = String(item.id || `resource-${index + 1}`);
      return {
        id,
        type: item.type || "article",
        title: String(item.title || "").trim(),
        summary: String(item.summary || "").trim(),
        url: String(item.url || "").trim(),
        details: String(item.details || "").trim(),
        options: Array.isArray(item.options)
          ? item.options.map((option) => String(option || "").trim()).filter(Boolean)
          : [],
        photoUrl: String(item.photoUrl || "").trim(),
        photoAlt: String(item.photoAlt || item.title || "").trim(),
        customerVisible: item.customerVisible === undefined
          ? !BUILT_IN_RESOURCE_IDS.has(id)
          : item.customerVisible !== false,
        createdAt: item.createdAt || "",
        updatedAt: item.updatedAt || "",
      };
    })
    .filter((item) => item.title);
}
