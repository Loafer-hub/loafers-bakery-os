import { Beaker, CalendarDays, ChefHat, Factory, FlaskConical, Wheat } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "../components/AppChrome";
import BakePage from "./BakePage";
import LiquidPage from "./LiquidPage";

const productionViews = [
  {
    id: "bake",
    label: "Bake floor",
    icon: ChefHat,
    title: "Bread, yeast, starters, Kitchen, and bake calendar.",
  },
  {
    id: "liquid",
    label: "Liquid lab",
    icon: FlaskConical,
    title: "Hot sauces, vinegars, oils, pH, salt, and extraction planning.",
  },
];

export default function ProductionPage(props) {
  const [view, setView] = useState("bake");
  const ActiveIcon = view === "liquid" ? Beaker : Wheat;

  return (
    <>
      <section className="page hub-page production-hub-page">
        <PageHeading
          title="Production"
          subtitle="Plan the work, run the Kitchen board, manage starters, and keep specialty batches scientific."
          action={<span className="hub-heading-icon"><Factory size={22} /></span>}
        />

        <div className="hub-switch" role="tablist" aria-label="Production areas">
          {productionViews.map(({ id, label, icon: Icon, title }) => (
            <button
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? "selected" : ""}
              key={id}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              <span><strong>{label}</strong><small>{title}</small></span>
            </button>
          ))}
        </div>

        <aside className="hub-context-card">
          <ActiveIcon size={20} />
          <span>
            <strong>{view === "liquid" ? "Ferments and infusions belong in production too." : "Kitchen work starts here."}</strong>
            <small>{view === "liquid" ? "Use the liquid calculators before a product becomes menu-ready." : "Use Planner for timing, Kitchen for live work, Production for batching, Bakes for calendar, and Starters for culture care."}</small>
          </span>
          {view === "bake" ? <CalendarDays size={18} /> : null}
        </aside>
      </section>

      {view === "bake" ? <BakePage {...props} /> : <LiquidPage />}
    </>
  );
}
