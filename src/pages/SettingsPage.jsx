import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Mail,
  MessageSquareText,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  ShoppingBag,
  Store,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import {
  getAutomaticEmailStatus,
  listEmailNotificationDeliveries,
  publishRecipeCatalog,
  sendAutomaticEmailTest,
} from "../lib/cloud";
import { normalizedBakerySettings } from "../lib/bakerySettings";
import { normalizeProductTypeSettings } from "../lib/productTypes";

// product-type-settings-v1
// settings-collapse-v1
// customer-options-v1

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

  useEffect(() => {
    setDraft(normalizedBakerySettings(bakerySettings));
  }, [bakerySettings]);

  useEffect(() => {
    const bakeryId = cloudAccount.workspace?.bakeryId;
    if (!bakeryId) {
      setEmailProvider(null);
      setEmailDeliveries([]);
      return;
    }
    let active = true;
    Promise.all([
      getAutomaticEmailStatus(bakeryId),
      listEmailNotificationDeliveries(bakeryId, 8),
    ]).then(([status, deliveries]) => {
      if (!active) return;
      setEmailProvider(status);
      setEmailDeliveries(deliveries);
    }).catch((nextError) => {
      if (active) setEmailProvider({ configured: false, error: nextError.message });
    });
    return () => {
      active = false;
    };
  }, [cloudAccount.workspace?.bakeryId]);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
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
      await onSaveBakerySettings(normalizedBakerySettings(draft));
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

  return (
    <main className="page settings-page">
      <PageHeading
        title="Bakery settings"
        subtitle="Control ordering, capacity, pickup, customer features, and status messages."
        action={<button className="round-action" type="button" onClick={() => setActive("more")} aria-label="Back to trends"><ArrowLeft size={20} /></button>}
      />

      <form onSubmit={saveSettings}>
        <section className="settings-hero-card">
          <span><Settings2 size={23} /></span>
          <div><strong>Your bakery, your rules</strong><p>Customer pages and server-side order checks use these same settings.</p></div>
          <span className={cloudAccount.workspace?.bakeryId ? "settings-sync-pill online" : "settings-sync-pill"}>
            {cloudAccount.workspace?.bakeryId ? "Cloud synced" : "Device only"}
          </span>
        </section>

        <section className="settings-card">
          <div className="section-title-line"><div><span className="eyebrow-label dark">Customer storefront</span><h2>Features</h2></div><Store size={20} /></div>
          <div className="settings-toggle-list">
            <ToggleRow checked={draft.onlineOrdering} label="Online ordering" note="Pause new customer requests without removing the order lookup." onChange={(value) => update("onlineOrdering", value)} />
            <ToggleRow checked={draft.readyShelfEnabled} label="Ready-to-go shelf" note="Show prebaked inventory on the customer order page." onChange={(value) => update("readyShelfEnabled", value)} />
            <ToggleRow checked={draft.reviewsVisible} label="Public reviews" note="Display verified customer reviews on the storefront." onChange={(value) => update("reviewsVisible", value)} />
            <ToggleRow checked={draft.feedbackEnabled} label="Suggestions and reviews" note="Allow verified customers to submit feedback from order lookup." onChange={(value) => update("feedbackEnabled", value)} />
            <ToggleRow checked={draft.announcementEnabled} label="Owner announcement" note="Show a short baker note at the top of the customer order page." onChange={(value) => update("announcementEnabled", value)} />
          </div>
          <label>Customer page introduction<textarea value={draft.orderingIntro} onChange={(event) => update("orderingIntro", event.target.value)} /></label>
          <div className="settings-announcement-fields">
            <label>Announcement title<input disabled={!draft.announcementEnabled} value={draft.announcementTitle} onChange={(event) => update("announcementTitle", event.target.value)} placeholder="From the baker" /></label>
            <label>Announcement message<textarea disabled={!draft.announcementEnabled} value={draft.announcementText} onChange={(event) => update("announcementText", event.target.value)} placeholder="Example: Bagels are available this Saturday, and pickup will be at Three Bears." /></label>
            <small>Leave the message blank to hide the announcement without changing the rest of your storefront.</small>
          </div>
          <label>Pickup location<input value={draft.pickupLocation} onChange={(event) => update("pickupLocation", event.target.value)} /></label>
        </section>

        <section className="settings-card product-types-settings">
          <div className="section-title-line">
            <div>
              <span className="eyebrow-label dark">Customer menu</span>
              <h2>Product types</h2>
            </div>
            <PackageCheck size={20} />
          </div>
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
        </section>

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
        </section>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <div className="settings-success"><CheckCircle2 size={17} /> {message}</div> : null}
        <button className="primary-button settings-save-button" type="submit" disabled={Boolean(busy)}>
          <Save size={17} /> {busy === "save" ? "Saving…" : "Save bakery settings"}
        </button>
      </form>
    </main>
  );
}
