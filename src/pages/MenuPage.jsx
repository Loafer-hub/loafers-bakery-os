import {
  CalendarPlus,
  ChefHat,
  ClipboardList,
  Eye,
  Globe2,
  Image as ImageIcon,
  PackageCheck,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "../components/Primitives";
import { ReadyShelf } from "../components/ReadyShelf";
import { RecipeImportWorkspace } from "../components/RecipeImportWorkspace";
import { LOAFERS_BRAND } from "../lib/brand";
import { normalizeProductTypeSettings, productTypeFor } from "../lib/productTypes";
import { normalizeTimelineSettings, recipeUsesStarter } from "../lib/recipeTimeline";
import { lowestSalesPrice, normalizedSalesOptions } from "../lib/salesOptions";
import RecipesPage from "./RecipesPage";
import SettingsPage from "./SettingsPage";

const menuViews = [
  {
    id: "recipes",
    label: "Products",
    title: "Product catalog",
    note: "Recipes, formulas, photos, units, pricing, and flour science.",
    icon: Tags,
  },
  {
    id: "storefront",
    label: "Storefront",
    title: "Storefront controls",
    note: "Product types, availability, badges, options, pickup, and customer rules.",
    icon: Settings2,
  },
  {
    id: "import",
    label: "Import",
    title: "Recipe import",
    note: "Use the AI recipe reader to turn pasted or web recipes into saved product cards.",
    icon: Sparkles,
  },
  {
    id: "shelf",
    label: "Ready shelf",
    title: "Ready shelf",
    note: "Already-made items customers can reserve without future bake capacity.",
    icon: PackageCheck,
  },
  {
    id: "preview",
    label: "Preview",
    title: "Owner preview",
    note: "See the customer menu exactly as shoppers experience it.",
    icon: Eye,
  },
];

const menuViewCopy = Object.fromEntries(menuViews.map((item) => [item.id, item]));

function statusForRecipe(recipe = {}) {
  if (recipe.hiddenThisWeek) return "Hidden this week";
  if (recipe.soldOut) return "Sold out";
  if (recipe.unavailableThisWeek) return "Unavailable";
  if (recipe.available === false) return "Paused";
  if ((recipe.badges || []).includes("ready_now")) return "Ready now";
  if ((recipe.badges || []).includes("preorder")) return "Preorder";
  return "Visible";
}

function priceLabel(recipe = {}) {
  const options = normalizedSalesOptions(recipe);
  const lowest = lowestSalesPrice(recipe);
  const unit = options[0]?.label || recipe.unitName || "Item";
  return `$${Number(lowest || 0).toFixed(2)} · ${unit}`;
}

function formatPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "—";
  return `${number.toFixed(number % 1 ? 1 : 0)}%`;
}

function formatWeight(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "—";
  return `${Math.round(number).toLocaleString()} g`;
}

function instructionStepsFor(recipe = {}) {
  const raw = recipe.instructions || recipe.method || recipe.productionInstructions || recipe.productionNotes;
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => {
        if (typeof item === "string") {
          return { title: `Step ${index + 1}`, detail: item };
        }
        return {
          title: item.title || item.label || `Step ${index + 1}`,
          detail: item.note || item.body || item.detail || "",
        };
      })
      .filter((step) => String(step.detail || "").trim());
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/\n+/)
      .map((line, index) => {
        const [title, ...rest] = line.split(":");
        return rest.length
          ? { title: title.trim() || `Step ${index + 1}`, detail: rest.join(":").trim() }
          : { title: `Step ${index + 1}`, detail: line.trim() };
      })
      .filter((step) => step.detail);
  }
  return [];
}

function fallbackStepsFor(recipe = {}, timeline = {}) {
  const type = recipe.productType || "bread";
  if (type === "yeast") {
    return [
      { title: "Mix", detail: "Mix and knead until the dough is smooth and elastic." },
      { title: timeline.primaryLabel || "Rise", detail: `Rise about ${Number(timeline.primaryRiseHours || 1.5).toFixed(1)} hours, then judge by puffiness and spring-back.` },
      { title: "Bake", detail: "Bake when proofed, then cool fully before slicing, bagging, or selling." },
    ];
  }
  if (["hot_sauce", "vinegar", "infused_oil"].includes(type)) {
    return [
      { title: "Prep", detail: "Weigh ingredients, record batch date, and keep safety notes with the batch." },
      { title: "Process", detail: "Follow the product’s pH, salt, storage, and warning-note requirements before sale." },
      { title: "Pack", detail: "Bottle, label, date, and add customer storage instructions." },
    ];
  }
  if (type === "cake") {
    return [
      { title: "Prep", detail: "Scale ingredients, prepare pans, and bring cold ingredients to recipe temperature." },
      { title: "Mix", detail: "Mix according to cake style and avoid overworking once flour is added." },
      { title: "Bake", detail: "Bake until set, cool, then finish or pack." },
    ];
  }
  return [
    { title: "Feed", detail: timeline.useStarter && timeline.includeStarterFeed ? "Feed starter early enough to peak near mix time." : "Starter feed is skipped for this product setup." },
    { title: "Mix", detail: "Mix, hydrate, and build strength based on the saved formula." },
    { title: timeline.primaryLabel || "Bulk ferment", detail: `Model target is about ${Number(timeline.primaryRiseHours || 0).toFixed(1)} hours, but dough strength and rise get final say.` },
    { title: "Bake", detail: "Bake and cool before packing, pickup, or ready-shelf sale." },
  ];
}

function ProductInfoSheet({
  onAddToCalendar,
  onAddToKitchen,
  onClose,
  onOpenBakeDesk,
  productTypes,
  recipe,
}) {
  if (!recipe) return null;
  const type = productTypeFor(recipe.productType || "bread");
  const timeline = normalizeTimelineSettings(recipe);
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const salesOptions = normalizedSalesOptions(recipe);
  const steps = instructionStepsFor(recipe);
  const displayedSteps = steps.length ? steps : fallbackStepsFor(recipe, timeline);
  const enabledType = productTypes.find((item) => item.value === (recipe.productType || "bread"))?.enabled !== false;

  return (
    <Modal title="Product details" onClose={onClose}>
      <div className="owner-product-sheet">
        <section className="owner-product-hero">
          <span className={recipe.photoUrl ? "owner-product-photo" : "owner-product-photo empty"}>
            {recipe.photoUrl ? <img src={recipe.photoUrl} alt={recipe.photoAlt || recipe.name} /> : <ImageIcon size={28} />}
          </span>
          <div>
            <span className="eyebrow-label dark">Read-only product card</span>
            <h3>{recipe.name}</h3>
            <p>{recipe.description || recipe.note || "Saved product details, formula, instructions, and scheduling shortcuts."}</p>
            <div className="owner-product-badges">
              <span>{type.icon} {type.label}</span>
              <span>{statusForRecipe(recipe)}</span>
              <span>{enabledType ? "Customer tab shown" : "Customer tab hidden"}</span>
            </div>
          </div>
        </section>

        <div className="owner-product-action-grid">
          <button type="button" className="primary-button" onClick={() => onAddToKitchen?.(recipe)}>
            <ChefHat size={17} /> Add to Kitchen
          </button>
          <button type="button" className="secondary-button" onClick={() => onAddToCalendar?.(recipe)}>
            <CalendarPlus size={17} /> Add to calendar
          </button>
          <button type="button" className="secondary-button" onClick={() => onOpenBakeDesk?.(recipe)}>
            <ClipboardList size={17} /> Open in Bake desk
          </button>
        </div>

        <section className="owner-product-grid">
          <article>
            <small>Price + packages</small>
            <strong>{priceLabel(recipe)}</strong>
            <div className="owner-product-option-list">
              {salesOptions.map((option) => (
                <span key={option.id || option.label}>
                  <b>{option.label}</b>
                  <em>${Number(option.price || 0).toFixed(2)} · {option.units || 1} {recipe.unitName || "item"}{Number(option.units || 1) === 1 ? "" : "s"}</em>
                </span>
              ))}
            </div>
          </article>
          <article>
            <small>Timeline setup</small>
            <strong>{timeline.primaryLabel || "Production"} · {Number(timeline.primaryRiseHours || 0).toFixed(1)}h</strong>
            <div className="owner-product-timeline-list">
              <span>Starter: {recipeUsesStarter(recipe) ? "Used" : "Not used"}</span>
              <span>Folds: {timeline.includeStretchFolds ? `${timeline.stretchFoldCount} sets` : "Skipped"}</span>
              <span>Cold proof: {timeline.includeColdProof ? `${timeline.defaultColdProofHours}h` : "Skipped"}</span>
              <span>Preheat: {timeline.includePreheat ? `${timeline.preheatMinutes} min` : "Skipped"}</span>
            </div>
          </article>
        </section>

        <section className="owner-product-detail-columns">
          <article className="owner-product-detail-card">
            <div className="section-title-line compact">
              <h3>Formula</h3>
              <small>{recipe.formulaMode === "batch" ? "Batch %" : "Baker’s %"}</small>
            </div>
            {ingredients.length ? (
              <div className="owner-product-ingredient-table">
                <div><b>Ingredient</b><b>Weight</b><b>%</b></div>
                {ingredients.map((ingredient, index) => (
                  <div key={`${ingredient.name}-${index}`}>
                    <span>{ingredient.name || "Ingredient"}{ingredient.category ? <em>{ingredient.category}</em> : null}</span>
                    <span>{formatWeight(ingredient.weight)}</span>
                    <span>{formatPercent(ingredient.percent)}</span>
                  </div>
                ))}
              </div>
            ) : <p>No saved ingredients yet.</p>}
          </article>

          <article className="owner-product-detail-card">
            <div className="section-title-line compact">
              <h3>Instructions</h3>
              <small>{steps.length ? "Saved recipe steps" : "Default production guide"}</small>
            </div>
            <ol className="owner-product-step-list">
              {displayedSteps.map((step, index) => (
                <li key={`${step.title}-${index}`}>
                  <b>{step.title}</b>
                  <span>{step.detail}</span>
                </li>
              ))}
            </ol>
          </article>
        </section>
      </div>
    </Modal>
  );
}

function MenuProductBoard({ onAddProduct, onSelectRecipe, productTypes, recipes }) {
  const typeLeaders = productTypes
    .map((type) => recipes.find((recipe) => (recipe.productType || "bread") === type.value))
    .filter(Boolean);
  const featuredRecipes = [
    ...typeLeaders,
    ...recipes.filter((recipe) => !typeLeaders.some((leader) => leader.id === recipe.id)),
  ]
    .sort((a, b) => Number(a.hiddenThisWeek === true) - Number(b.hiddenThisWeek === true))
    .slice(0, 8);
  return (
    <section className="menu-product-board">
      <div className="menu-product-toolbar">
        <span>
          <Search size={15} />
          <strong>Product catalog</strong>
          <small>{recipes.length} saved product{recipes.length === 1 ? "" : "s"} across {productTypes.filter((type) => type.enabled !== false).length} customer category tabs</small>
        </span>
        <button type="button" onClick={onAddProduct}>Add product</button>
      </div>
      <div className="menu-type-strip" aria-label="Product type snapshot">
        {productTypes.slice(0, 6).map((type) => {
          const count = recipes.filter((recipe) => (recipe.productType || "bread") === type.value).length;
          return (
            <span className={type.enabled === false ? "muted" : ""} key={type.value}>
              <b>{type.icon}</b>
              <strong>{type.label}</strong>
              <small>{count} item{count === 1 ? "" : "s"}</small>
            </span>
          );
        })}
      </div>
      <div className="menu-featured-products">
        {featuredRecipes.map((recipe) => {
          const type = productTypeFor(recipe.productType || "bread");
          return (
            <button
              type="button"
              className={recipe.hiddenThisWeek ? "menu-product-card hidden" : "menu-product-card"}
              key={recipe.id}
              onClick={() => onSelectRecipe?.(recipe)}
              aria-label={`Open ${recipe.name} product details`}
            >
              <span className={recipe.photoUrl ? "menu-product-photo" : "menu-product-photo empty"}>
                {recipe.photoUrl ? <img src={recipe.photoUrl} alt={recipe.photoAlt || recipe.name} /> : <ImageIcon size={17} />}
              </span>
              <span>
                <small>{type.label}</small>
                <strong>{recipe.name}</strong>
                <em>{priceLabel(recipe)}</em>
              </span>
              <b>{statusForRecipe(recipe)}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MenuModeBoard({ activeView, bakerySettings, onAddProduct, onSelectRecipe, productTypes, recipes, readyShelfItems }) {
  if (activeView === "recipes") return <MenuProductBoard onAddProduct={onAddProduct} onSelectRecipe={onSelectRecipe} productTypes={productTypes} recipes={recipes} />;
  if (activeView === "storefront") {
    return (
      <section className="menu-mode-board">
        <ShoppingBag size={22} />
        <span>
          <strong>Customer menu rules live here</strong>
          <small>{productTypes.filter((type) => type.enabled !== false).length} category tabs visible · {recipes.filter((recipe) => recipe.hiddenThisWeek).length} hidden this week · pickup and privacy controls below.</small>
        </span>
      </section>
    );
  }
  if (activeView === "shelf") {
    return (
      <section className="menu-mode-board">
        <PackageCheck size={22} />
        <span>
          <strong>{bakerySettings?.readyShelfEnabled !== false ? "Ready shelf is public" : "Ready shelf is hidden"}</strong>
          <small>{readyShelfItems.length ? `${readyShelfItems.length} shelf item${readyShelfItems.length === 1 ? "" : "s"} loaded from cloud.` : "Add ready-now stock from saved recipes or custom items below."}</small>
        </span>
      </section>
    );
  }
  if (activeView === "import") {
    return (
      <section className="menu-mode-board">
        <Sparkles size={22} />
        <span>
          <strong>Import recipes without doing the math first</strong>
          <small>Paste a recipe or try a web link, review the parsed product card, then save it into Products for pricing, scheduling, and customer display.</small>
        </span>
      </section>
    );
  }
  return (
    <section className="menu-mode-board">
      <Eye size={22} />
      <span>
        <strong>Preview before customers do</strong>
        <small>Use the embedded storefront to check category tabs, photos, badges, ready shelf, pickup flow, and cart behavior.</small>
      </span>
    </section>
  );
}

function MenuEmbeddedWorkspace({
  bakerySettings,
  cloudAccount,
  previewUrl,
  recipes,
  setReadyShelfItems,
  view,
  ...props
}) {
  if (view === "storefront") {
    return (
      <div className="menu-embedded-workspace">
        <SettingsPage
          {...props}
          bakerySettings={bakerySettings}
          cloudAccount={cloudAccount}
          embeddedContext="menu"
          recipes={recipes}
        />
      </div>
    );
  }

  if (view === "shelf") {
    return (
      <div className="menu-embedded-workspace">
        <ReadyShelf
          cloudAccount={cloudAccount}
          enabled={bakerySettings?.readyShelfEnabled !== false}
          onShelfChange={setReadyShelfItems}
          recipes={recipes}
        />
      </div>
    );
  }

  if (view === "import") {
    return (
      <RecipeImportWorkspace
        bakerySettings={bakerySettings}
        onSaveRecipe={props.onSaveRecipe}
        recipes={recipes}
      />
    );
  }

  if (view === "preview") {
    return (
      <div className="menu-embedded-workspace">
        <section className="owner-preview-card">
          <div className="section-title-line">
            <div>
              <span className="eyebrow-label dark">Owner preview</span>
              <h2>Customer storefront</h2>
              <small>This uses the same public order flow customers see, tucked inside your owner menu.</small>
            </div>
            <Globe2 size={21} />
          </div>
          <iframe title="Customer storefront preview" src={previewUrl} className="owner-preview-frame" />
        </section>
      </div>
    );
  }

  return null;
}

export default function MenuPage(props) {
  const [view, setView] = useState(props.menuView || "recipes");
  const [readyShelfItems, setReadyShelfItems] = useState([]);
  const [addProductSignal, setAddProductSignal] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState("");
  const heroBannerStyle = useMemo(() => {
    let bannerUrl = LOAFERS_BRAND.bannerSrc;
    try {
      bannerUrl = new URL(LOAFERS_BRAND.bannerSrc, window.location.href).href;
    } catch {
      bannerUrl = LOAFERS_BRAND.bannerSrc;
    }
    return { "--menu-hero-image": `url("${bannerUrl}")` };
  }, []);
  const previewUrl = useMemo(() => {
    const slug = props.cloudAccount?.workspace?.bakery?.slug || "loafers";
    return `?order=${encodeURIComponent(slug)}&preview=owner&release=menu-desk-v1`;
  }, [props.cloudAccount?.workspace?.bakery?.slug]);
  const productTypes = useMemo(() => normalizeProductTypeSettings(props.bakerySettings), [props.bakerySettings]);
  const recipes = props.recipes || [];
  const selectedProduct = recipes.find((recipe) => recipe.id === selectedProductId);
  const visibleRecipes = recipes.filter((recipe) => (
    recipe.available !== false
    && recipe.soldOut !== true
    && recipe.unavailableThisWeek !== true
    && recipe.hiddenThisWeek !== true
  ));
  const activeViewCopy = menuViewCopy[view] || menuViewCopy.recipes;
  const heroMetrics = [
    {
      label: "Products",
      value: recipes.length,
      detail: `${visibleRecipes.length} active`,
      icon: Tags,
    },
    {
      label: "Visible this week",
      value: visibleRecipes.length,
      detail: `${recipes.filter((recipe) => recipe.hiddenThisWeek).length} hidden · ${recipes.filter((recipe) => recipe.soldOut).length} sold out`,
      icon: Store,
    },
    {
      label: "Ready shelf",
      value: props.bakerySettings?.readyShelfEnabled === false ? "Off" : readyShelfItems.length,
      detail: props.bakerySettings?.readyShelfEnabled === false
        ? "Hidden from customers"
        : `${readyShelfItems.length} in stock`,
      icon: PackageCheck,
    },
    {
      label: "Customer preview",
      value: "Owner preview",
      detail: "See what they see",
      icon: Eye,
    },
  ];

  useEffect(() => {
    if (props.menuView && props.menuView !== view) setView(props.menuView);
  }, [props.menuView, view]);

  function changeView(nextView) {
    setView(nextView);
    props.onChangeMenuView?.(nextView);
  }

  function requestAddProduct() {
    changeView("recipes");
    setAddProductSignal((current) => current + 1);
  }

  function closeProductSheet() {
    setSelectedProductId("");
  }

  function runProductAction(action, recipe) {
    action?.(recipe);
    closeProductSheet();
  }

  return (
    <>
      <section className="page menu-page menu-command-page">
        <section
          className="menu-command-hero"
          style={heroBannerStyle}
        >
          <div className="menu-command-copy">
            <span className="eyebrow-label dark">Owner workspace</span>
            <h1>Menu desk</h1>
            <p>Control what customers can buy, see, and reserve.</p>
          </div>
          <span className="menu-command-mark" aria-hidden="true"><Store size={33} /></span>
          <div className="menu-command-grid">
            {heroMetrics.map((metric) => {
              const MetricIcon = metric.icon;
              return (
                <article className="menu-command-card" key={metric.label}>
                  <MetricIcon size={18} />
                  <span>
                    <small>{metric.label}</small>
                    <strong>{metric.value}</strong>
                    <em>{metric.detail}</em>
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        <section className={`menu-workspace ${view === "recipes" ? "" : "menu-workspace-wide"}`}>
          <div className="menu-main-column">
            <section className="menu-workbench-card">
              <div className="menu-workbench-head">
                <span>
                  <small>{activeViewCopy.label}</small>
                  <h2>{activeViewCopy.title}</h2>
                </span>
                <span>{activeViewCopy.note}</span>
              </div>
              <div className="view-switch menu-view-switch" role="tablist" aria-label="Menu areas">
                {menuViews.map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === id}
                    className={view === id ? "selected" : ""}
                    key={id}
                    onClick={() => changeView(id)}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
              <MenuModeBoard
                activeView={view}
                bakerySettings={props.bakerySettings}
                onAddProduct={requestAddProduct}
                onSelectRecipe={(recipe) => setSelectedProductId(recipe.id)}
                productTypes={productTypes}
                readyShelfItems={readyShelfItems}
                recipes={recipes}
              />
            </section>
            <MenuEmbeddedWorkspace
              {...props}
              bakerySettings={props.bakerySettings}
              cloudAccount={props.cloudAccount}
              previewUrl={previewUrl}
              recipes={props.recipes}
              setReadyShelfItems={setReadyShelfItems}
              view={view}
            />
          </div>
          {view === "recipes" ? (
            <aside className="menu-side-panel" aria-label="Menu customer visibility summary">
              <section className="menu-side-card menu-side-card-dark">
                <span><Globe2 size={20} /></span>
                <div>
                  <small>Storefront status</small>
                  <strong>{props.bakerySettings?.onlineOrdering === false ? "Ordering paused" : "Ordering open"}</strong>
                  <p>{props.bakerySettings?.announcementEnabled ? "Announcement is visible to customers." : "No public announcement showing."}</p>
                </div>
                <button type="button" onClick={() => changeView("preview")}>View storefront</button>
              </section>
              <section className="menu-side-card">
                <div className="section-title-line compact">
                  <h3>Weekly visibility</h3>
                  <button type="button" onClick={() => changeView("storefront")}>Edit</button>
                </div>
                <div className="menu-visibility-list">
                  <span><strong>{visibleRecipes.length}</strong><small>Visible</small></span>
                  <span><strong>{recipes.filter((recipe) => recipe.hiddenThisWeek).length}</strong><small>Hidden</small></span>
                  <span><strong>{recipes.filter((recipe) => recipe.soldOut).length}</strong><small>Sold out</small></span>
                </div>
              </section>
              <section className="menu-side-card">
                <div className="section-title-line compact">
                  <h3>Category tabs</h3>
                  <button type="button" onClick={() => changeView("storefront")}>Rules</button>
                </div>
                {productTypes.slice(0, 5).map((type) => (
                  <span className="menu-side-row" key={type.value}>
                    <span>{type.icon} {type.label}</span>
                    <small>{type.enabled === false ? "Hidden" : "Shown"}</small>
                  </span>
                ))}
              </section>
            </aside>
          ) : null}
        </section>
      </section>

      {view === "recipes" ? <RecipesPage {...props} embeddedContext="menu" openEditorSignal={addProductSignal} /> : null}
      {selectedProduct ? (
        <ProductInfoSheet
          recipe={selectedProduct}
          productTypes={productTypes}
          onAddToCalendar={(recipe) => runProductAction(props.onAddRecipeToCalendar, recipe)}
          onAddToKitchen={(recipe) => runProductAction(props.onAddRecipeToKitchen, recipe)}
          onClose={closeProductSheet}
          onOpenBakeDesk={(recipe) => runProductAction(props.onOpenRecipeInBakeDesk, recipe)}
        />
      ) : null}
    </>
  );
}
