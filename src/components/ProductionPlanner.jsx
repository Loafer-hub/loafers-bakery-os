import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Clock3,
  FileText,
  ListChecks,
  PackageCheck,
  PackageSearch,
  Printer,
  QrCode,
  Settings2,
  ShoppingCart,
  Tags,
  Wheat,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildProductionPlanner,
  DEFAULT_PRODUCTION_AUTOMATION,
  ingredientRequirements,
  inventoryStatus,
  orderProductionLines,
} from "../lib/productionPlanner";

const CLOSED_ORDER_STATUSES = new Set(["completed", "rejected", "cancelled", "canceled"]);
const PRODUCTION_READY_STATUSES = new Set(["accepted", "paid", "deposit", "confirmed", "in progress", "ready", "picked up"]);

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

function timeLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function shortDateLabel(value) {
  if (!value) return "Unscheduled";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function parseDay(value) {
  if (value instanceof Date) return new Date(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  return new Date(value || Date.now());
}

function addDays(value, days) {
  const date = parseDay(value);
  if (Number.isNaN(date.getTime())) return new Date();
  date.setDate(date.getDate() + Number(days || 0));
  date.setHours(12, 0, 0, 0);
  return date;
}

function weekStartFor(value) {
  const date = parseDay(value);
  if (Number.isNaN(date.getTime())) return new Date();
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date;
}

function weekRangeLabel(startKey) {
  const start = parseDay(startKey);
  const end = addDays(start, 6);
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function safeSingleLine(value, fallback = "") {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function truncateLine(value, length = 32) {
  const text = safeSingleLine(value);
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1))}…`;
}

function smartAmount(value, digits = 1) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 10) return number.toFixed(0);
  return number.toFixed(digits);
}

function requirementLabel(row) {
  if (row.packaging) return `${row.needed} ${row.item?.unit || "bags"}`;
  if (row.matched) return `${row.needed.toFixed(row.needed < 10 ? 2 : 1)} ${row.item.unit}`;
  return `${Math.round(row.grams || 0)} g`;
}

function isProductionReadyOrder(order) {
  const status = String(order?.status || "").toLowerCase();
  if (order?.isSample === true || CLOSED_ORDER_STATUSES.has(status)) return false;
  return !status || PRODUCTION_READY_STATUSES.has(status);
}

function eventDateKey(event) {
  return localDateKey(event.start);
}

function eventTone(stepId = "") {
  if (stepId.includes("feed")) return "feed";
  if (stepId.includes("mix")) return "mix";
  if (stepId.includes("fold")) return "fold";
  if (stepId.includes("bake")) return "bake";
  if (stepId.includes("pickup")) return "pickup";
  return "work";
}

function buildProductionEvents(batches) {
  return batches.flatMap((batch) => {
    const scheduled = batch.schedule?.steps?.map((step) => ({
      id: `${batch.key}-${step.id}`,
      start: step.start,
      end: step.end,
      label: step.label,
      detail: step.detail,
      batch,
      tone: eventTone(step.id),
    })) || [];
    const pickup = batch.pickupAt ? [{
      id: `${batch.key}-pickup`,
      start: new Date(batch.pickupAt),
      label: "Pickup",
      detail: batch.customers.join(" · "),
      batch,
      tone: "pickup",
    }] : [];
    return [...scheduled, ...pickup];
  }).filter((event) => event.start && !Number.isNaN(new Date(event.start).getTime()))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

function storageNoteForProduct(lines) {
  const type = lines.find((line) => line.recipe?.productType)?.recipe?.productType || "bread";
  if (type === "hot_sauce") return "Refrigerate after opening. Do not use if cap bulges, smells off, or mold appears.";
  if (type === "vinegar") return "Store capped away from heat and sunlight. Sediment or mother is normal in live vinegar.";
  if (type === "infused_oil") return "Keep refrigerated unless shelf-stable process is verified. Use clean utensils.";
  if (type === "cake") return "Keep covered. Refrigerate if dairy frosting or perishable filling is used.";
  return "Keep wrapped at room temperature. For longer storage, slice and freeze.";
}

function uniqueWords(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function buildLabelRows(orders, recipes) {
  return orders
    .filter(isProductionReadyOrder)
    .sort((a, b) => new Date(a.pickupAt || a.createdAt || 0) - new Date(b.pickupAt || b.createdAt || 0))
    .map((order) => {
      const lines = orderProductionLines(order, recipes);
      const ingredients = uniqueWords(lines.flatMap((line) => (
        line.recipe?.ingredients?.map((ingredient) => ingredient.name) || []
      )));
      return {
        id: order.id,
        customer: order.customer || "Customer",
        item: order.itemSummary || `${order.quantity || 1} × ${order.product || "Order"}`,
        pickup: order.pickupAt ? dateTimeLabel(order.pickupAt) : order.due || "Pickup not set",
        payment: [order.paymentMethod, order.paymentStatus].filter(Boolean).join(" · ") || "Payment not recorded",
        allergies: order.allergies || "No allergies listed",
        requestCode: order.requestCode || order.cloudOrderId || "",
        ingredients: ingredients.length ? ingredients.join(", ") : "Recipe ingredients not matched",
        storage: storageNoteForProduct(lines),
        notes: order.notes || order.internalNotes || "",
      };
    });
}

function storefrontUrlFor(cloudAccount) {
  const slug = cloudAccount?.workspace?.bakery?.slug || "loafers";
  if (typeof window === "undefined") return `?order=${encodeURIComponent(slug)}`;
  const url = new URL(window.location.href);
  url.search = `?order=${encodeURIComponent(slug)}`;
  url.hash = "";
  return url.toString();
}

function qrImageUrl(value, size = 180) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(value)}`;
}

function coreprintLabelText(label, storefrontUrl) {
  return [
    "LOAFERS BAKERY",
    "------------------------------",
    `CUSTOMER: ${truncateLine(label.customer, 21)}`,
    `PICKUP: ${truncateLine(label.pickup, 23)}`,
    `ITEM: ${truncateLine(label.item, 25)}`,
    `ALLERGY: ${truncateLine(label.allergies, 22)}`,
    `PAY: ${truncateLine(label.payment, 26)}`,
    label.requestCode ? `CODE: ${truncateLine(label.requestCode, 25)}` : "",
    "SCAN QR TO ORDER AGAIN",
    storefrontUrl,
    "Thank you!",
  ].filter(Boolean).join("\n");
}

function storefrontSlipText(storefrontUrl) {
  return [
    "LOAFERS BAKERY",
    "------------------------------",
    "SCAN QR TO ORDER",
    "Fresh bread + small batch goods",
    storefrontUrl,
    "Thank you!",
  ].join("\n");
}

function buildForecastRows({ days, inventory, planner, settings }) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + Number(days || 14));
  cutoff.setHours(23, 59, 59, 999);
  const forecastBatches = planner.batches.filter((batch) => {
    if (!batch.pickupAt) return true;
    const pickup = new Date(batch.pickupAt);
    return Number.isNaN(pickup.getTime()) || pickup <= cutoff;
  });
  const requirements = ingredientRequirements(forecastBatches);
  const totalPackages = forecastBatches.reduce((sum, batch) => sum + Number(batch.packages || 0), 0);
  return inventoryStatus(requirements, inventory, totalPackages, settings.includePackaging)
    .filter((row) => !row.skipped)
    .map((row) => {
      if (!row.matched || !row.item) {
        return {
          ...row,
          status: "missing",
          projected: 0,
          restock: 0,
          cost: 0,
          unit: row.item?.unit || "match needed",
        };
      }
      const target = Number(row.item.target || 0);
      const projected = Number(row.available || 0) - Number(row.needed || 0);
      const restock = Math.max(0, target - projected);
      return {
        ...row,
        status: projected < 0 ? "short" : projected < target ? "low" : "ok",
        projected,
        restock,
        target,
        unit: row.item.unit,
        cost: restock * Number(row.item.unitCost || 0),
      };
    }).sort((a, b) => {
      const rank = { missing: 0, short: 1, low: 2, ok: 3 };
      return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
    });
}

function buildWeeklyProductionDays({ weekStartKey, events, batches, inventory, settings }) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStartKey, index);
    const key = localDateKey(date);
    const dayEvents = events.filter((event) => eventDateKey(event) === key);
    const dayBatches = batches.filter((batch) => localDateKey(batch.pickupAt) === key);
    const touchedBatches = new Map();
    [...dayEvents.map((event) => event.batch), ...dayBatches].filter(Boolean).forEach((batch) => {
      touchedBatches.set(batch.key, batch);
    });
    const batchList = [...touchedBatches.values()];
    const requirements = ingredientRequirements(dayBatches.filter((batch) => batch.recipe));
    const packageCount = dayBatches.reduce((sum, batch) => sum + Number(batch.packages || 0), 0);
    const dayShortages = inventoryStatus(requirements, inventory, packageCount, settings.includePackaging)
      .filter((row) => row.shortage && !row.skipped);
    return {
      key,
      date,
      events: dayEvents,
      batches: batchList,
      pickups: dayEvents.filter((event) => event.tone === "pickup"),
      feeds: dayEvents.filter((event) => event.tone === "feed"),
      mixes: dayEvents.filter((event) => event.tone === "mix"),
      bakes: dayEvents.filter((event) => event.tone === "bake"),
      items: batchList.reduce((sum, batch) => sum + Number(batch.loaves || 0), 0),
      shortages: dayShortages,
    };
  });
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
  cloudAccount,
  inventory,
  orders,
  recipes,
  starters,
  starterLogs,
  onChangeAutomation,
  onSyncProductionPlans,
}) {
  const settings = useMemo(() => ({ ...DEFAULT_PRODUCTION_AUTOMATION, ...automation }), [automation]);
  const [showSettings, setShowSettings] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date()));
  const [weekStartKey, setWeekStartKey] = useState(() => localDateKey(weekStartFor(new Date())));
  const [forecastDays, setForecastDays] = useState(14);
  const [printMode, setPrintMode] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const syncedSignature = useRef("");
  const planner = useMemo(() => buildProductionPlanner({
    orders,
    recipes,
    inventory,
    starters,
    starterLogs,
    settings,
  }), [inventory, orders, recipes, settings, starterLogs, starters]);
  const productionEvents = useMemo(() => buildProductionEvents(planner.batches), [planner.batches]);
  const dayOptions = useMemo(() => {
    const keys = new Set([localDateKey(new Date())]);
    productionEvents.forEach((event) => {
      const key = eventDateKey(event);
      if (key) keys.add(key);
    });
    planner.batches.forEach((batch) => {
      const key = localDateKey(batch.pickupAt);
      if (key) keys.add(key);
    });
    return [...keys].sort();
  }, [planner.batches, productionEvents]);
  const selectedDayEvents = useMemo(() => (
    productionEvents.filter((event) => eventDateKey(event) === selectedDay)
  ), [productionEvents, selectedDay]);
  const selectedDayBatches = useMemo(() => {
    const batchMap = new Map();
    selectedDayEvents.forEach((event) => batchMap.set(event.batch.key, event.batch));
    return [...batchMap.values()];
  }, [selectedDayEvents]);
  const weekDays = useMemo(() => buildWeeklyProductionDays({
    weekStartKey,
    events: productionEvents,
    batches: planner.batches,
    inventory,
    settings,
  }), [inventory, planner.batches, productionEvents, settings, weekStartKey]);
  const weekSummary = useMemo(() => ({
    pickups: weekDays.reduce((sum, day) => sum + day.pickups.length, 0),
    feeds: weekDays.reduce((sum, day) => sum + day.feeds.length, 0),
    mixes: weekDays.reduce((sum, day) => sum + day.mixes.length, 0),
    items: weekDays.reduce((sum, day) => sum + day.items, 0),
    shortages: weekDays.reduce((sum, day) => sum + day.shortages.length, 0),
  }), [weekDays]);
  const labelRows = useMemo(() => buildLabelRows(orders, recipes), [orders, recipes]);
  const forecastRows = useMemo(() => buildForecastRows({
    days: forecastDays,
    inventory,
    planner,
    settings,
  }), [forecastDays, inventory, planner, settings]);
  const shoppingRows = forecastRows.filter((row) => row.status !== "ok");
  const shoppingTotal = shoppingRows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const readyOrders = orders.filter(isProductionReadyOrder);
  const storefrontUrl = useMemo(() => storefrontUrlFor(cloudAccount), [cloudAccount?.workspace?.bakery?.slug]);
  const storefrontQrSrc = useMemo(() => qrImageUrl(storefrontUrl), [storefrontUrl]);
  const miniPrinterRows = labelRows.length
    ? labelRows.map((label) => ({
      ...label,
      copyText: coreprintLabelText(label, storefrontUrl),
      heading: label.customer,
      subheading: label.item,
    }))
    : [{
      id: "storefront-slip",
      customer: "Storefront QR slip",
      item: "Scan to order from Loafers",
      pickup: "Any customer",
      payment: "",
      allergies: "",
      requestCode: "",
      ingredients: "",
      storage: "",
      notes: "",
      copyText: storefrontSlipText(storefrontUrl),
      heading: "Storefront QR slip",
      subheading: "Copy/paste into Coreprint",
    }];
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

  useEffect(() => {
    const clearPrintMode = () => {
      document.body.removeAttribute("data-print-mode");
      setPrintMode("");
    };
    window.addEventListener("afterprint", clearPrintMode);
    return () => window.removeEventListener("afterprint", clearPrintMode);
  }, []);

  function updateSetting(key, value) {
    onChangeAutomation({ ...settings, [key]: value });
  }

  function syncNow() {
    onSyncProductionPlans(planner.calendarPlans);
    syncedSignature.current = calendarSignature;
    setSyncMessage("Bake calendar synced.");
  }

  function moveWeek(days) {
    setWeekStartKey(localDateKey(addDays(weekStartKey, days)));
  }

  function printSection(mode) {
    setPrintMode(mode);
    document.body.dataset.printMode = mode;
    window.requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 80);
    });
  }

  async function copyMiniLabel(text, trigger) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopyMessage("Copied mini-printer label text.");
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (copied) {
          setCopyMessage("Copied mini-printer label text.");
        } else {
          const visibleBox = trigger?.closest(".coreprint-label-card")?.querySelector("textarea");
          visibleBox?.focus();
          visibleBox?.select();
          setCopyMessage("Copy was blocked, so I selected the label text. Use Copy, then paste into Coreprint.");
        }
      } catch {
        const visibleBox = trigger?.closest(".coreprint-label-card")?.querySelector("textarea");
        visibleBox?.focus();
        visibleBox?.select();
        setCopyMessage("Copy was blocked, so I selected the label text. Use Copy, then paste into Coreprint.");
      }
    }
  }

  return (
    <div className={`production-planner ${printMode ? `print-mode-${printMode}` : ""}`}>
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
        <>
          <section className="weekly-production-panel" aria-label="Weekly production planner">
            <div className="section-title-line">
              <div>
                <span className="eyebrow-label dark">Weekly production planner</span>
                <h2>{weekRangeLabel(weekStartKey)}</h2>
                <small>See pickup load, starter feeds, mix days, bakes, and shortage pressure before you commit to the day.</small>
              </div>
              <CalendarDays size={21} />
            </div>
            <div className="weekly-production-toolbar">
              <button type="button" className="secondary-button" onClick={() => moveWeek(-7)}><ChevronLeft size={15} /> Prev</button>
              <button type="button" className="secondary-button" onClick={() => {
                const today = localDateKey(new Date());
                setSelectedDay(today);
                setWeekStartKey(localDateKey(weekStartFor(new Date())));
              }}>This week</button>
              <button type="button" className="secondary-button" onClick={() => moveWeek(7)}>Next <ChevronRight size={15} /></button>
            </div>
            <div className="weekly-production-summary">
              <span><strong>{weekSummary.pickups}</strong><small>pickups</small></span>
              <span><strong>{weekSummary.mixes}</strong><small>mixes</small></span>
              <span><strong>{weekSummary.feeds}</strong><small>feeds</small></span>
              <span><strong>{weekSummary.items}</strong><small>items touched</small></span>
              <span className={weekSummary.shortages ? "warning" : ""}><strong>{weekSummary.shortages}</strong><small>stock flags</small></span>
            </div>
            <div className="weekly-production-grid">
              {weekDays.map((day) => {
                const topEvents = day.events.slice(0, 4);
                const eventOverflow = Math.max(0, day.events.length - topEvents.length);
                return (
                  <button
                    type="button"
                    className={`weekly-production-day ${selectedDay === day.key ? "selected" : ""} ${day.shortages.length ? "has-shortage" : ""}`}
                    key={day.key}
                    onClick={() => setSelectedDay(day.key)}
                  >
                    <span className="weekly-day-heading">
                      <strong>{day.date.toLocaleDateString("en-US", { weekday: "short" })}</strong>
                      <small>{day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
                    </span>
                    <span className="weekly-day-load">
                      <em>{day.items}</em>
                      <small>{day.pickups.length} pickup{day.pickups.length === 1 ? "" : "s"} · {day.events.length} step{day.events.length === 1 ? "" : "s"}</small>
                    </span>
                    <span className="weekly-day-events">
                      {topEvents.length ? topEvents.map((event) => (
                        <i className={event.tone} key={event.id}>
                          <b>{timeLabel(event.start)}</b>
                          {event.label}
                        </i>
                      )) : <i className="quiet">No production scheduled</i>}
                      {eventOverflow ? <i className="more">+{eventOverflow} more</i> : null}
                    </span>
                    {day.shortages.length ? <small className="weekly-shortage-note">{day.shortages.length} inventory warning{day.shortages.length === 1 ? "" : "s"}</small> : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="production-day-mode" id="production-day-sheet" aria-label="Production day mode">
            <div className="section-title-line">
              <div>
                <span className="eyebrow-label dark">Production day mode</span>
                <h2>{shortDateLabel(selectedDay)}</h2>
                <small>A focused bench view for the work that happens on this day.</small>
              </div>
              <CalendarDays size={21} />
            </div>
            <div className="production-day-toolbar">
              <label>
                Day
                <select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>
                  {dayOptions.map((day) => <option key={day} value={day}>{shortDateLabel(day)}</option>)}
                </select>
              </label>
              <button type="button" className="secondary-button" onClick={() => printSection("day")} disabled={!selectedDayEvents.length}>
                <Printer size={15} /> Print day sheet
              </button>
            </div>
            <div className="production-day-stats">
              <span><strong>{selectedDayEvents.length}</strong><small>timed steps</small></span>
              <span><strong>{selectedDayBatches.length}</strong><small>batches touched</small></span>
              <span><strong>{selectedDayBatches.reduce((sum, batch) => sum + Number(batch.loaves || 0), 0)}</strong><small>items in flow</small></span>
              <span><strong>{planner.shortages.length}</strong><small>stock flags</small></span>
            </div>
            <div className="production-day-timeline">
              {selectedDayEvents.length ? selectedDayEvents.map((event) => (
                <article className={`production-day-event ${event.tone}`} key={event.id}>
                  <time>{timeLabel(event.start)}</time>
                  <span>
                    <strong>{event.label}</strong>
                    <small>{event.batch.recipeName} · {event.batch.loaves} {event.batch.recipe?.unitName || "items"}</small>
                  </span>
                  <em>{event.detail || event.batch.customers.join(" · ")}</em>
                </article>
              )) : (
                <p className="cloud-empty-copy">No timed production steps on this day yet. Sync the batch plan or choose another day.</p>
              )}
            </div>
          </section>

          <div id="production-sheet" className="production-batch-sheet">
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

          <section className="production-print-center" aria-label="Labels and printables">
            <div className="section-title-line">
              <div>
                <span className="eyebrow-label dark">Printables</span>
                <h2>Labels and prep sheets</h2>
                <small>Print the day list, customer labels, or shopping sheet without copying notes by hand.</small>
              </div>
              <FileText size={21} />
            </div>
            <div className="production-print-actions">
              <button type="button" className="secondary-button" onClick={() => printSection("batch")} disabled={!planner.batches.length}><ListChecks size={15} /> Batch sheet</button>
              <button type="button" className="secondary-button" onClick={() => printSection("labels")} disabled={!labelRows.length}><Tags size={15} /> Order labels</button>
              <button type="button" className="secondary-button" onClick={() => printSection("shopping")} disabled={!forecastRows.length}><ShoppingCart size={15} /> Shopping list</button>
            </div>
            <section className="coreprint-copy-panel" aria-label="Coreprint CTP500BR copy and paste labels">
              <div className="coreprint-heading">
                <span><QrCode size={17} /> Coreprint CTP500BR mini labels</span>
                <small>Copy this narrow text into the Coreprint app. The QR points to your storefront.</small>
              </div>
              {copyMessage ? <p className="production-sync-message">{copyMessage}</p> : null}
              <div className="coreprint-label-list">
                {miniPrinterRows.map((label) => (
                  <article className="coreprint-label-card" key={label.id}>
                    <div className="coreprint-label-preview">
                      <img src={storefrontQrSrc} alt="QR code for Loafers storefront" />
                      <span>
                        <strong>{label.heading}</strong>
                        <small>{label.subheading}</small>
                        <em>{storefrontUrl}</em>
                      </span>
                    </div>
                    <textarea readOnly value={label.copyText} aria-label={`${label.heading} Coreprint label text`} />
                    <button type="button" className="secondary-button" onClick={(event) => copyMiniLabel(label.copyText, event.currentTarget)}>
                      <Copy size={15} /> Copy Coreprint text
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <div id="production-label-sheet" className="production-label-sheet">
              <div className="print-sheet-heading">
                <span>Loafers Bakery OS</span>
                <strong>Order labels</strong>
                <small>{labelRows.length} active production order{labelRows.length === 1 ? "" : "s"}</small>
              </div>
              <div className="production-label-grid">
                {labelRows.length ? labelRows.map((label) => (
                  <article className="production-label-card" key={label.id}>
                    <div className="production-label-topline"><strong>{label.customer}</strong><span>{label.pickup}</span></div>
                    <div className="production-label-main">
                      <span>
                        <h3>{label.item}</h3>
                        <p><b>Ingredients:</b> {label.ingredients}</p>
                        <p><b>Allergies:</b> {label.allergies}</p>
                        <p><b>Storage:</b> {label.storage}</p>
                      </span>
                      <img className="production-label-qr" src={storefrontQrSrc} alt="QR code for Loafers storefront" />
                    </div>
                    <small>{label.payment}{label.requestCode ? ` · ${label.requestCode}` : ""} · Scan QR to order again</small>
                  </article>
                )) : <p className="cloud-empty-copy">No active production orders to label.</p>}
              </div>
            </div>
          </section>

          <section className="inventory-forecast-panel" id="production-shopping-sheet" aria-label="Inventory forecast">
            <div className="section-title-line">
              <div>
                <span className="eyebrow-label dark">Inventory forecast</span>
                <h2>Restock before you run short</h2>
                <small>Uses accepted production orders, recipes, package counts, inventory targets, and unit costs.</small>
              </div>
              <PackageCheck size={21} />
            </div>
            <div className="inventory-forecast-toolbar">
              <label>
                Forecast window
                <span><input type="number" min="1" max="60" value={forecastDays} onChange={(event) => setForecastDays(Number(event.target.value))} /> days</span>
              </label>
              <strong>${money(shoppingTotal)} suggested restock</strong>
            </div>
            <div className="inventory-forecast-list">
              {forecastRows.length ? forecastRows.map((row) => (
                <article className={`inventory-forecast-row ${row.status}`} key={row.name}>
                  <span>
                    <strong>{row.name}</strong>
                    <small>{row.status === "missing" ? "No matching inventory item" : `${smartAmount(row.available)} ${row.unit} on hand · need ${smartAmount(row.needed)} ${row.unit}`}</small>
                  </span>
                  <span>
                    <strong>{row.status === "ok" ? "Covered" : row.status === "missing" ? "Match item" : `Buy ${smartAmount(row.restock)} ${row.unit}`}</strong>
                    <small>{row.status === "ok" ? `Projected ${smartAmount(row.projected)} ${row.unit}` : row.status === "missing" ? "Add or rename inventory so forecasting can track it." : `Target ${smartAmount(row.target)} · est. $${money(row.cost)}`}</small>
                  </span>
                </article>
              )) : <p className="cloud-empty-copy">No forecast rows yet. Add accepted pickup-dated orders and matching recipe ingredients.</p>}
            </div>
            <div className="shopping-list-summary">
              <strong>Shopping list</strong>
              {shoppingRows.length ? shoppingRows.map((row) => (
                <span key={row.name}>{row.status === "missing" ? `${row.name}: match inventory item` : `${row.name}: ${smartAmount(row.restock)} ${row.unit}`}</span>
              )) : <span>No restock needed for this window.</span>}
            </div>
          </section>
        </>
      )}

      {settings.enabled ? (
        <div className="production-actions">
          <button className="secondary-button" type="button" disabled={!planner.calendarPlans.length} onClick={syncNow}><CalendarCheck2 size={16} /> Sync calendar now</button>
          <button className="primary-button" type="button" disabled={!readyOrders.length} onClick={() => printSection("labels")}><Printer size={16} /> Print labels</button>
        </div>
      ) : null}
      {syncMessage ? <p className="production-sync-message">{syncMessage}</p> : null}
    </div>
  );
}
