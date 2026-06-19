export const BAKE_PHASES = [
  { id: "starter_feed", label: "Starter fed", detail: "Levain is building strength." },
  { id: "mixing", label: "Dough mixed", detail: "Flour, water, salt, and starter are together." },
  { id: "bulk_ferment", label: "Bulk ferment", detail: "The dough is rising and developing structure." },
  { id: "shaped", label: "Loaves shaped", detail: "The dough has been divided and shaped." },
  { id: "cold_proof", label: "Cold proof", detail: "The loaves are resting cold for flavor and structure." },
  { id: "baking", label: "In the oven", detail: "Your bread is baking." },
  { id: "cooling", label: "Cooling", detail: "The crust and crumb are setting." },
  { id: "ready", label: "Ready for pickup", detail: "Your order is packed and ready." },
];

export const EMPTY_BAKE_PROGRESS = Object.fromEntries(
  BAKE_PHASES.map((phase) => [phase.id, false]),
);

export function normalizedBakeProgress(progress) {
  return {
    ...EMPTY_BAKE_PROGRESS,
    ...(progress && typeof progress === "object" ? progress : {}),
  };
}
