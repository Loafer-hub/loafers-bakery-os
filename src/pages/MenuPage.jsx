import { Eye, Globe2, PackageCheck, Settings2, Store, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { ReadyShelf } from "../components/ReadyShelf";
import RecipesPage from "./RecipesPage";
import SettingsPage from "./SettingsPage";

const menuViews = [
  {
    id: "recipes",
    label: "Products",
    note: "Recipes, formulas, photos, units, pricing, and flour science.",
    icon: Tags,
  },
  {
    id: "storefront",
    label: "Storefront",
    note: "Product types, availability, badges, options, pickup, and customer rules.",
    icon: Settings2,
  },
  {
    id: "shelf",
    label: "Ready shelf",
    note: "Already-made items customers can reserve without future bake capacity.",
    icon: PackageCheck,
  },
  {
    id: "preview",
    label: "Preview",
    note: "See the customer menu exactly as shoppers experience it.",
    icon: Eye,
  },
];

export default function MenuPage(props) {
  const [view, setView] = useState(props.menuView || "recipes");
  const previewUrl = useMemo(() => {
    const slug = props.cloudAccount?.workspace?.bakery?.slug || "loafers";
    return `?order=${encodeURIComponent(slug)}&preview=owner&release=menu-hub-v1`;
  }, [props.cloudAccount?.workspace?.bakery?.slug]);

  useEffect(() => {
    if (props.menuView && props.menuView !== view) setView(props.menuView);
  }, [props.menuView, view]);

  function changeView(nextView) {
    setView(nextView);
    props.onChangeMenuView?.(nextView);
  }

  return (
    <>
      <section className="page hub-page menu-hub-page">
        <PageHeading
          title="Menu"
          subtitle="Control what customers see, what they can order, and what is ready right now."
          action={<span className="hub-heading-icon"><Store size={22} /></span>}
        />

        <div className="hub-switch menu-hub-switch" role="tablist" aria-label="Menu areas">
          {menuViews.map(({ id, label, note, icon: Icon }) => (
            <button
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? "selected" : ""}
              key={id}
              onClick={() => changeView(id)}
            >
              <Icon size={18} />
              <span><strong>{label}</strong><small>{note}</small></span>
            </button>
          ))}
        </div>
      </section>

      {view === "recipes" ? <RecipesPage {...props} /> : null}
      {view === "storefront" ? <SettingsPage {...props} embeddedContext="menu" /> : null}
      {view === "shelf" ? (
        <main className="page menu-ready-shelf-page">
          <ReadyShelf
            cloudAccount={props.cloudAccount}
            enabled={props.bakerySettings?.readyShelfEnabled !== false}
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
