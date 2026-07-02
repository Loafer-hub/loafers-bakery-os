import {
  Eye,
  Globe2,
  Image as ImageIcon,
  PackageCheck,
  Search,
  Settings2,
  ShoppingBag,
  Store,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ReadyShelf } from "../components/ReadyShelf";
import { normalizeProductTypeSettings, productTypeFor } from "../lib/productTypes";
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

function MenuProductBoard({ onAddProduct, productTypes, recipes }) {
  const typeLeaders = productTypes
    .map((type) => recipes.find((recipe) => (recipe.productType || "bread") === type.value))
    .filter(Boolean);
  const featuredRecipes = [
    ...typeLeaders,
    ...recipes.filter((recipe) => !typeLeaders.some((leader) => leader.id === recipe.id)),
  ]
    .sort((a, b) => Number(a.hiddenThisWeek === true) - Number(b.hiddenThisWeek === true))
    .slice(0, 4);
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
            <article className={recipe.hiddenThisWeek ? "menu-product-card hidden" : "menu-product-card"} key={recipe.id}>
              <span className={recipe.photoUrl ? "menu-product-photo" : "menu-product-photo empty"}>
                {recipe.photoUrl ? <img src={recipe.photoUrl} alt={recipe.photoAlt || recipe.name} /> : <ImageIcon size={17} />}
              </span>
              <span>
                <small>{type.label}</small>
                <strong>{recipe.name}</strong>
                <em>{priceLabel(recipe)}</em>
              </span>
              <b>{statusForRecipe(recipe)}</b>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MenuModeBoard({ activeView, bakerySettings, onAddProduct, productTypes, recipes, readyShelfItems }) {
  if (activeView === "recipes") return <MenuProductBoard onAddProduct={onAddProduct} productTypes={productTypes} recipes={recipes} />;
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

export default function MenuPage(props) {
  const [view, setView] = useState(props.menuView || "recipes");
  const [readyShelfItems, setReadyShelfItems] = useState([]);
  const [addProductSignal, setAddProductSignal] = useState(0);
  const previewUrl = useMemo(() => {
    const slug = props.cloudAccount?.workspace?.bakery?.slug || "loafers";
    return `?order=${encodeURIComponent(slug)}&preview=owner&release=menu-desk-v1`;
  }, [props.cloudAccount?.workspace?.bakery?.slug]);
  const productTypes = useMemo(() => normalizeProductTypeSettings(props.bakerySettings), [props.bakerySettings]);
  const recipes = props.recipes || [];
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
      detail: "Saved recipes and sellable goods",
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
      value: props.bakerySettings?.readyShelfEnabled === false ? "Off" : "On",
      detail: readyShelfItems.length ? `${readyShelfItems.length} cloud item${readyShelfItems.length === 1 ? "" : "s"}` : "Recipe or custom stock",
      icon: PackageCheck,
    },
    {
      label: "Customer preview",
      value: "Ready",
      detail: "Check the public storefront",
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

  return (
    <>
      <section className="page menu-page menu-command-page">
        <section className="menu-command-hero">
          <div className="menu-command-copy">
            <span className="eyebrow-label dark">Customer shelf control</span>
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

        <section className="menu-workspace">
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
                productTypes={productTypes}
                readyShelfItems={readyShelfItems}
                recipes={recipes}
              />
            </section>
          </div>
          <aside className="menu-side-panel" aria-label="Menu customer visibility summary">
            <section className="menu-side-card menu-side-card-dark">
              <span><Globe2 size={20} /></span>
              <div>
                <small>Storefront status</small>
                <strong>{props.bakerySettings?.onlineOrdering === false ? "Ordering paused" : "Ordering open"}</strong>
                <p>{props.bakerySettings?.announcementEnabled ? "Announcement is visible to customers." : "No public announcement showing."}</p>
              </div>
              <button type="button" onClick={() => changeView("preview")}>Preview storefront</button>
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
        </section>
      </section>

      {view === "recipes" ? <RecipesPage {...props} embeddedContext="menu" openEditorSignal={addProductSignal} /> : null}
      {view === "storefront" ? <SettingsPage {...props} embeddedContext="menu" /> : null}
      {view === "shelf" ? (
        <main className="page menu-ready-shelf-page">
          <ReadyShelf
            cloudAccount={props.cloudAccount}
            enabled={props.bakerySettings?.readyShelfEnabled !== false}
            onShelfChange={setReadyShelfItems}
            recipes={props.recipes}
          />
        </main>
      ) : null}
      {view === "preview" ? (
        <main className="page menu-preview-page">
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
        </main>
      ) : null}
    </>
  );
}
