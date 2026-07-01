import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock3,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageSquareText,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { Modal } from "../components/Primitives";
import {
  getAutomaticEmailStatus,
  listCustomerAccessEvents,
  listEmailNotificationDeliveries,
  publishRecipeCatalog,
  publicOrderUrl,
  sendAutomaticEmailTest,
} from "../lib/cloud";
import { normalizedBakerySettings } from "../lib/bakerySettings";
import { normalizeProductTypeSettings } from "../lib/productTypes";

// product-type-settings-v1
// settings-collapse-v1
// customer-options-v1
// checkout-flow-v1

function ToggleRow({ checked, label, note, onChange }) {
  return (
    <label className="automation-toggle-row">
      <span><strong>{label}</strong><small>{note}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function TimeWindow({ label, value, onChange }) {
  return (
    <div className="settings-time-window">
      <strong>{label}</strong>
      <label>From<input type="time" value={value.start} onChange={(event) => onChange({ ...value, start: event.target.value })} /></label>
      <label>To<input type="time" value={value.end} onChange={(event) => onChange({ ...value, end: event.target.value })} /></label>
    </div>
  );
}

function CollapsibleSettingsCard({ children, className = "", eyebrow, icon, summary, title }) {
  return (
    <details className={`settings-card settings-accordion ${className}`}>
      <summary className="settings-accordion-summary">
        <div className="section-title-line">
          <div>
            <span className="eyebrow-label dark">{eyebrow}</span>
            <h2>{title}</h2>
            {summary ? <small>{summary}</small> : null}
          </div>
          <span className="settings-accordion-icon">{icon}</span>
        </div>
        <ChevronDown className="settings-accordion-chevron" size={19} />
      </summary>
      <div className="settings-accordion-body">
        {children}
      </div>
    </details>
  );
}

function ProductTypeSettingsCard({
  onAddCustomerOption,
  index,
  onAddPackage,
  onMove,
  onRemoveCustomerOption,
  onRemovePackage,
  onUpdate,
  onUpdateCustomerOption,
  onUpdatePackage,
  total,
  type,
}) {
  return (
    <details className={type.enabled ? "product-type-card" : "product-type-card disabled"}>
      <summary className="product-type-card-heading">
        <span className="product-type-badge" aria-hidden="true">{type.icon}</span>
        <div>
          <strong>{type.label}</strong>
          <small>{type.enabled ? "Shown" : "Hidden"} · tab #{index + 1} · {type.packagePresets.length} package{type.packagePresets.length === 1 ? "" : "s"} · {type.unitName}</small>
        </div>
        <ChevronDown className="settings-accordion-chevron" size={18} />
      </summary>
      <div className="product-type-card-body">
        <div className="product-type-quick-actions">
          <label className="product-type-switch">
            <input type="checkbox" checked={type.enabled} onChange={(event) => onUpdate(type.value, { enabled: event.target.checked })} />
            <span>{type.enabled ? "Shown on customer page" : "Hidden from customer page"}</span>
          </label>
          <div className="product-type-order-actions" aria-label={`${type.label} display order`}>
            <button type="button" disabled={index === 0} onClick={() => onMove(type.value, -1)}><ArrowUp size={14} /> Up</button>
            <button type="button" disabled={index === total - 1} onClick={() => onMove(type.value, 1)}><ArrowDown size={14} /> Down</button>
          </div>
        </div>

        <div className="product-type-fields">
          <label>
            Default unit
            <input value={type.unitName} onChange={(event) => onUpdate(type.value, { unitName: event.target.value })} placeholder="loaf, dozen, bottle, jar" />
          </label>
          <label className="span-2">
            Customer-facing description
            <textarea value={type.description} onChange={(event) => onUpdate(type.value, { description: event.target.value })} />
          </label>
          <label className="span-2">
            Safety / storage notes
            <textarea value={type.safetyNotes} onChange={(event) => onUpdate(type.value, { safetyNotes: event.target.value })} />
          </label>
        </div>

        <div className="product-customer-options">
          <div className="product-package-heading">
            <span>
              <strong>Customer choices</strong>
              <small>Show or hide weekly options like slicing, spice level, packaging, or gift notes.</small>
            </span>
            <button type="button" onClick={() => onAddCustomerOption(type.value)}><Plus size={14} /> Add choice</button>
          </div>
          <div className="product-customer-option-list">
            {(type.customerOptions || []).map((option) => (
              <div className={option.enabled ? "product-customer-option-row" : "product-customer-option-row disabled"} key={option.id}>
                <div className="product-choice-toggle-line">
                  <label className="product-type-switch">
                    <input
                      type="checkbox"
                      checked={option.enabled !== false}
                      onChange={(event) => onUpdateCustomerOption(type.value, option.id, { enabled: event.target.checked })}
                    />
                    <span>{option.enabled !== false ? "Shown to customers" : "Hidden this week"}</span>
                  </label>
                  <label className="product-choice-required">
                    <input
                      type="checkbox"
                      checked={option.required === true}
                      onChange={(event) => onUpdateCustomerOption(type.value, option.id, { required: event.target.checked })}
                    />
                    Required
                  </label>
                  <button type="button" className="remove-ingredient-button" aria-label={`Remove ${option.label}`} onClick={() => onRemoveCustomerOption(type.value, option.id)}><Trash2 size={14} /></button>
                </div>
                <div className="product-choice-fields">
                  <label>
                    Label
                    <input value={option.label} onChange={(event) => onUpdateCustomerOption(type.value, option.id, { label: event.target.value })} />
                  </label>
                  <label>
                    Field type
                    <select value={option.type} onChange={(event) => onUpdateCustomerOption(type.value, option.id, { type: event.target.value })}>
                      <option value="select">Choices</option>
                      <option value="text">Short text</option>
                    </select>
                  </label>
                  <label className="span-2">
                    Help text
                    <input value={option.help || ""} onChange={(event) => onUpdateCustomerOption(type.value, option.id, { help: event.target.value })} placeholder="Tell customers when this choice matters." />
                  </label>
                  {option.type === "select" ? (
                    <label className="span-2">
                      Choices
                      <textarea
                        value={(option.choices || []).join("\n")}
                        onChange={(event) => onUpdateCustomerOption(type.value, option.id, { choices: event.target.value.split(/\n|,/).map((choice) => choice.trim()).filter(Boolean) })}
                        placeholder="One option per line"
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
            {!(type.customerOptions || []).length ? (
              <div className="product-choice-empty">No extra customer choices. Add one if this category needs weekly options.</div>
            ) : null}
          </div>
        </div>

        <div className="product-package-settings">
          <div className="product-package-heading">
            <span>
              <strong>Default packages</strong>
              <small>New recipes of this type start with these package/pricing presets.</small>
            </span>
            <button type="button" onClick={() => onAddPackage(type.value)}><Plus size={14} /> Add package</button>
          </div>
          <div className="product-package-list">
            {type.packagePresets.map((preset) => (
              <div className="product-package-row" key={preset.id}>
                <label>
                  Label
                  <input value={preset.label} onChange={(event) => onUpdatePackage(type.value, preset.id, { label: event.target.value })} />
                </label>
                <label>
                  Units
                  <input type="number" min="0.5" max="120" step="0.5" value={preset.units} onChange={(event) => onUpdatePackage(type.value, preset.id, { units: Number(event.target.value) })} />
                </label>
                <label>
                  Price
                  <input type="number" min="0" step="0.25" value={preset.price} onChange={(event) => onUpdatePackage(type.value, preset.id, { price: Number(event.target.value) })} />
                </label>
                <label>
                  Bake slots
                  <input type="number" min="0" max="6" value={preset.capacityUnits} onChange={(event) => onUpdatePackage(type.value, preset.id, { capacityUnits: Number(event.target.value) })} />
                </label>
                <button type="button" className="remove-ingredient-button" disabled={type.packagePresets.length <= 1} aria-label={`Remove ${preset.label}`} onClick={() => onRemovePackage(type.value, preset.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

const PRODUCT_BADGE_OPTIONS = [
  { value: "preorder", label: "Preorder" },
  { value: "ready_now", label: "Ready now" },
  { value: "spicy", label: "Spicy" },
  { value: "dairy", label: "Contains dairy" },
  { value: "gluten", label: "Gluten" },
  { value: "limited_batch", label: "Limited batch" },
];

function availabilityDraft(recipe) {
  return {
    available: recipe.available !== false,
    soldOut: recipe.soldOut === true,
    unavailableThisWeek: recipe.unavailableThisWeek === true,
    hiddenThisWeek: recipe.hiddenThisWeek === true,
    availabilityNote: recipe.availabilityNote || "",
    badges: Array.isArray(recipe.badges) ? recipe.badges : [],
  };
}

function productTypeLabelFor(recipe, productTypes) {
  const type = productTypes.find((item) => item.value === (recipe.productType || "bread"));
  return type?.label || recipe.productType || "Bread";
}

function ProductAvailabilityCard({ onSaveRecipe, productTypes, recipe }) {
  const [draft, setDraft] = useState(() => availabilityDraft(recipe));

  useEffect(() => {
    setDraft(availabilityDraft(recipe));
  }, [recipe]);

  function toggleBadge(value, checked) {
    setDraft((current) => ({
      ...current,
      badges: checked
        ? [...new Set([...(current.badges || []), value])]
        : (current.badges || []).filter((badge) => badge !== value),
    }));
  }

  function saveAvailability() {
    if (!onSaveRecipe) return;
    onSaveRecipe({
      ...recipe,
      available: draft.available,
      soldOut: draft.soldOut,
      unavailableThisWeek: draft.unavailableThisWeek,
      hiddenThisWeek: draft.hiddenThisWeek,
      availabilityNote: draft.availabilityNote.trim(),
      badges: draft.badges,
    });
  }

  const badgeSummary = [
    !draft.available ? "Unavailable" : "",
    draft.soldOut ? "Sold out" : "",
    draft.unavailableThisWeek ? "Unavailable week" : "",
    draft.hiddenThisWeek ? "Hidden" : "",
    ...(draft.badges || []).map((badge) => PRODUCT_BADGE_OPTIONS.find((item) => item.value === badge)?.label).filter(Boolean),
  ].filter(Boolean);
  const summary = badgeSummary.length ? badgeSummary.join(" · ") : "Orderable";

  return (
    <details className={`product-availability-card ${draft.hiddenThisWeek ? "hidden-week" : ""}`}>
      <summary className="product-availability-heading">
        <span className="product-availability-icon" aria-hidden="true">{draft.hiddenThisWeek ? <EyeOff size={18} /> : <PackageCheck size={18} />}</span>
        <div>
          <strong>{recipe.name}</strong>
          <small>{productTypeLabelFor(recipe, productTypes)} · {summary}</small>
        </div>
        <ChevronDown className="settings-accordion-chevron" size={18} />
      </summary>
      <div className="product-availability-body">
        <div className="product-availability-toggle-grid">
          <label className="product-type-switch">
            <input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} />
            <span>Orderable</span>
          </label>
          <label className="product-type-switch">
            <input type="checkbox" checked={draft.soldOut} onChange={(event) => setDraft({ ...draft, soldOut: event.target.checked })} />
            <span>Sold out</span>
          </label>
          <label className="product-type-switch">
            <input type="checkbox" checked={draft.unavailableThisWeek} onChange={(event) => setDraft({ ...draft, unavailableThisWeek: event.target.checked })} />
            <span>Unavailable this week</span>
          </label>
          <label className="product-type-switch">
            <input type="checkbox" checked={draft.hiddenThisWeek} onChange={(event) => setDraft({ ...draft, hiddenThisWeek: event.target.checked })} />
            <span>Hidden from customer menu</span>
          </label>
        </div>

        <label className="product-availability-note">
          Customer note
          <input
            value={draft.availabilityNote}
            onChange={(event) => setDraft({ ...draft, availabilityNote: event.target.value })}
            placeholder={draft.soldOut ? "Example: Sold out until Friday" : "Optional note customers can see"}
          />
        </label>

        <fieldset className="recipe-badge-picker">
          <legend>Customer badges</legend>
          <div>
            {PRODUCT_BADGE_OPTIONS.map((badge) => {
              const selected = (draft.badges || []).includes(badge.value);
              return (
                <label className={selected ? "selected" : ""} key={badge.value}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => toggleBadge(badge.value, event.target.checked)}
                  />
                  {badge.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <button className="secondary-button product-availability-save" type="button" onClick={saveAvailability} disabled={!onSaveRecipe}>
          <Save size={15} /> Save product status
        </button>
      </div>
    </details>
  );
}

function SettingsCommandCenter({
  draft,
  emailStatusTitle,
  hasCloudWorkspace,
  onOpenWizard,
  productTypes,
  recipes,
}) {
  const shownTypes = productTypes.filter((type) => type.enabled !== false).length;
  const hiddenProducts = recipes.filter((recipe) => recipe.hiddenThisWeek || recipe.soldOut || recipe.unavailableThisWeek).length;
  const commandCards = [
    {
      icon: <Store size={18} />,
      label: "Storefront",
      value: draft.onlineOrdering ? "Taking requests" : "Paused",
      note: `${draft.readyShelfEnabled ? "Ready shelf on" : "Ready shelf off"} · ${draft.reviewsVisible ? "reviews visible" : "reviews hidden"}`,
    },
    {
      icon: <ShoppingBag size={18} />,
      label: "Orders",
      value: `${draft.dailyCapacity} slots/day`,
      note: `${draft.orderWindowDays}-day window · ${draft.leadTimeDays} day lead time`,
    },
    {
      icon: <Clock3 size={18} />,
      label: "Pickup",
      value: draft.pickupLocation || "No location",
      note: `${draft.pickupIntervalMinutes}-minute pickup intervals`,
    },
    {
      icon: <PackageCheck size={18} />,
      label: "Product types",
      value: `${shownTypes} shown`,
      note: `${productTypes.length - shownTypes} hidden · ${hiddenProducts} weekly product flag${hiddenProducts === 1 ? "" : "s"}`,
    },
    {
      icon: <BellRing size={18} />,
      label: "Notifications",
      value: draft.emailNotifications || draft.smsNotifications ? "Customer updates on" : "Updates off",
      note: draft.automaticEmailNotifications ? emailStatusTitle : "Manual messages only",
    },
    {
      icon: <CheckCircle2 size={18} />,
      label: "Cloud",
      value: hasCloudWorkspace ? "Connected" : "Device only",
      note: hasCloudWorkspace ? "Settings can sync to the customer page." : "Sign in under Storage when ready.",
    },
  ];

  return (
    <section className="settings-command-center">
      <div className="settings-command-hero">
        <span><Settings2 size={22} /></span>
        <div>
          <small>Setup command center</small>
          <h2>Make the public bakery match how you actually work.</h2>
          <p>Use the wizard for the basics, then open only the deeper setting cards you need.</p>
        </div>
        <button type="button" onClick={onOpenWizard}>Open setup wizard</button>
      </div>
      <div className="settings-command-grid">
        {commandCards.map((card) => (
          <article key={card.label}>
            <span>{card.icon}</span>
            <div><small>{card.label}</small><strong>{card.value}</strong><em>{card.note}</em></div>
          </article>
        ))}
      </div>
    </section>
  );
}

const ACCESS_EVENT_LABELS = {
  guest_checkout_blocked: "Guest blocked",
  magic_link_requested: "Sign-in link",
  order_submitted: "Order request",
  order_failed: "Order failed",
  profile_saved: "Profile saved",
};

function accessEventTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function customerAccessErrorMessage(message = "") {
  const value = String(message || "");
  if (value.includes("customer_access_events") || value.includes("record_customer_access_event")) {
    return "Run the customer accounts SQL migration once in Supabase to enable this private access log.";
  }
  return value;
}

function OwnerCustomerAccessDashboard({
  accessError,
  accessEvents,
  accessLoading,
  draft,
  hasCloudWorkspace,
  onRefresh,
}) {
  const accessCards = [
    {
      icon: <ShieldCheck size={17} />,
      label: "Guest checkout",
      value: draft.allowGuestCheckout && !draft.requireSignInForOrders ? "Allowed" : "Blocked",
      note: draft.requireSignInForOrders
        ? "Sign-in required overrides guest checkout."
        : draft.allowGuestCheckout
          ? "Customers may order without an account."
          : "Customers must sign in before ordering.",
    },
    {
      icon: <LockKeyhole size={17} />,
      label: "Order sign-in",
      value: draft.requireSignInForOrders ? "Required" : "Optional",
      note: draft.requireSignInForOrders ? "The server order function also enforces this." : "Customers can still create accounts for history.",
    },
    {
      icon: <EyeOff size={17} />,
      label: "Track My Bake",
      value: draft.trackMyBakePublic ? "Public" : "Private links",
      note: draft.trackMyBakePublic ? "Lookup is visible on the customer page." : "Email/text links can still open a specific order.",
    },
    {
      icon: <UserRound size={17} />,
      label: "Profiles",
      value: draft.customerProfileSavingEnabled ? "Saving on" : "Saving off",
      note: draft.customerProfileSavingEnabled ? "Allergies, preferences, and favorites can be saved." : "Signed-in history can remain without saved profile fields.",
    },
    {
      icon: <PackageCheck size={17} />,
      label: "Ready shelf",
      value: draft.readyShelfEnabled ? "Visible" : "Hidden",
      note: draft.readyShelfEnabled ? "Ready-now items can appear on the storefront." : "Ready-now shelf is hidden from customers.",
    },
    {
      icon: <KeyRound size={17} />,
      label: "Customer access",
      value: hasCloudWorkspace ? "Cloud protected" : "Device preview",
      note: hasCloudWorkspace ? "Recent sign-in and order signals are stored privately." : "Sign into cloud to record customer access signals.",
    },
  ];

  return (
    <section className="owner-access-dashboard">
      <div className="owner-security-grid">
        {accessCards.map((card) => (
          <article key={card.label}>
            {card.icon}
            <span><strong>{card.label}</strong><small>{card.value} · {card.note}</small></span>
          </article>
        ))}
      </div>
      <div className="customer-access-events">
        <div>
          <span><strong>Recent customer access</strong><small>{accessLoading ? "Checking latest signals…" : accessEvents.length ? `${accessEvents.length} latest customer signal${accessEvents.length === 1 ? "" : "s"}` : "No customer account/order signals yet."}</small></span>
          <button type="button" disabled={!hasCloudWorkspace || accessLoading} onClick={onRefresh}>Refresh</button>
        </div>
        {accessError ? <p className="customer-access-error">{customerAccessErrorMessage(accessError)}</p> : null}
        {accessEvents.length ? (
          <div className="customer-access-event-list">
            {accessEvents.map((event) => (
              <article className={`customer-access-event event-${event.event_type}`} key={event.id}>
                <span>
                  <strong>{ACCESS_EVENT_LABELS[event.event_type] || event.event_type}</strong>
                  <small>{event.reason || "Customer portal activity"}</small>
                </span>
                <span>
                  <strong>{event.request_code || event.contact_hint || "Customer"}</strong>
                  <small>{accessEventTime(event.created_at)}</small>
                </span>
              </article>
            ))}
          </div>
        ) : !accessError ? (
          <small className="customer-access-empty">Signals will appear after customers request magic links, save profiles, send orders, or get blocked by sign-in rules.</small>
        ) : null}
      </div>
    </section>
  );
}

function OwnerSetupWizard({
  draft,
  onClose,
  productTypes,
  update,
  updateProductType,
  updateWindow,
}) {
  const [step, setStep] = useState(0);
  const steps = [
    "Storefront",
    "Capacity",
    "Pickup",
    "Products",
    "Updates",
    "Finish",
  ];
  const shownTypes = productTypes.filter((type) => type.enabled !== false);

  function nextStep() {
    if (step >= steps.length - 1) {
      onClose();
      return;
    }
    setStep((current) => current + 1);
  }

  return (
    <Modal title="Owner setup wizard" onClose={onClose}>
      <div className="owner-setup-wizard">
        <nav className="owner-setup-steps" aria-label="Setup wizard steps">
          {steps.map((label, index) => (
            <button
              className={[
                index === step ? "active" : "",
                index < step ? "complete" : "",
              ].filter(Boolean).join(" ")}
              key={label}
              onClick={() => setStep(index)}
              type="button"
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>

        {step === 0 ? (
          <section className="owner-setup-panel">
            <span className="eyebrow-label dark">Customer page</span>
            <h3>Start with what customers see first.</h3>
            <ToggleRow checked={draft.onlineOrdering} label="Accept online requests" note="Turn this off when you need a quiet week." onChange={(value) => update("onlineOrdering", value)} />
            <ToggleRow checked={draft.readyShelfEnabled} label="Show ready shelf" note="Let customers grab prebaked items when available." onChange={(value) => update("readyShelfEnabled", value)} />
            <label>Customer intro<textarea value={draft.orderingIntro} onChange={(event) => update("orderingIntro", event.target.value)} /></label>
            <label>Pickup location<input value={draft.pickupLocation} onChange={(event) => update("pickupLocation", event.target.value)} /></label>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="owner-setup-panel">
            <span className="eyebrow-label dark">Order protection</span>
            <h3>Protect your future self from too many bakes.</h3>
            <div className="settings-number-grid">
              <label>Daily bake slots<input type="number" min="1" max="24" value={draft.dailyCapacity} onChange={(event) => update("dailyCapacity", Number(event.target.value))} /></label>
              <label>Order window<input type="number" min="1" max="90" value={draft.orderWindowDays} onChange={(event) => update("orderWindowDays", Number(event.target.value))} /></label>
              <label>Minimum lead time<input type="number" min="0" max="14" value={draft.leadTimeDays} onChange={(event) => update("leadTimeDays", Number(event.target.value))} /></label>
              <label>Pickup intervals<select value={draft.pickupIntervalMinutes} onChange={(event) => update("pickupIntervalMinutes", Number(event.target.value))}><option value="15">Every 15 minutes</option><option value="30">Every 30 minutes</option><option value="60">Every hour</option></select></label>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="owner-setup-panel">
            <span className="eyebrow-label dark">Pickup hours</span>
            <h3>Only show pickup windows you really want.</h3>
            <div className="settings-hours-grid">
              <TimeWindow label="Weekday morning" value={draft.weekdayWindows[0]} onChange={(value) => updateWindow("weekdayWindows", 0, value)} />
              <TimeWindow label="Weekday evening" value={draft.weekdayWindows[1]} onChange={(value) => updateWindow("weekdayWindows", 1, value)} />
              <TimeWindow label="Weekend" value={draft.weekendWindows[0]} onChange={(value) => updateWindow("weekendWindows", 0, value)} />
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="owner-setup-panel">
            <span className="eyebrow-label dark">Menu categories</span>
            <h3>Pick the product tabs customers can browse.</h3>
            <div className="owner-setup-product-grid">
              {productTypes.map((type) => (
                <label className={type.enabled !== false ? "selected" : ""} key={type.value}>
                  <input type="checkbox" checked={type.enabled !== false} onChange={(event) => updateProductType(type.value, { enabled: event.target.checked })} />
                  <span>{type.icon}</span>
                  <strong>{type.label}</strong>
                </label>
              ))}
            </div>
            <p>{shownTypes.length} category tab{shownTypes.length === 1 ? "" : "s"} will show on the customer page.</p>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="owner-setup-panel">
            <span className="eyebrow-label dark">Customer updates</span>
            <h3>Choose how much communication the app should support.</h3>
            <ToggleRow checked={draft.emailNotifications} label="Email updates" note="Let customers opt into email status messages." onChange={(value) => update("emailNotifications", value)} />
            <ToggleRow checked={draft.automaticEmailNotifications} label="Automatic email" note="Send enabled updates after owner actions when Resend is connected." onChange={(value) => update("automaticEmailNotifications", value)} />
            <ToggleRow checked={draft.smsNotifications} label="Text message links" note="Show text-message actions for customers who opt in." onChange={(value) => update("smsNotifications", value)} />
            <ToggleRow checked={draft.announcementEnabled} label="Announcement banner" note="Show a baker note at the top of the customer page." onChange={(value) => update("announcementEnabled", value)} />
          </section>
        ) : null}

        {step === 5 ? (
          <section className="owner-setup-panel finish">
            <CheckCircle2 size={28} />
            <h3>Setup pass is ready.</h3>
            <p>Close the wizard, review any deeper cards you want, then tap “Save bakery settings.” If your menu is already published, republish recipes so customers see the latest product tabs, prices, and notes.</p>
            <ul>
              <li>{draft.onlineOrdering ? "Online requests are on." : "Online requests are paused."}</li>
              <li>{draft.dailyCapacity} bake slots per pickup day.</li>
              <li>{shownTypes.length} customer product categories visible.</li>
              <li>{draft.emailNotifications || draft.smsNotifications ? "Customer update options are enabled." : "Customer update options are off."}</li>
            </ul>
          </section>
        ) : null}

        <footer className="owner-setup-footer">
          <button type="button" className="secondary-button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>
          <button type="button" className="primary-button" onClick={nextStep}>{step === steps.length - 1 ? "Finish wizard" : "Next"}</button>
        </footer>
      </div>
    </Modal>
  );
}

const notificationEvents = [
  ["accepted", "Order accepted", "Confirmation after you approve a customer request."],
  ["bakeProgress", "Bake progress", "Starter, mix, proof, oven, and cooling updates."],
  ["comments", "Baker comments", "Pickup notes, payment reminders, or other personal updates."],
  ["ready", "Ready for pickup", "The order is packed and ready at the pickup location."],
  ["rejected", "Order rejected", "A polite decline with your saved baker comment."],
  ["completed", "Order completed", "Final confirmation after you mark the bake complete."],
];

export default function SettingsPage({
  bakerySettings,
  cloudAccount,
  onSaveBakerySettings,
  onSaveRecipe,
  recipes,
  setActive,
}) {
  const [draft, setDraft] = useState(() => normalizedBakerySettings(bakerySettings));
  const [testContact, setTestContact] = useState({
    email: cloudAccount.session?.user?.email || "",
    phone: "",
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emailProvider, setEmailProvider] = useState(null);
  const [emailDeliveries, setEmailDeliveries] = useState([]);
  const [accessEvents, setAccessEvents] = useState([]);
  const [accessEventsLoading, setAccessEventsLoading] = useState(false);
  const [accessEventsError, setAccessEventsError] = useState("");
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);

  useEffect(() => {
    setDraft(normalizedBakerySettings(bakerySettings));
  }, [bakerySettings]);

  useEffect(() => {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId) {
      setEmailProvider(null);
      setEmailDeliveries([]);
      setAccessEvents([]);
      setAccessEventsError("");
      setAccessEventsLoading(false);
      return;
    }
    let active = true;
    setAccessEventsLoading(true);
    setAccessEventsError("");
    Promise.all([
      getAutomaticEmailStatus(bakeryId),
      listEmailNotificationDeliveries(bakeryId, 8),
      listCustomerAccessEvents(bakeryId, 12).catch((eventError) => {
        if (active) setAccessEventsError(eventError.message);
        return [];
      }),
    ]).then(([status, deliveries, events]) => {
      if (!active) return;
      setEmailProvider(status);
      setEmailDeliveries(deliveries);
      setAccessEvents(events);
    }).catch((nextError) => {
      if (active) setEmailProvider({ configured: false, error: nextError.message });
    }).finally(() => {
      if (active) setAccessEventsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [cloudAccount.workspace?.bakeryId]);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateAllowGuestCheckout(value) {
    setDraft((current) => ({
      ...current,
      allowGuestCheckout: value,
      requireSignInForOrders: value ? false : current.requireSignInForOrders,
    }));
  }

  function updateRequireSignInForOrders(value) {
    setDraft((current) => ({
      ...current,
      requireSignInForOrders: value,
      allowGuestCheckout: value ? false : current.allowGuestCheckout,
    }));
  }

  function updateWindow(group, index, value) {
    setDraft((current) => ({
      ...current,
      [group]: current[group].map((window, windowIndex) => (
        windowIndex === index ? value : window
      )),
    }));
  }

  function updateProductTypes(updater) {
    setDraft((current) => ({
      ...current,
      productTypes: updater(normalizeProductTypeSettings(current)),
    }));
  }

  function updateProductType(value, changes) {
    updateProductTypes((types) => types.map((type) => (
      type.value === value ? { ...type, ...changes } : type
    )));
  }

  function moveProductType(value, direction) {
    updateProductTypes((types) => {
      const next = [...types];
      const index = next.findIndex((type) => type.value === value);
      const swapIndex = index + direction;
      if (index < 0 || swapIndex < 0 || swapIndex >= next.length) return next;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next.map((type, order) => ({ ...type, order }));
    });
  }

  function addProductPackage(typeValue) {
    updateProductTypes((types) => types.map((type) => {
      if (type.value !== typeValue) return type;
      return {
        ...type,
        packagePresets: [
          ...type.packagePresets,
          {
            id: `${typeValue}-package-${Date.now()}`,
            label: type.unitName === "loaf" ? "Loaf" : `Each ${type.unitName || "item"}`,
            units: 1,
            price: 0,
            capacityUnits: 1,
          },
        ],
      };
    }));
  }

  function updateProductPackage(typeValue, packageId, changes) {
    updateProductTypes((types) => types.map((type) => (
      type.value === typeValue
        ? {
          ...type,
          packagePresets: type.packagePresets.map((preset) => (
            preset.id === packageId ? { ...preset, ...changes } : preset
          )),
        }
        : type
    )));
  }

  function removeProductPackage(typeValue, packageId) {
    updateProductTypes((types) => types.map((type) => (
      type.value === typeValue && type.packagePresets.length > 1
        ? { ...type, packagePresets: type.packagePresets.filter((preset) => preset.id !== packageId) }
        : type
    )));
  }

  function addCustomerOption(typeValue) {
    updateProductTypes((types) => types.map((type) => {
      if (type.value !== typeValue) return type;
      return {
        ...type,
        customerOptions: [
          ...(type.customerOptions || []),
          {
            id: `${typeValue}-choice-${Date.now()}`,
            label: "Custom choice",
            type: "text",
            enabled: true,
            required: false,
            help: "",
            choices: ["Yes", "No"],
          },
        ],
      };
    }));
  }

  function updateCustomerOption(typeValue, optionId, changes) {
    updateProductTypes((types) => types.map((type) => (
      type.value === typeValue
        ? {
          ...type,
          customerOptions: (type.customerOptions || []).map((option) => (
            option.id === optionId ? { ...option, ...changes } : option
          )),
        }
        : type
    )));
  }

  function removeCustomerOption(typeValue, optionId) {
    updateProductTypes((types) => types.map((type) => (
      type.value === typeValue
        ? { ...type, customerOptions: (type.customerOptions || []).filter((option) => option.id !== optionId) }
        : type
    )));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setBusy("save");
    setMessage("");
    setError("");
    try {
      const guestOnlyDraft = normalizedBakerySettings({
        ...draft,
        allowGuestCheckout: true,
        requireSignInForOrders: false,
        customerReorderEnabled: false,
        customerProfileSavingEnabled: false,
      });
      await onSaveBakerySettings(guestOnlyDraft);
      setDraft(guestOnlyDraft);
      setMessage(cloudAccount.workspace?.bakeryId
        ? "Settings saved to this device and your bakery cloud."
        : "Settings saved on this device.");
    } catch (nextError) {
      setEmailProvider({ configured: false, error: nextError.message });
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function publishMenu() {
    if (!cloudAccount.workspace?.bakeryId) return;
    setBusy("publish");
    setMessage("");
    setError("");
    try {
      const count = await publishRecipeCatalog(cloudAccount.workspace.bakeryId, recipes);
      setMessage(`${count} recipe${count === 1 ? "" : "s"} republished with current package pricing.`);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function refreshAutomaticEmail() {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId) return;
    setBusy("email-status");
    setError("");
    try {
      const [status, deliveries] = await Promise.all([
        getAutomaticEmailStatus(bakeryId),
        listEmailNotificationDeliveries(bakeryId, 8),
      ]);
      setEmailProvider(status);
      setEmailDeliveries(deliveries);
      setMessage(status.configured
        ? "Automatic email is connected."
        : "Automatic email still needs a Resend API key and verified sender.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function refreshCustomerAccessEvents() {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId) return;
    setAccessEventsLoading(true);
    setAccessEventsError("");
    try {
      setAccessEvents(await listCustomerAccessEvents(bakeryId, 12));
    } catch (nextError) {
      setAccessEventsError(nextError.message);
    } finally {
      setAccessEventsLoading(false);
    }
  }

  async function sendEmailTest() {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId || !testContact.email.trim()) return;
    setBusy("email-test");
    setMessage("");
    setError("");
    try {
      await sendAutomaticEmailTest(bakeryId, testContact.email);
      setMessage(`Automatic test email sent to ${testContact.email.trim()}.`);
      setEmailDeliveries(await listEmailNotificationDeliveries(bakeryId, 8));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  const testMessage = encodeURIComponent("Loafers test: customer status notifications are ready on this device.");
  const testSmsHref = testContact.phone.trim()
    ? `sms:${testContact.phone.replace(/[^\d+]/g, "")}?&body=${testMessage}`
    : undefined;
  const hasCloudWorkspace = Boolean(cloudAccount.workspace?.bakeryId);
  const emailStatusTitle = !hasCloudWorkspace
    ? "Sign into bakery cloud first"
    : emailProvider?.configured
      ? "Automatic email connected"
      : emailProvider?.error
        ? "Email service check failed"
        : "Resend connection required";
  const emailStatusNote = !hasCloudWorkspace
    ? "Automatic email needs your bakery cloud workspace. Open storage, sign in, then check Resend again."
    : emailProvider?.configured
      ? "Loafers can deliver opted-in customer emails without opening your mail app."
      : emailProvider?.error
        ? emailProvider.error
        : emailProvider && (!emailProvider.hasApiKey || !emailProvider.hasFromEmail)
          ? `Missing ${[
            !emailProvider.hasApiKey ? "Resend API key" : "",
            !emailProvider.hasFromEmail ? "verified sender email" : "",
          ].filter(Boolean).join(" and ")} in Supabase secrets.`
          : "The app is ready. Add the Resend API key and verified sender in Supabase to start delivery.";
  const productTypes = normalizeProductTypeSettings(draft);
  const previewUrl = (() => {
    try {
      const url = new URL(publicOrderUrl(cloudAccount.workspace?.bakery?.slug || "loafers"));
      url.searchParams.set("preview", "owner");
      return url.toString();
    } catch {
      return "";
    }
  })();

  return (
    <main className="page settings-page">
      <PageHeading
        title="Bakery settings"
        subtitle="Control ordering, capacity, pickup, customer features, and status messages."
        action={<button className="round-action" type="button" onClick={() => setActive("business")} aria-label="Back to business"><ArrowLeft size={20} /></button>}
      />

      <form onSubmit={saveSettings}>
        <section className="settings-hero-card">
          <span><Settings2 size={23} /></span>
          <div><strong>Your bakery, your rules</strong><p>Customer pages and server-side order checks use these same settings.</p></div>
          <span className={cloudAccount.workspace?.bakeryId ? "settings-sync-pill online" : "settings-sync-pill"}>
            {cloudAccount.workspace?.bakeryId ? "Cloud synced" : "Device only"}
          </span>
        </section>

        <SettingsCommandCenter
          draft={draft}
          emailStatusTitle={emailStatusTitle}
          hasCloudWorkspace={hasCloudWorkspace}
          onOpenWizard={() => setSetupWizardOpen(true)}
          productTypes={productTypes}
          recipes={recipes}
        />

        <CollapsibleSettingsCard
          eyebrow="Customer storefront"
          icon={<Store size={20} />}
          summary={`${draft.onlineOrdering ? "Ordering on" : "Ordering paused"} · announcement ${draft.announcementEnabled ? "on" : "off"}`}
          title="Storefront and checkout"
        >
          <div className="settings-toggle-list">
            <ToggleRow checked={draft.onlineOrdering} label="Online ordering" note="Pause new customer requests without removing the order lookup." onChange={(value) => update("onlineOrdering", value)} />
            <ToggleRow checked={draft.announcementEnabled} label="Owner announcement" note="Show a short baker note at the top of the customer order page." onChange={(value) => update("announcementEnabled", value)} />
          </div>
          <label>Customer page introduction<textarea value={draft.orderingIntro} onChange={(event) => update("orderingIntro", event.target.value)} /></label>
          <div className="settings-announcement-fields">
            <label>Announcement title<input disabled={!draft.announcementEnabled} value={draft.announcementTitle} onChange={(event) => update("announcementTitle", event.target.value)} placeholder="From the baker" /></label>
            <label>Announcement message<textarea disabled={!draft.announcementEnabled} value={draft.announcementText} onChange={(event) => update("announcementText", event.target.value)} placeholder="Example: Bagels are available this Saturday, and pickup will be at Three Bears." /></label>
            <small>Leave the message blank to hide the announcement without changing the rest of your storefront.</small>
          </div>
          <label>Pickup location<input value={draft.pickupLocation} onChange={(event) => update("pickupLocation", event.target.value)} /></label>
        </CollapsibleSettingsCard>

        <CollapsibleSettingsCard
          eyebrow="Customer privacy"
          icon={<EyeOff size={20} />}
          summary={`Guest checkout only · Track My Bake ${draft.trackMyBakePublic ? "public" : "private"}`}
          title="Customer visibility controls"
        >
          <div className="settings-toggle-list">
            <ToggleRow checked={draft.trackMyBakePublic} label="Show Track My Bake publicly" note="Show the public lookup box and Track an order link on the customer page. Direct email tracking links still work." onChange={(value) => update("trackMyBakePublic", value)} />
            <ToggleRow checked={draft.reviewsVisible} label="Show reviews publicly" note="Display verified customer reviews on the storefront." onChange={(value) => update("reviewsVisible", value)} />
            <ToggleRow checked={draft.readyShelfEnabled} label="Show ready shelf publicly" note="Show prebaked ready-now inventory on the customer order page." onChange={(value) => update("readyShelfEnabled", value)} />
            <ToggleRow checked={draft.feedbackEnabled} label="Allow lookup feedback" note="Let verified customers submit reviews or suggestions after finding an order." onChange={(value) => update("feedbackEnabled", value)} />
          </div>
          <aside className="settings-provider-note">
            <EyeOff size={18} />
            <span><strong>Guest checkout only</strong><small>Customer accounts and sign-in links are turned off. Customers can still send requests, track orders, and leave feedback when enabled.</small></span>
          </aside>
        </CollapsibleSettingsCard>

        <CollapsibleSettingsCard
          className="product-types-settings"
          eyebrow="Customer menu"
          icon={<PackageCheck size={20} />}
          summary={`${productTypes.filter((type) => type.enabled !== false).length} category tab${productTypes.filter((type) => type.enabled !== false).length === 1 ? "" : "s"} shown · package presets and customer choices`}
          title="Product types"
        >
          <p className="product-type-settings-note">
            Choose which category tabs customers see, set the default unit and package prices for new recipes, and keep safety notes visible for sauces, vinegars, oils, and other goods.
          </p>
          <div className="product-type-list">
            {productTypes.map((type, index) => (
              <ProductTypeSettingsCard
                key={type.value}
                index={index}
                onAddCustomerOption={addCustomerOption}
                onAddPackage={addProductPackage}
                onMove={moveProductType}
                onRemoveCustomerOption={removeCustomerOption}
                onRemovePackage={removeProductPackage}
                onUpdate={updateProductType}
                onUpdateCustomerOption={updateCustomerOption}
                onUpdatePackage={updateProductPackage}
                total={productTypes.length}
                type={type}
              />
            ))}
          </div>
        </CollapsibleSettingsCard>

        <CollapsibleSettingsCard
          className="product-availability-settings"
          eyebrow="Weekly menu"
          icon={<Tag size={20} />}
          summary={`${recipes.length} product${recipes.length === 1 ? "" : "s"} · sold out, preorder, hidden, ready now`}
          title="Product availability"
        >
          <p className="product-type-settings-note">
            One clean board for this week’s storefront. Hidden items disappear from the customer menu; sold-out and unavailable items can still show details without accepting orders.
          </p>
          <div className="product-availability-list">
            {recipes.map((recipe) => (
              <ProductAvailabilityCard
                key={recipe.id}
                onSaveRecipe={onSaveRecipe}
                productTypes={productTypes}
                recipe={recipe}
              />
            ))}
          </div>
          <aside className="settings-provider-note">
            <Send size={18} />
            <span><strong>Publish after status changes</strong><small>Saving updates your owner app immediately. Use Republish recipes below when you want customers to see the new weekly menu.</small></span>
          </aside>
        </CollapsibleSettingsCard>

        <CollapsibleSettingsCard
          eyebrow="Order protection"
          icon={<ShoppingBag size={20} />}
          summary={`${draft.dailyCapacity} slots/day · ${draft.orderWindowDays}-day window`}
          title="Capacity and lead time"
        >
          <div className="settings-number-grid">
            <label>Daily bake slots<input type="number" min="1" max="24" value={draft.dailyCapacity} onChange={(event) => update("dailyCapacity", Number(event.target.value))} /><small>Maximum future-bake capacity per pickup day.</small></label>
            <label>Order window<input type="number" min="1" max="90" value={draft.orderWindowDays} onChange={(event) => update("orderWindowDays", Number(event.target.value))} /><small>How many days ahead customers may order.</small></label>
            <label>Minimum lead time<input type="number" min="0" max="14" value={draft.leadTimeDays} onChange={(event) => update("leadTimeDays", Number(event.target.value))} /><small>Days required before pickup.</small></label>
            <label>Pickup intervals<select value={draft.pickupIntervalMinutes} onChange={(event) => update("pickupIntervalMinutes", Number(event.target.value))}><option value="15">Every 15 minutes</option><option value="30">Every 30 minutes</option><option value="60">Every hour</option></select><small>Spacing between customer pickup choices.</small></label>
          </div>
        </CollapsibleSettingsCard>

        <CollapsibleSettingsCard
          eyebrow="Pickup schedule"
          icon={<Clock3 size={20} />}
          summary="Weekdays and weekend pickup windows"
          title="Available hours"
        >
          <div className="settings-hours-grid">
            <TimeWindow label="Weekday morning" value={draft.weekdayWindows[0]} onChange={(value) => updateWindow("weekdayWindows", 0, value)} />
            <TimeWindow label="Weekday evening" value={draft.weekdayWindows[1]} onChange={(value) => updateWindow("weekdayWindows", 1, value)} />
            <TimeWindow label="Weekend" value={draft.weekendWindows[0]} onChange={(value) => updateWindow("weekendWindows", 0, value)} />
          </div>
        </CollapsibleSettingsCard>

        <CollapsibleSettingsCard
          eyebrow="Status messages"
          icon={<BellRing size={20} />}
          summary={`${draft.emailNotifications ? "Email on" : "Email off"} · ${draft.smsNotifications ? "texts on" : "texts off"}`}
          title="Customer notifications"
        >
          <div className="settings-toggle-list">
            <ToggleRow checked={draft.emailNotifications} label="Email updates" note="Let customers opt into email and enable baker email actions." onChange={(value) => update("emailNotifications", value)} />
            <ToggleRow checked={draft.automaticEmailNotifications} label="Send email automatically" note="Send enabled order updates immediately after your baker action." onChange={(value) => update("automaticEmailNotifications", value)} />
            <ToggleRow checked={draft.smsNotifications} label="Text updates" note="Let customers opt into text messages and enable baker text actions." onChange={(value) => update("smsNotifications", value)} />
          </div>
          <div className={`automatic-email-status ${emailProvider?.configured ? "connected" : ""}`}>
            <Mail size={19} />
            <span>
              <strong>{emailStatusTitle}</strong>
              <small>{emailStatusNote}</small>
            </span>
            <button type="button" onClick={refreshAutomaticEmail} disabled={!cloudAccount.workspace?.bakeryId || busy === "email-status"}><RefreshCw className={busy === "email-status" ? "spin" : ""} size={15} /> Check</button>
          </div>
          <label>Reply-to email<input type="email" value={draft.emailReplyTo} onChange={(event) => update("emailReplyTo", event.target.value)} placeholder="Your bakery email customers may reply to" /></label>
          <div className="settings-event-list">
            <strong>Message events</strong>
            <p>Choose the status templates available when you contact a customer.</p>
            {notificationEvents.map(([id, label, note]) => (
              <ToggleRow
                key={id}
                checked={draft.notificationEvents[id]}
                label={label}
                note={note}
                onChange={(value) => update("notificationEvents", { ...draft.notificationEvents, [id]: value })}
              />
            ))}
          </div>
          <aside className="settings-provider-note">
            <Send size={18} />
            <span><strong>Automatic email with manual fallback</strong><small>Connected email sends immediately and records the result. The Email Status button on each order remains available if you ever want to compose a message yourself.</small></span>
          </aside>
          <div className="settings-test-grid">
            <label>Test email<input type="email" value={testContact.email} onChange={(event) => setTestContact({ ...testContact, email: event.target.value })} placeholder="you@example.com" /></label>
            <label>Test phone<input value={testContact.phone} onChange={(event) => setTestContact({ ...testContact, phone: event.target.value })} placeholder="9075550101" /></label>
            <button className="settings-test-button" type="button" disabled={!draft.emailNotifications || !emailProvider?.configured || !testContact.email.trim() || busy === "email-test"} onClick={sendEmailTest}>
              <Mail size={16} /> {busy === "email-test" ? "Sending…" : "Send automatic test"}
            </button>
            <a className={!draft.smsNotifications || !testSmsHref ? "disabled" : ""} href={draft.smsNotifications ? testSmsHref : undefined}><MessageSquareText size={16} /> Test text</a>
          </div>
          <details className="email-delivery-history">
            <summary>
              <span><strong>Recent email delivery</strong><small>{emailDeliveries.length ? `${emailDeliveries.length} latest automatic and test message${emailDeliveries.length === 1 ? "" : "s"}` : "No email attempts recorded yet."}</small></span>
              <ChevronDown className="settings-accordion-chevron" size={17} />
            </summary>
            <div className="email-delivery-list">
              {emailDeliveries.map((delivery) => (
                <div className={`email-delivery-row status-${delivery.status}`} key={delivery.id}>
                  <span><strong>{delivery.event_type === "bakeProgress" ? "Bake progress" : delivery.event_type}</strong><small>{delivery.recipient}</small></span>
                  <span>
                    <strong>{delivery.status}</strong>
                    <small>{delivery.error_message || new Date(delivery.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small>
                  </span>
                </div>
              ))}
            </div>
          </details>
        </CollapsibleSettingsCard>

        <section className="settings-card settings-publish-card">
          <div className="section-title-line"><div><span className="eyebrow-label dark">Customer menu</span><h2>Package pricing</h2></div><PackageCheck size={20} /></div>
          <p>Republish after changing singles, half-dozens, dozens, loaves, or custom package prices.</p>
          <button className="secondary-button" type="button" disabled={!cloudAccount.workspace?.bakeryId || Boolean(busy)} onClick={publishMenu}>
            <Send size={16} /> {busy === "publish" ? "Publishing…" : `Republish ${recipes.length} recipes`}
          </button>
          {previewUrl ? <a className="secondary-button settings-preview-link" href={previewUrl} target="_blank" rel="noreferrer"><Store size={16} /> Owner preview</a> : null}
        </section>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <div className="settings-success"><CheckCircle2 size={17} /> {message}</div> : null}
        <button className="primary-button settings-save-button" type="submit" disabled={Boolean(busy)}>
          <Save size={17} /> {busy === "save" ? "Saving…" : "Save bakery settings"}
        </button>
      </form>

      {setupWizardOpen ? (
        <OwnerSetupWizard
          draft={draft}
          onClose={() => setSetupWizardOpen(false)}
          productTypes={productTypes}
          update={update}
          updateProductType={updateProductType}
          updateWindow={updateWindow}
        />
      ) : null}
    </main>
  );
}
