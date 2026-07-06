import {
  BookOpen,
  ClipboardList,
  Download,
  ExternalLink,
  FolderKanban,
  Globe2,
  PackagePlus,
  Share2,
  Store,
  Wrench,
} from "lucide-react";
import { PageHeading } from "../components/AppChrome";

function ownerBaseUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

export default function ResourceHubPage({ setActive, onOpenStorage }) {
  const baseUrl = ownerBaseUrl();
  const storefrontUrl = baseUrl ? `${baseUrl}?order=loafers` : "?order=loafers";
  const ownerUrl = baseUrl || "/";

  const linkCards = [
    {
      title: "Customer storefront",
      body: "Share this with customers so they can browse the menu, see availability, and send requests.",
      href: storefrontUrl,
      icon: Store,
      action: "Open storefront",
    },
    {
      title: "Owner command",
      body: "Your private working app for orders, production, menu controls, logbook, settings, and reports.",
      href: ownerUrl,
      icon: Globe2,
      action: "Open owner app",
    },
  ];

  const systemCards = [
    {
      title: "Product systems",
      body: "Build future systems for labels, recipe packs, product sheets, classes, preorder drops, and downloadable guides.",
      icon: PackagePlus,
      onClick: () => setActive?.("menu", { navKey: "menu" }),
      action: "Open Menu desk",
    },
    {
      title: "SOP + documentation shelf",
      body: "Keep workflow notes, changelog, safety reminders, and future how-to resources in one place.",
      icon: BookOpen,
      onClick: () => setActive?.("help", { navKey: "help" }),
      action: "Open Help",
    },
    {
      title: "Data + backup resources",
      body: "Use Storage when you want to export, restore, or move the bakery data behind your hosted systems.",
      icon: Download,
      onClick: onOpenStorage,
      action: "Open Storage",
    },
  ];

  return (
    <main className="page resource-hub-page">
      <PageHeading
        title="Resource hub"
        subtitle="A home for shareable bakery links, future product systems, SOPs, downloads, and hosted resources."
        action={<span className="hub-heading-icon"><Share2 size={22} /></span>}
      />

      <section className="resource-hero-card">
        <div>
          <span className="eyebrow-label dark">Loafers owner shelf</span>
          <h2>Build once, share anywhere.</h2>
          <p>
            Use this space as the launchpad for anything you want customers, friends, or future buyers
            to access: storefront links, recipe packs, product sheets, food safety notes, labels, and
            new mini-systems that grow out of the bakery.
          </p>
        </div>
        <FolderKanban size={44} />
      </section>

      <section className="resource-card-grid" aria-label="Shareable links">
        {linkCards.map(({ title, body, href, icon: Icon, action }) => (
          <a className="resource-link-card" href={href} target="_blank" rel="noreferrer" key={title}>
            <Icon size={22} />
            <span>
              <strong>{title}</strong>
              <small>{body}</small>
            </span>
            <em>{action}<ExternalLink size={14} /></em>
          </a>
        ))}
      </section>

      <section className="resource-card-grid" aria-label="Product system shortcuts">
        {systemCards.map(({ title, body, icon: Icon, action, onClick }) => (
          <button className="resource-link-card" type="button" onClick={onClick} key={title}>
            <Icon size={22} />
            <span>
              <strong>{title}</strong>
              <small>{body}</small>
            </span>
            <em>{action}</em>
          </button>
        ))}
      </section>

      <section className="resource-roadmap-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Next systems to host</span><h2>Ideas shelf</h2></div>
          <Wrench size={22} />
        </div>
        <div className="resource-roadmap-list">
          <article><ClipboardList size={17} /><span><strong>Printable recipe cards</strong><small>Share polished recipes, ingredient notes, and customer-friendly instructions.</small></span></article>
          <article><PackagePlus size={17} /><span><strong>Product launch sheets</strong><small>Bundle pricing, labels, photos, preorder windows, and batch notes for each new item.</small></span></article>
          <article><BookOpen size={17} /><span><strong>Customer education library</strong><small>Explain pickup, storage, reheating, fermentation, allergens, and specialty products.</small></span></article>
        </div>
      </section>
    </main>
  );
}
