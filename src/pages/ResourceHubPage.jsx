import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe2,
  Image,
  Info,
  Link2,
  PackagePlus,
  Pencil,
  Plus,
  Save,
  Share2,
  Store,
  Trash2,
  Upload,
  Video,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { usePersistentState } from "../hooks/usePersistentState";

const resourceTypeOptions = [
  {
    value: "article",
    label: "Article",
    icon: FileText,
    help: "Longer writeups, customer education, recipes, SOPs, or notes.",
    urlLabel: "Article or source link",
  },
  {
    value: "poll",
    label: "Poll",
    icon: BarChart3,
    help: "Question cards for future customer voting or flavor feedback.",
    urlLabel: "Optional result or form link",
  },
  {
    value: "information",
    label: "Information",
    icon: Info,
    help: "Reusable customer instructions, product care notes, or FAQs.",
    urlLabel: "Optional supporting link",
  },
  {
    value: "link",
    label: "Link",
    icon: Link2,
    help: "Quick links to order forms, documents, videos, folders, or resources.",
    urlLabel: "URL",
  },
  {
    value: "photo",
    label: "Photo",
    icon: Image,
    help: "Photo references, menu images, label art, or product shots.",
    urlLabel: "Photo URL",
  },
  {
    value: "video",
    label: "Video",
    icon: Video,
    help: "Technique clips, walkthroughs, announcements, or hosted videos.",
    urlLabel: "Video URL",
  },
];

const seedResourceBenchItems = [
  {
    id: "bench-printable-recipe-cards",
    type: "article",
    title: "Printable recipe cards",
    summary: "Share polished recipes, ingredient notes, and customer-friendly instructions.",
    url: "",
    details: "Good first resource for customer handouts and downloadable product guides.",
    options: [],
    createdAt: "2026-07-06T12:00:00.000Z",
  },
  {
    id: "bench-product-launch-sheets",
    type: "information",
    title: "Product launch sheets",
    summary: "Bundle pricing, labels, photos, preorder windows, and batch notes for each new item.",
    url: "",
    details: "Use for weekly drops, seasonal products, or new menu categories.",
    options: [],
    createdAt: "2026-07-06T12:05:00.000Z",
  },
  {
    id: "bench-customer-education-library",
    type: "article",
    title: "Customer education library",
    summary: "Explain pickup, storage, reheating, fermentation, allergens, and specialty products.",
    url: "",
    details: "A customer-facing library can reduce repeated questions and make the storefront feel more professional.",
    options: [],
    createdAt: "2026-07-06T12:10:00.000Z",
  },
];

const emptyResourceDraft = {
  type: "article",
  title: "",
  summary: "",
  url: "",
  details: "",
  pollOptions: "",
  photoUrl: "",
  photoAlt: "",
};

function ownerBaseUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

function resourceTypeMeta(type) {
  return resourceTypeOptions.find((option) => option.value === type) ?? resourceTypeOptions[0];
}

function makeResourceId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `resource-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatResourceDate(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved resource";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function draftFromResource(item) {
  return {
    type: item?.type || "article",
    title: item?.title || "",
    summary: item?.summary || "",
    url: item?.url || "",
    details: item?.details || "",
    pollOptions: Array.isArray(item?.options) ? item.options.join("\n") : "",
    photoUrl: item?.photoUrl || "",
    photoAlt: item?.photoAlt || item?.title || "",
  };
}

function resizeResourcePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error("Choose an image file."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      const source = String(reader.result || "");
      if (typeof window === "undefined") {
        resolve(source);
        return;
      }

      const loadedImage = new window.Image();
      loadedImage.onerror = () => resolve(source);
      loadedImage.onload = () => {
        const maxEdge = 1200;
        const width = loadedImage.naturalWidth || loadedImage.width;
        const height = loadedImage.naturalHeight || loadedImage.height;
        const scale = Math.min(1, maxEdge / Math.max(width, height));

        if (scale >= 1 && source.length < 450_000) {
          resolve(source);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(source);
          return;
        }
        context.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      loadedImage.src = source;
    };
    reader.readAsDataURL(file);
  });
}

export default function ResourceHubPage({ setActive, onOpenStorage }) {
  const baseUrl = ownerBaseUrl();
  const storefrontUrl = baseUrl ? `${baseUrl}?order=loafers` : "?order=loafers";
  const ownerUrl = baseUrl || "/";
  const [resourceView, setResourceView] = useState("hub");
  const [benchItems, setBenchItems] = usePersistentState("loafers-resource-bench-v1", seedResourceBenchItems);
  const [draft, setDraft] = useState(emptyResourceDraft);
  const [editingId, setEditingId] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const safeBenchItems = useMemo(() => (Array.isArray(benchItems) ? benchItems : []), [benchItems]);
  const currentType = resourceTypeMeta(draft.type);
  const CurrentTypeIcon = currentType.icon;

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

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function resetDraft(nextType = draft.type) {
    setDraft({ ...emptyResourceDraft, type: nextType });
    setEditingId(null);
    setPhotoError("");
  }

  function editBenchItem(item) {
    setEditingId(item.id);
    setDraft(draftFromResource(item));
    setPhotoError("");
  }

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoError("");
    try {
      const photoUrl = await resizeResourcePhoto(file);
      setDraft((current) => ({
        ...current,
        photoUrl,
        photoAlt: current.photoAlt || file.name.replace(/\.[^.]+$/, ""),
      }));
    } catch (error) {
      setPhotoError(error?.message || "Could not upload that photo.");
    } finally {
      event.target.value = "";
    }
  }

  function saveBenchItem(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;

    const options = draft.pollOptions
      .split(/\r?\n|,/)
      .map((option) => option.trim())
      .filter(Boolean);

    const nextItem = {
      id: makeResourceId(),
      type: draft.type,
      title,
      summary: draft.summary.trim(),
      url: draft.url.trim(),
      details: draft.details.trim(),
      options: draft.type === "poll" ? options : [],
      photoUrl: draft.photoUrl,
      photoAlt: draft.photoAlt.trim() || title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setBenchItems((current) => {
      const list = Array.isArray(current) ? current : [];
      if (!editingId) return [nextItem, ...list];
      return list.map((item) => (item.id === editingId
        ? {
          ...item,
          ...nextItem,
          id: item.id,
          createdAt: item.createdAt || nextItem.createdAt,
        }
        : item));
    });
    resetDraft(draft.type);
  }

  function removeBenchItem(itemId) {
    setBenchItems((current) => (Array.isArray(current) ? current.filter((item) => item.id !== itemId) : []));
    if (editingId === itemId) resetDraft();
  }

  if (resourceView === "bench") {
    return (
      <main className="page resource-hub-page resource-bench-page">
        <PageHeading
          title="Resource bench"
          subtitle="Add, organize, and remove shareable bakery resources before they become public systems."
          action={
            <button className="resource-back-button" type="button" onClick={() => setResourceView("hub")}>
              <ArrowLeft size={18} />
              Back to hub
            </button>
          }
        />

        <section className="resource-bench-layout">
          <form className="resource-bench-form" onSubmit={saveBenchItem}>
            <div className="section-title-line">
              <div>
                <span className="eyebrow-label dark">{editingId ? "Edit resource" : "Add resource"}</span>
                <h2>{editingId ? "Refine this resource card." : "Build the next shareable thing."}</h2>
              </div>
              {editingId ? <Pencil size={22} /> : <Plus size={22} />}
            </div>

            <label>
              Resource type
              <select value={draft.type} onChange={(event) => updateDraft("type", event.target.value)}>
                {resourceTypeOptions.map(({ value, label }) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>

            <div className="resource-type-help">
              <CurrentTypeIcon size={18} />
              <span>{currentType.help}</span>
            </div>

            <label>
              Title
              <input
                type="text"
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder="Customer education library"
                required
              />
            </label>

            <label>
              Short description
              <textarea
                value={draft.summary}
                onChange={(event) => updateDraft("summary", event.target.value)}
                placeholder="What this resource is for and who should use it."
                rows={3}
              />
            </label>

            <label>
              {currentType.urlLabel}
              <input
                type="url"
                value={draft.url}
                onChange={(event) => updateDraft("url", event.target.value)}
                placeholder="https://..."
              />
            </label>

            <section className="resource-photo-uploader">
              <div className="resource-photo-upload-head">
                <span>
                  <strong>Photo attachment</strong>
                  <small>Upload a product shot, article image, label proof, or resource cover.</small>
                </span>
                <Upload size={18} />
              </div>
              {draft.photoUrl ? (
                <figure className="resource-photo-preview">
                  <img src={draft.photoUrl} alt={draft.photoAlt || draft.title || "Resource preview"} />
                  <button type="button" onClick={() => updateDraft("photoUrl", "")}>
                    <X size={14} />
                    Clear photo
                  </button>
                </figure>
              ) : null}
              <label>
                Upload photo
                <input type="file" accept="image/*" onChange={handlePhotoUpload} />
              </label>
              <label>
                Photo description
                <input
                  type="text"
                  value={draft.photoAlt}
                  onChange={(event) => updateDraft("photoAlt", event.target.value)}
                  placeholder="Rustic sourdough on a cutting board"
                />
              </label>
              {photoError ? <p className="resource-form-error">{photoError}</p> : null}
            </section>

            {draft.type === "poll" ? (
              <label>
                Poll options
                <textarea
                  value={draft.pollOptions}
                  onChange={(event) => updateDraft("pollOptions", event.target.value)}
                  placeholder={"Cinnamon raisin\nJalapeño cheddar\nEverything bagel"}
                  rows={4}
                />
              </label>
            ) : null}

            <label>
              Notes / body
              <textarea
                value={draft.details}
                onChange={(event) => updateDraft("details", event.target.value)}
                placeholder="Longer instructions, ideas, SOP notes, or publishing plan."
                rows={5}
              />
            </label>

            <div className="resource-bench-form-actions">
              <button className="primary-button" type="submit">
                {editingId ? <Save size={17} /> : <Plus size={17} />}
                {editingId ? "Save resource changes" : "Add to Resource bench"}
              </button>
              {editingId ? (
                <button className="secondary-button" type="button" onClick={() => resetDraft()}>
                  <X size={15} />
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <section className="resource-bench-library">
            <div className="section-title-line">
              <div>
                <span className="eyebrow-label dark">Saved shelf</span>
                <h2>{safeBenchItems.length} resources ready to shape.</h2>
              </div>
              <FolderKanban size={22} />
            </div>

            <div className="resource-bench-list">
              {safeBenchItems.length ? safeBenchItems.map((item) => {
                const meta = resourceTypeMeta(item.type);
                const Icon = meta.icon;
                return (
                  <article className="resource-bench-item" key={item.id}>
                    <div className="resource-bench-item-top">
                      <span className="resource-bench-kind"><Icon size={15} />{meta.label}</span>
                      <span className="resource-bench-actions">
                        <button type="button" onClick={() => editBenchItem(item)} aria-label={`Edit ${item.title}`}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" onClick={() => removeBenchItem(item.id)} aria-label={`Remove ${item.title}`}>
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </div>
                    {item.photoUrl ? (
                      <figure className="resource-bench-photo">
                        <img src={item.photoUrl} alt={item.photoAlt || item.title} />
                      </figure>
                    ) : null}
                    <strong>{item.title}</strong>
                    {item.summary ? <p>{item.summary}</p> : null}
                    {item.details ? <small>{item.details}</small> : null}
                    {item.options?.length ? (
                      <ul>
                        {item.options.map((option) => <li key={option}>{option}</li>)}
                      </ul>
                    ) : null}
                    <div className="resource-bench-item-footer">
                      <span>{item.updatedAt ? `Updated ${formatResourceDate(item.updatedAt)}` : formatResourceDate(item.createdAt)}</span>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          Open link
                          <ExternalLink size={13} />
                        </a>
                      ) : <em>No link yet</em>}
                    </div>
                  </article>
                );
              }) : (
                <article className="resource-bench-empty">
                  <BookOpen size={24} />
                  <strong>No resources saved yet.</strong>
                  <p>Add articles, polls, info cards, links, photos, and videos from the form.</p>
                </article>
              )}
            </div>
          </section>
        </section>
      </main>
    );
  }

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
          <button className="resource-small-action" type="button" onClick={() => setResourceView("bench")}>
            Open Resource bench
          </button>
        </div>
        <div className="resource-roadmap-list">
          <article><ClipboardList size={17} /><span><strong>Printable recipe cards</strong><small>Share polished recipes, ingredient notes, and customer-friendly instructions.</small></span></article>
          <article><PackagePlus size={17} /><span><strong>Product launch sheets</strong><small>Bundle pricing, labels, photos, preorder windows, and batch notes for each new item.</small></span></article>
          <article><BookOpen size={17} /><span><strong>Customer education library</strong><small>Explain pickup, storage, reheating, fermentation, allergens, and specialty products.</small></span></article>
        </div>
        <button className="resource-bench-wide-link" type="button" onClick={() => setResourceView("bench")}>
          <Wrench size={18} />
          Manage articles, polls, information, links, photos, and videos
        </button>
      </section>
    </main>
  );
}
