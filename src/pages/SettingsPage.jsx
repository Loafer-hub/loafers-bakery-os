import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquareText,
  PackageCheck,
  Save,
  Send,
  Settings2,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { publishRecipeCatalog } from "../lib/cloud";
import { normalizedBakerySettings } from "../lib/bakerySettings";

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

const notificationEvents = [
  ["accepted", "Order accepted", "Confirmation after you approve a customer request."],
  ["bakeProgress", "Bake progress", "Starter, mix, proof, oven, and cooling updates."],
  ["comments", "Baker comments", "Pickup notes, payment reminders, or other personal updates."],
  ["ready", "Ready for pickup", "The order is packed and ready at the pickup location."],
  ["rejected", "Order rejected", "A polite decline with your saved baker comment."],
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

  useEffect(() => {
    setDraft(normalizedBakerySettings(bakerySettings));
  }, [bakerySettings]);

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

  const testMessage = encodeURIComponent("Loafers test: customer status notifications are ready on this device.");
  const testEmailHref = testContact.email.trim()
    ? `mailto:${encodeURIComponent(testContact.email.trim())}?subject=${encodeURIComponent("Loafers notification test")}&body=${testMessage}`
    : undefined;
  const testSmsHref = testContact.phone.trim()
    ? `sms:${testContact.phone.replace(/[^\d+]/g, "")}?&body=${testMessage}`
    : undefined;

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
          </div>
          <label>Customer page introduction<textarea value={draft.orderingIntro} onChange={(event) => update("orderingIntro", event.target.value)} /></label>
          <label>Pickup location<input value={draft.pickupLocation} onChange={(event) => update("pickupLocation", event.target.value)} /></label>
        </section>

        <section className="settings-card">
          <div className="section-title-line"><div><span className="eyebrow-label dark">Order protection</span><h2>Capacity and lead time</h2></div><ShoppingBag size={20} /></div>
          <div className="settings-number-grid">
            <label>Daily bake slots<input type="number" min="1" max="24" value={draft.dailyCapacity} onChange={(event) => update("dailyCapacity", Number(event.target.value))} /><small>Maximum future-bake capacity per pickup day.</small></label>
            <label>Order window<input type="number" min="1" max="90" value={draft.orderWindowDays} onChange={(event) => update("orderWindowDays", Number(event.target.value))} /><small>How many days ahead customers may order.</small></label>
            <label>Minimum lead time<input type="number" min="0" max="14" value={draft.leadTimeDays} onChange={(event) => update("leadTimeDays", Number(event.target.value))} /><small>Days required before pickup.</small></label>
            <label>Pickup intervals<select value={draft.pickupIntervalMinutes} onChange={(event) => update("pickupIntervalMinutes", Number(event.target.value))}><option value="15">Every 15 minutes</option><option value="30">Every 30 minutes</option><option value="60">Every hour</option></select><small>Spacing between customer pickup choices.</small></label>
          </div>
        </section>

        <section className="settings-card">
          <div className="section-title-line"><div><span className="eyebrow-label dark">Pickup schedule</span><h2>Available hours</h2></div><Clock3 size={20} /></div>
          <div className="settings-hours-grid">
            <TimeWindow label="Weekday morning" value={draft.weekdayWindows[0]} onChange={(value) => updateWindow("weekdayWindows", 0, value)} />
            <TimeWindow label="Weekday evening" value={draft.weekdayWindows[1]} onChange={(value) => updateWindow("weekdayWindows", 1, value)} />
            <TimeWindow label="Weekend" value={draft.weekendWindows[0]} onChange={(value) => updateWindow("weekendWindows", 0, value)} />
          </div>
        </section>

        <section className="settings-card">
          <div className="section-title-line"><div><span className="eyebrow-label dark">Status messages</span><h2>Customer notifications</h2></div><BellRing size={20} /></div>
          <div className="settings-toggle-list">
            <ToggleRow checked={draft.emailNotifications} label="Email updates" note="Let customers opt into email and enable baker email actions." onChange={(value) => update("emailNotifications", value)} />
            <ToggleRow checked={draft.smsNotifications} label="Text updates" note="Let customers opt into text messages and enable baker text actions." onChange={(value) => update("smsNotifications", value)} />
          </div>
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
            <span><strong>Safe send mode</strong><small>Loafers opens a filled-in email or text on your phone. You review it and tap Send. Fully automatic delivery needs a future email/SMS provider connection.</small></span>
          </aside>
          <div className="settings-test-grid">
            <label>Test email<input type="email" value={testContact.email} onChange={(event) => setTestContact({ ...testContact, email: event.target.value })} placeholder="you@example.com" /></label>
            <label>Test phone<input value={testContact.phone} onChange={(event) => setTestContact({ ...testContact, phone: event.target.value })} placeholder="9075550101" /></label>
            <a className={!draft.emailNotifications || !testEmailHref ? "disabled" : ""} href={draft.emailNotifications ? testEmailHref : undefined}><Mail size={16} /> Test email</a>
            <a className={!draft.smsNotifications || !testSmsHref ? "disabled" : ""} href={draft.smsNotifications ? testSmsHref : undefined}><MessageSquareText size={16} /> Test text</a>
          </div>
        </section>

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
