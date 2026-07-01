export function recipeVersionSignature(recipe = {}) {
  return JSON.stringify({
    productType: recipe.productType || "bread",
    formulaMode: recipe.formulaMode || "bakers",
    yield: Number(recipe.yield || 1),
    unitName: recipe.unitName || "item",
    baseWeight: Number(recipe.baseWeight || recipe.flourWeight || 0),
    hydration: Number(recipe.hydration || 0),
    economics: recipe.economics || {},
    salesOptions: (recipe.salesOptions || []).map((option) => ({
      label: option.label,
      units: Number(option.units || 1),
      price: Number(option.price || 0),
      capacityUnits: Number(option.capacityUnits || 1),
    })),
    timelineSettings: recipe.timelineSettings || {},
    ingredients: (recipe.ingredients || []).map((ingredient) => ({
      name: ingredient.name,
      category: ingredient.category,
      flourType: ingredient.flourType,
      percent: Number(ingredient.percent || 0),
      weight: Number(ingredient.weight || 0),
    })),
  });
}

export function createRecipeVersion(recipe = {}, versionNumber = 1, note = "") {
  return {
    id: `recipe-version-${recipe.id || "new"}-${versionNumber}-${Date.now()}`,
    versionNumber,
    createdAt: new Date().toISOString(),
    note: String(note || "").trim() || (versionNumber === 1 ? "Initial formula" : "Formula updated"),
    signature: recipeVersionSignature(recipe),
    productType: recipe.productType || "bread",
    formulaMode: recipe.formulaMode || "bakers",
    yield: Number(recipe.yield || 1),
    unitName: recipe.unitName || "item",
    baseWeight: Number(recipe.baseWeight || recipe.flourWeight || 0),
    hydration: Number(recipe.hydration || 0),
    economics: recipe.economics || {},
    salesOptions: recipe.salesOptions || [],
    timelineSettings: recipe.timelineSettings || {},
    ingredients: recipe.ingredients || [],
  };
}

export function withRecipeVersion(previousRecipe, savedRecipe) {
  const { versionNote, ...recipeWithoutDraftNote } = savedRecipe;
  const previousVersions = Array.isArray(previousRecipe?.versions) ? previousRecipe.versions : [];
  const previousSignature = previousRecipe?.versionSignature || recipeVersionSignature(previousRecipe || {});
  const nextSignature = recipeVersionSignature(recipeWithoutDraftNote);

  if (!previousRecipe) {
    const firstVersion = createRecipeVersion(recipeWithoutDraftNote, 1, versionNote || "Initial formula");
    return {
      ...recipeWithoutDraftNote,
      currentVersion: 1,
      versionSignature: firstVersion.signature,
      lastVersionNote: firstVersion.note,
      versions: [firstVersion],
    };
  }

  const baseVersions = previousVersions.length
    ? previousVersions
    : [createRecipeVersion(previousRecipe, Number(previousRecipe.currentVersion || 1), "Imported original formula")];

  if (previousSignature === nextSignature) {
    return {
      ...previousRecipe,
      ...recipeWithoutDraftNote,
      versions: baseVersions,
      currentVersion: Number(previousRecipe.currentVersion || baseVersions.at(-1)?.versionNumber || 1),
      versionSignature: previousSignature,
    };
  }

  const nextVersionNumber = Math.max(
    Number(previousRecipe.currentVersion || 1),
    ...baseVersions.map((version) => Number(version.versionNumber || 1)),
  ) + 1;
  const nextVersion = createRecipeVersion(recipeWithoutDraftNote, nextVersionNumber, versionNote);
  return {
    ...previousRecipe,
    ...recipeWithoutDraftNote,
    currentVersion: nextVersionNumber,
    versionSignature: nextSignature,
    lastVersionNote: nextVersion.note,
    versions: [...baseVersions, nextVersion],
  };
}

function initials(value = "batch") {
  const letters = String(value)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  return letters.slice(0, 4) || "BATCH";
}

export function batchCodeFor(sourceName, date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  return `${initials(sourceName)}-${stamp}`;
}

export function recipeVersionLabel(recipe = {}) {
  return `v${Number(recipe.currentVersion || 1)}`;
}
