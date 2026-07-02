import {
  BookOpen,
  CalendarDays,
  ChefHat,
  ClipboardList,
  HelpCircle,
  LineChart,
  PackageCheck,
  Settings2,
  ShieldCheck,
  Store,
  UsersRound,
  Wheat,
} from "lucide-react";
import { PageHeading } from "../components/AppChrome";
import { LOAFERS_BRAND } from "../lib/brand";

const guideSections = [
  {
    title: "Today",
    icon: Wheat,
    body: "Use Today as the command center: pending requests, today’s bake, starter status, order summary, ready shelf, and live fermentation visuals.",
  },
  {
    title: "Orders",
    icon: ClipboardList,
    body: "Accept, reject, comment on, complete, and open detailed customer orders. Accepted orders feed the production calendar and customer status updates.",
  },
  {
    title: "Bake desk",
    icon: ChefHat,
    body: "Plan recipe timelines, work the Kitchen board, and group accepted orders into smart batch plans. This is where active bake decisions happen.",
  },
  {
    title: "Production",
    icon: CalendarDays,
    body: "Production now owns the bake calendar, unavailable days, starter care, and inventory on hand. This keeps Bake desk focused and uncluttered.",
  },
  {
    title: "Menu",
    icon: Store,
    body: "Control what customers see: product cards, photos, options, weekly visibility, sold out state, preorder/ready badges, and product type settings.",
  },
  {
    title: "Business",
    icon: LineChart,
    body: "Reports, purchases, inventory editing, batch traceability, pricing intelligence, owner quality checks, customer records, and the logbook live here.",
  },
  {
    title: "Settings",
    icon: Settings2,
    body: "Set bakery capacity, order window, pickup hours, privacy controls, notifications, customer options, and storefront rules.",
  },
];

const changelogItems = [
  "Separated Bake desk from Production so the two sidebar buttons no longer open the same workspace.",
  "Moved Calendar and Starters into Production and added Inventory on hand to the same operations area.",
  "Added full-page Logbook and Customers workspaces from the left rail, while keeping quick modal views for dashboard metric buttons.",
  "Added this Help center as the in-app home for documentation, workflow notes, and changelog history.",
  "Rebranded the app around Loafers Home Bakery with the darker aurora-inspired owner shell and refreshed customer storefront.",
  "Added customer accounts, privacy controls, ready shelf, product availability controls, labels, compliance notes, and PWA install support.",
  "Added liquid products, pH/salt safety logs, recipe photos, product types, customer menu flow, and storefront announcements.",
];

export default function HelpPage() {
  return (
    <main className="page help-page">
      <section className="help-hero-card">
        <div className="help-brand-mark">
          <img src={LOAFERS_BRAND.badgeSrc} alt="" />
        </div>
        <PageHeading
          title="Need help?"
          subtitle="Documentation, owner workflow guide, and changelog for Loafers Home Bakery."
          action={<span className="hub-heading-icon"><HelpCircle size={22} /></span>}
        />
        <p>
          The app is organized like a one-person bakery: customers and requests enter through Orders/Menu,
          real work happens in Bake desk and Production, and business records live under Business.
        </p>
      </section>

      <section className="help-doc-grid" aria-label="App documentation">
        {guideSections.map(({ title, icon: Icon, body }) => (
          <article className="help-doc-card" key={title}>
            <Icon size={20} />
            <span>
              <strong>{title}</strong>
              <small>{body}</small>
            </span>
          </article>
        ))}
      </section>

      <section className="help-workflow-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Owner flow</span><h2>Recommended daily rhythm</h2></div>
          <PackageCheck size={22} />
        </div>
        <ol className="help-step-list">
          <li><strong>Start in Today.</strong><span>Check pending requests, production warnings, and the next bake step.</span></li>
          <li><strong>Open Orders.</strong><span>Accept, reject, comment, or complete customer requests.</span></li>
          <li><strong>Use Production.</strong><span>Review the calendar, starter feeds, blocked days, and inventory before committing to work.</span></li>
          <li><strong>Work in Bake desk.</strong><span>Plan the timeline, start the Kitchen board, and group bakes when it saves effort.</span></li>
          <li><strong>Finish in Business.</strong><span>Log purchases, check shortages, update customer profiles, and keep batch records current.</span></li>
        </ol>
      </section>

      <section className="help-safety-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Food safety</span><h2>Built-in reminders</h2></div>
          <ShieldCheck size={22} />
        </div>
        <p>
          Use safety logs for hot sauces, vinegars, and infused oils. Track pH, salt percentage,
          batch date, shelf life, storage instructions, warning notes, and recall notes. For bread,
          keep allergy notes and customer preferences attached to orders and customer profiles.
        </p>
      </section>

      <section className="help-changelog-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Changelog</span><h2>What changed recently</h2></div>
          <BookOpen size={22} />
        </div>
        <div className="help-changelog-list">
          {changelogItems.map((item) => (
            <article key={item}>
              <span />
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="help-note-card">
        <UsersRound size={19} />
        <span>
          <strong>Best mental model</strong>
          <small>Customers see the storefront. You run the owner shell. Production holds shared operations. Bake desk holds hands-on baking.</small>
        </span>
      </section>
    </main>
  );
}
