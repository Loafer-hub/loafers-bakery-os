import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  PackageSearch,
  Printer,
  Settings2,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildProductionPlanner,
  DEFAULT_PRODUCTION_AUTOMATION,
} from "../lib/productionPlanner";

function dateTimeLabel(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function requirementLabel(row) {
  if (row.packaging) return `${row.needed} ${row.item?.unit || "bags"}`;
  if (row.matched) return `${row.needed.toFixed(row.needed < 10 ? 2 : 1)} ${row.item.unit}`;
  return `${Math.round(row.grams || 0)} g`;
}

function ToggleRow({ checked, disabled = false, label, note, onChange, warning = false }) {
  return (
    <label className={`automation-toggle-row ${warning ? "warning" : ""} ${disabled ? "disabled" : ""}`}>
      <span><strong>{label}</strong><small>{note}</small></span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

export function ProductionPlanner({
  automation,
  inventory,
  orders,
  recipes,
  starters,
  starterLogs,
  onChangeAutomation,
  onSyncProductionPlans,
}) {
  const settings = { ...DEFAULT_PRODUCTION_AUTOMATION, ...automation };
  const [showSettings, setShowSettings] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const syncedSignature = useRef("");
  const planner = useMemo(() => buildProductionPlanner({
    orders,
    recipes,
    inventory,
    starters,
    starterLogs,
    settings,
  }), [inventory, orders, recipes, settings, starterLogs, starters]);
  const calendarSignature = JSON.stringify(planner.calendarPlans.map((plan) => [
    plan.id,
    plan.bakeEnd,
    plan.loaves,
  ]));

  useEffect(() => {
    if (!settings.enabled || !settings.autoCreatePlans) return;
    if (syncedSignature.current === calendarSignature) return;
    syncedSignature.current = calendarSignature;
    onSyncProductionPlans(planner.calendarPlans);
    setSyncMessage("Bake calendar synced automatically.");
  }, [
    calendarSignature,
    onSyncProductionPlans,
    planner.calendarPlans,
    settings.autoCreatePlans,
    settings.enabled,
  ]);

  function updateSetting(key, value) {
    onChangeAutomation({ ...settings, [key]: value });
  }

  function syncNow() {
    onSyncProductionPlans(planner.calendarPlans);
    syncedSignature.current = calendarSignature;
    setSyncMessage("Bake calendar synced.");
  }

  return (
    <div className="production-planner">
      <section className={`production-automation-hero ${settings.enabled ? "enabled" : ""}`}>
        <span><ClipboardList size={24} /></span>
        <div>
          <small>Orders to dough</small>
          <h2>Batch plan</h2>
          <p>Group accepted orders, calculate quantities, stagger timing, spot shortages, and print a bake-day sheet.</p>
        </div>
        <label className="master-automation-toggle">
          <input type="checkbox" checked={settings.enabled} onChange={(event) => updateSetting("enabled", event.target.checked)} />
          <span>{settings.enabled ? "On" : "Off"}</span>
        </label>
      </section>

      <button className="production-settings-button" type="button" onClick={() => setShowSettings((value) => !value)}>
        <Settings2 size={16} /> Batch controls <span>{showSettings ? "Hide" : "Show"}</span>
      </button>

      {showSettings ? (
        <section className="automation-settings">
          <ToggleRow checked={settings.groupBatches} disabled={!settings.enabled} label="Group matching recipes" note="Combine the same bread and pickup day into one efficient batch." onChange={(value) => updateSetting("groupBatches", value)} />
          <ToggleRow checked={settings.autoSchedule} disabled={!settings.enabled} label="Calculate production timing" note="Work backward from pickup through cooling, baking, proofing, mixing, and starter feed." onChange={(value) => updateSetting("autoSchedule", value)} />
          <ToggleRow checked={settings.inventoryWarnings} disabled={!settings.enabled} label="Check inventory shortages" note="Compare required ingredients and bags against stock on hand." onChange={(value) => updateSetting("inventoryWarnings", value)} />
          <ToggleRow checked={settings.includePackaging} disabled={!settings.enabled} label="Include paper bags" note="Reserve one paper bag for every ordered loaf." onChange={(value) => updateSetting("includePackaging", value)} />
          <ToggleRow checked={settings.autoCreatePlans} disabled={!settings.enabled || !settings.autoSchedule} label="Keep bake calendar synced" note="Automatically create and refresh generated bake plans." onChange={(value) => updateSetting("autoCreatePlans", value)} />
          <ToggleRow warning checked={settings.autoDeductInventory} disabled={!settings.enabled} label="Deduct stock when bake completes" note="Changes inventory records. Each order is marked so it can only deduct once." onChange={(value) => updateSetting("autoDeductInventory", value)} />
          <div className="automation-number-grid">
            <label>Cooling before pickup<input disabled={!settings.enabled || !settings.autoSchedule} type="number" min="0" max="8" step="0.5" value={settings.coolingHours} onChange={(event) => updateSetting("coolingHours", Number(event.target.value))} /><span>hours</span></label>
            <label>Default dough temperature<input disabled={!settings.enabled || !settings.autoSchedule} type="number" min="50" max="100" value={settings.doughTemperature} onChange={(event) => updateSetting("doughTemperature", Number(event.target.value))} /><span>°F</span></label>
            <label>Default cold proof<input disabled={!settings.enabled || !settings.autoSchedule} type="number" min="0" max="48" step="0.5" value={settings.coldProofHours} onChange={(event) => updateSetting("coldProofHours", Number(event.target.value))} /><span>hours</span></label>
          </div>
        </section>
      ) : null}

      {!settings.enabled ? (
        <section className="production-paused">
          <Settings2 size={22} />
          <div><strong>Automatic batch planning is off</strong><span>Your orders and manual bake plans are unchanged.</span></div>
        </section>
      ) : (
        <div id="production-sheet">
          <section className="production-summary-grid">
            <div><Wheat /><strong>{planner.totalLoaves}</strong><span>items queued</span></div>
            <div><ClipboardList /><strong>{planner.batches.length}</strong><span>production batches</span></div>
            <div className={planner.shortages.length ? "warning" : ""}><PackageSearch /><strong>{planner.shortages.length}</strong><span>stock warnings</span></div>
          </section>

          {planner.unmatched.length ? (
            <aside className="production-warning"><AlertTriangle size={18} /><span><strong>{planner.unmatched.length} order line{planner.unmatched.length === 1 ? "" : "s"} need a recipe match</strong><small>{planner.unmatched.map((batch) => batch.recipeName).join(" · ")}</small></span></aside>
          ) : null}

          <section className="production-batches">
            <div className="section-title-line"><div><span className="eyebrow-label dark">Orders to dough</span><h2>Batch plan</h2></div><span>{planner.batches.length} batches</span></div>
            {planner.batches.length ? planner.batches.map((batch) => (
              <article className="production-batch-card" key={batch.key}>
                <div className="production-batch-heading">
                  <span><strong>{batch.recipeName}</strong><small>{batch.customers.join(" · ")}</small></span>
                  <span><strong>{batch.loaves}</strong><small>{batch.recipe?.unitName || "items"}</small></span>
                </div>
                <div className="production-batch-facts">
                  <span><small>Pickup</small><strong>{dateTimeLabel(batch.pickupAt)}</strong></span>
                  <span><small>Mix</small><strong>{dateTimeLabel(batch.schedule?.mix)}</strong></span>
                  <span><small>Feed starter</small><strong>{dateTimeLabel(batch.schedule?.steps?.[0]?.start)}</strong></span>
                  <span><small>Bake finished</small><strong>{dateTimeLabel(batch.schedule?.bakeEnd)}</strong></span>
                </div>
                {batch.recipe ? (
                  <div className="production-formula">
                    {batch.recipe.ingredients.map((ingredient, index) => (
                      <span key={`${ingredient.name}-${index}`}><strong>{ingredient.name}</strong><small>{Math.round(Number(ingredient.weight || 0) * batch.loaves / Math.max(1, Number(batch.recipe.yield || 1)))} g</small></span>
                    ))}
                  </div>
                ) : null}
              </article>
            )) : <p className="cloud-empty-copy">No accepted or local pending orders with pickup dates yet.</p>}
          </section>

          {settings.inventoryWarnings ? (
            <section className="production-inventory-check">
              <div className="section-title-line"><div><span className="eyebrow-label dark">Before mixing</span><h2>Inventory check</h2></div>{planner.shortages.length ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}</div>
              <div className="production-stock-list">
                {planner.stock.filter((row) => !row.skipped).map((row) => (
                  <div className={row.shortage ? "shortage" : ""} key={row.name}>
                    <span><strong>{row.name}</strong><small>{row.matched ? `${row.available} ${row.item.unit} on hand` : "No matching inventory item"}</small></span>
                    <span><strong>{requirementLabel(row)}</strong><small>{row.shortage ? "Short" : "Ready"}</small></span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {settings.enabled ? (
        <div className="production-actions">
          <button className="secondary-button" type="button" disabled={!planner.calendarPlans.length} onClick={syncNow}><CalendarCheck2 size={16} /> Sync calendar now</button>
          <button className="primary-button" type="button" disabled={!planner.batches.length} onClick={() => window.print()}><Printer size={16} /> Print bake-day sheet</button>
        </div>
      ) : null}
      {syncMessage ? <p className="production-sync-message">{syncMessage}</p> : null}
    </div>
  );
}
