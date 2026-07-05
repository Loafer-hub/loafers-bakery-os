import {
  AlertTriangle,
  ClipboardPaste,
  FileText,
  Globe2,
  Save,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { parseImportedRecipe, textFromHtml } from "../lib/recipeImport";
import { PRODUCT_TYPES, productTypeFor, productTypeSettingsFor } from "../lib/productTypes";

function readableType(value) {
  return productTypeFor(value).label;
}

function stepTitle(step, index) {
  if (typeof step === "string") return `Step ${index + 1}`;
  return step?.title || step?.label || `Step ${index + 1}`;
}

function stepBody(step) {
  if (typeof step === "string") return step;
  return step?.body || step?.note || step?.detail || "";
}

function normalizeUrl(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function RecipeImportWorkspace({ bakerySettings, onSaveRecipe, recipes = [] }) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [draft, setDraft] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [status, setStatus] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  const duplicateRecipe = useMemo(() => {
    if (!draft?.name) return null;
    return recipes.find((recipe) => recipe.name?.toLowerCase() === draft.name.toLowerCase());
  }, [draft?.name, recipes]);

  function applyParse(text = sourceText, url = sourceUrl) {
    if (!String(text || "").trim()) {
      setStatus("Paste a recipe first, or try a recipe URL.");
      return;
    }
    const parsed = parseImportedRecipe(text, {
      bakerySettings,
      sourceUrl: normalizeUrl(url),
    });
    setDraft(parsed.recipe);
    setWarnings(parsed.warnings);
    setStatus(`Read ${parsed.parsedIngredientCount} ingredient${parsed.parsedIngredientCount === 1 ? "" : "s"} and ${parsed.recipe.instructions.length} instruction step${parsed.recipe.instructions.length === 1 ? "" : "s"}.`);
  }

  async function importFromUrl() {
    const url = normalizeUrl(sourceUrl);
    if (!url) {
      setStatus("Add a recipe link first.");
      return;
    }
    setIsFetching(true);
    setStatus("Trying to read that recipe page…");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const cleanText = textFromHtml(html).slice(0, 30000);
      if (!cleanText || cleanText.length < 80) throw new Error("The page did not include enough readable recipe text.");
      setSourceText(cleanText);
      applyParse(cleanText, url);
    } catch (error) {
      setStatus(`That site blocked browser import or hid the recipe text. Paste the recipe below and I can still read it. ${error?.message ? `(${error.message})` : ""}`);
    } finally {
      setIsFetching(false);
    }
  }

  function updateDraft(changes) {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }

  function updateProductType(productType) {
    const settings = productTypeSettingsFor(bakerySettings, productType);
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        productType,
        formulaMode: settings.formulaMode || productTypeFor(productType).formulaMode,
        unitName: settings.unitName || productTypeFor(productType).unitName,
      };
    });
  }

  function updateIngredient(index, changes) {
    setDraft((current) => {
      if (!current) return current;
      const baseWeight = Math.max(1, Number(current.baseWeight || current.flourWeight || 1));
      const nextIngredients = current.ingredients.map((ingredient, ingredientIndex) => {
        if (ingredientIndex !== index) return ingredient;
        const next = { ...ingredient, ...changes };
        if (Object.prototype.hasOwnProperty.call(changes, "weight")) {
          next.weight = Math.max(0, Number(changes.weight || 0));
          next.percent = Number((next.weight / baseWeight * 100).toFixed(3));
        }
        return next;
      });
      const hydration = nextIngredients.reduce((sum, ingredient) => (
        ingredient.category === "liquid" ? sum + Number(ingredient.percent || 0) : sum
      ), 0);
      return { ...current, ingredients: nextIngredients, hydration };
    });
  }

  function updateInstruction(index, changes) {
    setDraft((current) => {
      if (!current) return current;
      const instructions = (current.instructions || []).map((step, stepIndex) => (
        stepIndex === index ? { ...step, ...changes } : step
      ));
      return {
        ...current,
        instructions,
        productionInstructions: instructions,
      };
    });
  }

  function saveDraft() {
    if (!draft?.name?.trim()) {
      setStatus("Give the recipe a name before saving.");
      return;
    }
    const recipeForSave = {
      ...draft,
      name: draft.name.trim(),
      note: draft.note?.trim() || "Imported recipe draft",
      unitName: draft.unitName?.trim() || productTypeFor(draft.productType).unitName,
      isNew: true,
      savedFromImportAt: new Date().toISOString(),
    };
    onSaveRecipe?.(recipeForSave);
    setStatus(`Saved ${recipeForSave.name} to Products.`);
  }

  const ingredientCount = draft?.ingredients?.length || 0;
  const instructionCount = draft?.instructions?.length || 0;

  return (
    <div className="menu-embedded-workspace recipe-import-workspace">
      <section className="recipe-import-hero">
        <span><Sparkles size={24} /></span>
        <div>
          <small>AI recipe reader</small>
          <h2>Import a recipe into your product catalog</h2>
          <p>Paste a recipe or try a web link. I’ll split it into product type, ingredients, grams, baker’s/batch percentages, yield, price presets, and production steps.</p>
        </div>
      </section>

      <section className="recipe-import-grid">
        <article className="recipe-import-card recipe-import-source">
          <div className="section-title-line compact">
            <div>
              <span className="eyebrow-label dark">Source</span>
              <h3>Web or paste</h3>
            </div>
            <Globe2 size={20} />
          </div>
          <label>
            Recipe URL
            <span className="recipe-import-inline">
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://example.com/my-recipe"
              />
              <button type="button" onClick={importFromUrl} disabled={isFetching}>
                {isFetching ? "Reading…" : "Try web import"}
              </button>
            </span>
          </label>
          <label>
            Paste recipe text
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder={`Country sourdough\n\nIngredients\n500g bread flour\n375g water\n100g starter\n10g salt\n\nInstructions\nMix the dough...\nBulk ferment...\nShape and bake...`}
              rows={13}
            />
          </label>
          <button className="recipe-import-primary" type="button" onClick={() => applyParse()}>
            <ClipboardPaste size={18} />
            Read pasted recipe
          </button>
          {status ? <p className="recipe-import-status">{status}</p> : null}
          {warnings.length ? (
            <div className="recipe-import-warnings">
              <AlertTriangle size={18} />
              <span>
                {warnings.map((warning) => <small key={warning}>{warning}</small>)}
              </span>
            </div>
          ) : null}
        </article>

        <article className="recipe-import-card recipe-import-draft">
          <div className="section-title-line compact">
            <div>
              <span className="eyebrow-label dark">Draft card</span>
              <h3>{draft ? "Review before saving" : "Nothing imported yet"}</h3>
            </div>
            <FileText size={20} />
          </div>

          {draft ? (
            <>
              <div className="recipe-import-summary">
                <span><strong>{ingredientCount}</strong><small>Ingredients</small></span>
                <span><strong>{instructionCount}</strong><small>Steps</small></span>
                <span><strong>{readableType(draft.productType)}</strong><small>Detected type</small></span>
              </div>

              {duplicateRecipe ? (
                <p className="recipe-import-duplicate">A saved recipe named “{duplicateRecipe.name}” already exists. Saving this will create another recipe card so you can compare before deleting one.</p>
              ) : null}

              <div className="recipe-import-form">
                <label>
                  Recipe name
                  <input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
                </label>
                <label>
                  Product type
                  <select value={draft.productType} onChange={(event) => updateProductType(event.target.value)}>
                    {PRODUCT_TYPES.map((type) => <option value={type.value} key={type.value}>{type.icon} {type.label}</option>)}
                  </select>
                </label>
                <label>
                  Yield
                  <input type="number" min="0.5" step="0.5" value={draft.yield} onChange={(event) => updateDraft({ yield: Number(event.target.value || 1) })} />
                </label>
                <label>
                  Unit
                  <input value={draft.unitName} onChange={(event) => updateDraft({ unitName: event.target.value })} />
                </label>
                <label className="wide">
                  Customer/product note
                  <textarea rows={3} value={draft.note} onChange={(event) => updateDraft({ note: event.target.value })} />
                </label>
              </div>

              <div className="recipe-import-table">
                <div><span>Ingredient</span><span>Category</span><span>Grams</span><span>%</span></div>
                {draft.ingredients.map((ingredient, index) => (
                  <div key={ingredient.id || `${ingredient.name}-${index}`}>
                    <input value={ingredient.name} onChange={(event) => updateIngredient(index, { name: event.target.value })} />
                    <select value={ingredient.category} onChange={(event) => updateIngredient(index, { category: event.target.value })}>
                      {["flour", "liquid", "starter", "yeast", "salt", "sweetener", "fat", "acid", "spice", "produce", "culture", "inclusion", "other"].map((category) => (
                        <option value={category} key={category}>{category}</option>
                      ))}
                    </select>
                    <input type="number" min="0" value={Math.round(Number(ingredient.weight || 0))} onChange={(event) => updateIngredient(index, { weight: event.target.value })} />
                    <span>{Number(ingredient.percent || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              <div className="recipe-import-steps">
                <h4>Production steps</h4>
                {draft.instructions?.length ? draft.instructions.map((step, index) => (
                  <label key={`${stepTitle(step, index)}-${index}`}>
                    <span>{stepTitle(step, index)}</span>
                    <textarea
                      rows={2}
                      value={stepBody(step)}
                      onChange={(event) => updateInstruction(index, { body: event.target.value })}
                    />
                  </label>
                )) : <p>No clear steps found. The app will use default production notes for this product type.</p>}
              </div>

              <button className="recipe-import-save" type="button" onClick={saveDraft}>
                <Save size={18} />
                Save recipe card
              </button>
            </>
          ) : (
            <div className="recipe-import-empty">
              <Sparkles size={28} />
              <strong>Paste any recipe format.</strong>
              <p>Grams work best, but it can also estimate common cups, spoons, ounces, pounds, eggs, and cloves into grams.</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
