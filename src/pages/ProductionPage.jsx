import { Beaker, CalendarDays, ChefHat, Factory, FlaskConical, Wheat } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import BakePage from "./BakePage";
import LiquidPage from "./LiquidPage";

const productionViews = [
  {
    id: "bake",
    label: "Bread work",
    icon: ChefHat,
    title: "Schedules, Kitchen board, batch planning, calendar, and starters.",
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

  useEffect(() => {
    document.querySelector(".scroll-view")?.scrollTo({ top: 0, left: 0 });
  }, [view]);

  return (
    <>
      <section className="page hub-page production-hub-page">
        <PageHeading
          title="Production"
          subtitle="One workbench for bread, yeast bakes, starters, ferments, oils, sauces, and vinegar projects."
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
            <strong>{view === "liquid" ? "Ferments and infusions belong in production too." : "Bread work has clearer lanes now."}</strong>
            <small>{view === "liquid" ? "Use the liquid calculators before a product becomes menu-ready." : "Schedule builds one timeline. Kitchen board tracks live work. Batch plan groups orders. Calendar shows booked and blocked days. Starter care keeps culture records."}</small>
          </span>
          {view === "bake" ? <CalendarDays size={18} /> : null}
        </aside>
      </section>

      {view === "bake" ? <BakePage {...props} /> : <LiquidPage {...props} />}
    </>
  );
}
