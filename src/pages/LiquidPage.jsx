import {
  AlertTriangle,
  Beaker,
  CalendarDays,
  ClipboardCheck,
  Droplets,
  Flame,
  Gauge,
  Info,
  PackageCheck,
  Save,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";

const clamp = (min, value, max) => Math.min(max, Math.max(min, value));

function numeric(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatAmount(value, decimals = 0) {
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function tempFermentationRate(tempF) {
  return clamp(0.35, Math.pow(2, (tempF - 68) / 18), 2.45);
}

function tempBandLabel(tempF) {
  if (tempF < 60) return "Very slow";
  if (tempF < 68) return "Cool and clean";
  if (tempF <= 78) return "Balanced";
  if (tempF <= 86) return "Fast and fruity";
  return "Hot stress zone";
}

const SAFETY_PRODUCT_TYPES = [
  { value: "hot_sauce", label: "Fermented hot sauce", unit: "bottles" },
  { value: "vinegar", label: "Vinegar", unit: "bottles" },
  { value: "infused_oil", label: "Infused oil", unit: "bottles" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultSafetyDraft() {
  const date = todayIso();
  return {
    batchName: "",
    productType: "hot_sauce",
    lotCode: `LOAF-${date.replace(/-/g, "")}`,
    batchDate: date,
    quantity: "",
    ph: "",
    saltPct: "",
    shelfLifeDays: 14,
    storageInstructions: "Refrigerate after opening. Keep capped and use clean utensils.",
    warningNotes: "",
    recallNotes: "",
  };
}

function productTypeLabel(value) {
  return SAFETY_PRODUCT_TYPES.find((type) => type.value === value)?.label || "Liquid product";
}

function safetyFindings(log) {
  const rawPh = String(log.ph ?? "").trim();
  const rawSaltPct = String(log.saltPct ?? "").trim();
  const rawShelfLifeDays = String(log.shelfLifeDays ?? "").trim();
  const ph = rawPh ? Number(rawPh) : NaN;
  const saltPct = rawSaltPct ? Number(rawSaltPct) : NaN;
  const shelfLifeDays = rawShelfLifeDays ? Number(rawShelfLifeDays) : 0;
  const notes = `${log.warningNotes || ""} ${log.storageInstructions || ""}`.toLowerCase();
  const findings = [];

  if (log.productType === "hot_sauce" || log.productType === "vinegar") {
    if (!Number.isFinite(ph)) {
      findings.push({ tone: "warning", text: "Record a measured finished pH before selling or storing this batch." });
    } else if (ph > 4.6) {
      findings.push({ tone: "danger", text: "Measured pH is above 4.6. Treat this as not shelf-stable without a validated process." });
    } else {
      findings.push({ tone: "safe", text: "Measured pH is at or below the common 4.6 acidified-food line." });
    }
  }

  if (log.productType === "hot_sauce") {
    if (!Number.isFinite(saltPct)) {
      findings.push({ tone: "warning", text: "Record salt percentage for fermentation traceability." });
    } else if (saltPct < 2) {
      findings.push({ tone: "danger", text: "Salt is below 2%; fermentation safety margin is thin." });
    } else if (saltPct > 6) {
      findings.push({ tone: "warning", text: "Salt is high; it may slow souring and soften product expectations." });
    } else {
      findings.push({ tone: "safe", text: "Salt is in a practical lacto-ferment planning range." });
    }
  }

  if (log.productType === "infused_oil") {
    const freshRisk = /fresh|garlic|herb|chile|pepper|zest/.test(notes);
    findings.push({
      tone: freshRisk ? "danger" : "warning",
      text: freshRisk
        ? "Fresh garlic, herbs, chiles, or zest in oil need conservative refrigeration and short hold notes."
        : "Oil has no useful pH by itself. Log ingredient water-risk and storage instructions clearly.",
    });
  }

  if (!shelfLifeDays) {
    findings.push({ tone: "warning", text: "Add a shelf-life target so old batches are easier to pull." });
  }

  if (!String(log.recallNotes || "").trim()) {
    findings.push({ tone: "info", text: "Add recall notes such as ingredient lots, test method, or who received the batch." });
  }

  return findings;
}

function HotSauceLab({ values, onChange }) {
  const model = useMemo(() => {
    const produceG = Math.max(0, numeric(values.produceG));
    const waterG = Math.max(0, numeric(values.waterG));
    const saltPct = clamp(0, numeric(values.saltPct), 12);
    const tempF = numeric(values.tempF, 72);
    const days = Math.max(0, numeric(values.days));
    const targetPh = clamp(3.2, numeric(values.targetPh, 4), 4.6);
    const saltBase = values.style === "brine" ? produceG + waterG : produceG;
    const saltG = saltBase * (saltPct / 100);
    let saltRate = clamp(0.3, 1.12 - Math.abs(saltPct - 3.2) * 0.16, 1.1);
    if (saltPct < 2) saltRate = 0.35;
    if (saltPct > 6) saltRate = 0.45;
    const styleRate = values.style === "mash" ? 1.12 : 0.95;
    const activityRate = tempFermentationRate(tempF) * saltRate * styleRate;
    const acidityProgress = 1 - Math.exp(-(days * activityRate) / 8);
    const estimatedPh = clamp(3.35, 5.45 - 2.05 * acidityProgress, 5.45);
    const maturityDays = clamp(4, 8 / Math.max(activityRate, 0.1), 21);
    const gasActivity = clamp(8, days * activityRate * 13, 100);
    const targetDelta = estimatedPh - targetPh;
    const status = estimatedPh <= 4
      ? "Sharp acid zone"
      : estimatedPh <= 4.6
        ? "Acidified range"
        : "Keep fermenting";
    const caution = saltPct < 2
      ? "Salt is low: raise it before fermenting."
      : saltPct > 6
        ? "Salt is high: safe selection improves, but LAB activity slows."
        : estimatedPh > 4.6
          ? "Estimated pH is still above the common acidified-food line."
          : "Still measure finished pH before bottling or selling.";
    return {
      activityRate,
      caution,
      estimatedPh,
      gasActivity,
      maturityDays,
      saltBase,
      saltG,
      saltRate,
      status,
      targetDelta,
      tempRate: tempFermentationRate(tempF),
    };
  }, [values]);

  return (
    <>
      <section className="liquid-lab-hero hot-sauce-hero">
        <div>
          <span className="eyebrow-label">Lacto-fermented peppers</span>
          <h2>Hot sauce calculator</h2>
          <p>
            Plan salt, temperature, time, and expected acid development. The model favors
            lactic-acid bacteria by balancing brine strength, oxygen exclusion, and warmth.
          </p>
        </div>
        <Flame size={38} />
      </section>

      <section className="model-controls liquid-model-controls">
        <div className="planner-input-grid">
          <label>
            Ferment style
            <select value={values.style} onChange={(event) => onChange("style", event.target.value)}>
              <option value="mash">Pepper mash / dry brine</option>
              <option value="brine">Whole peppers in brine</option>
            </select>
          </label>
          <label>
            Peppers + produce g
            <input type="number" min="0" value={values.produceG} onChange={(event) => onChange("produceG", event.target.value)} />
          </label>
          <label>
            Added water g
            <input type="number" min="0" value={values.waterG} onChange={(event) => onChange("waterG", event.target.value)} />
          </label>
          <label>
            Salt %
            <input type="number" min="0" max="12" step="0.1" value={values.saltPct} onChange={(event) => onChange("saltPct", event.target.value)} />
          </label>
          <label>
            Room temp °F
            <input type="number" min="45" max="95" value={values.tempF} onChange={(event) => onChange("tempF", event.target.value)} />
          </label>
          <label>
            Ferment days
            <input type="number" min="0" max="90" step="1" value={values.days} onChange={(event) => onChange("days", event.target.value)} />
          </label>
          <label>
            Target finished pH
            <input type="number" min="3.2" max="4.6" step="0.1" value={values.targetPh} onChange={(event) => onChange("targetPh", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="liquid-result-grid" aria-label="Hot sauce calculations">
        <ResultCard label="Salt to add" value={`${formatAmount(model.saltG, 1)} g`} detail={`${values.saltPct}% of ${formatAmount(model.saltBase)} g ferment mass`} />
        <ResultCard label="Estimated pH" value={model.estimatedPh.toFixed(2)} detail={`${model.status} · target ${values.targetPh}`} tone={model.estimatedPh <= 4.6 ? "safe" : "warning"} />
        <ResultCard label="Peak sour window" value={`${formatAmount(model.maturityDays, 1)} days`} detail={`${tempBandLabel(numeric(values.tempF))} at ${values.tempF}°F`} />
        <ResultCard label="Ferment pace" value={`${model.activityRate.toFixed(2)}×`} detail={`Temp ${model.tempRate.toFixed(2)}× · salt ${model.saltRate.toFixed(2)}×`} />
      </section>

      <section className="science-curves liquid-science-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label">Chemistry model</span><h2>What changes the sauce</h2></div>
          <Beaker size={22} />
        </div>
        <div className="liquid-meter-row">
          <span>Slow</span>
          <div className="liquid-meter"><i style={{ width: `${model.gasActivity}%` }} /></div>
          <span>Active</span>
        </div>
        <div className="liquid-effect-grid">
          <EffectCard title="Salt selects the team" body="Around 2.5–3.5% salt usually favors lactic-acid bacteria while slowing spoilage microbes. Too little is risky; too much slows souring." />
          <EffectCard title="Warmth speeds acid" body="Higher temperatures accelerate metabolism, gas, and softening. Cooler ferments are slower and often cleaner tasting." />
          <EffectCard title="Mash vs brine" body="Mash ferments faster because cells are broken open and sugars are available. Brine is calmer and better for keeping solids submerged." />
          <EffectCard title="pH is measured, not guessed" body={`This estimate is ${model.targetDelta <= 0 ? "at or below" : "above"} your target. A calibrated pH meter is the real sign-off.`} />
        </div>
      </section>

      <SafetyCallout>
        Keep solids below brine, vent pressure safely, and measure the finished blended sauce.
        For selling or shelf-stable storage, do not rely on taste, bubbles, or this estimate alone.
      </SafetyCallout>
      <p className="model-note liquid-source-note">
        Common food-safety anchor: acidified foods are controlled around pH 4.6, and finished pH should be verified with appropriate pH testing.
      </p>
    </>
  );
}

function VinegarLab({ values, onChange }) {
  const model = useMemo(() => {
    const volumeMl = Math.max(0, numeric(values.volumeMl));
    const alcoholPct = clamp(0, numeric(values.alcoholPct), 18);
    const tempF = numeric(values.tempF, 78);
    const oxygenFactor = values.oxygen === "aerated" ? 1.35 : values.oxygen === "wide" ? 1 : 0.62;
    const tempFactor = tempF < 60
      ? 0.35
      : tempF < 68
        ? 0.65
        : tempF <= 85
          ? 1.05
          : tempF <= 90
            ? 0.82
            : 0.45;
    const alcoholFactor = alcoholPct < 4
      ? 0.7
      : alcoholPct <= 7
        ? 1.08
        : alcoholPct <= 9
          ? 0.85
          : 0.45;
    const conversionRate = oxygenFactor * tempFactor * alcoholFactor;
    const estimatedWeeks = clamp(2, 5 / Math.max(conversionRate, 0.18), 16);
    const potentialAcidity = alcoholPct * 0.98;
    const waterToTargetMl = alcoholPct > 8 ? volumeMl * (alcoholPct / 6 - 1) : 0;
    const motherFood = alcoholPct < 5
      ? "Low ABV: thin vinegar unless you start with more alcohol."
      : alcoholPct > 9
        ? "High ABV: dilute toward 5–7% so bacteria are not stunned."
        : "Good ABV range for acetic-acid bacteria.";
    return {
      alcoholFactor,
      conversionRate,
      estimatedWeeks,
      motherFood,
      oxygenFactor,
      potentialAcidity,
      tempFactor,
      waterToTargetMl,
    };
  }, [values]);

  return (
    <>
      <section className="liquid-lab-hero vinegar-hero">
        <div>
          <span className="eyebrow-label">Acetic fermentation</span>
          <h2>Vinegar designer</h2>
          <p>
            Turn an alcoholic base into vinegar by balancing ethanol, oxygen, time, and warmth.
            Acetic-acid bacteria need air: sealed jars make stalled vinegar, not better vinegar.
          </p>
        </div>
        <Droplets size={39} />
      </section>

      <section className="model-controls liquid-model-controls">
        <div className="planner-input-grid">
          <label>
            Base volume ml
            <input type="number" min="0" value={values.volumeMl} onChange={(event) => onChange("volumeMl", event.target.value)} />
          </label>
          <label>
            Starting alcohol %
            <input type="number" min="0" max="18" step="0.1" value={values.alcoholPct} onChange={(event) => onChange("alcoholPct", event.target.value)} />
          </label>
          <label>
            Ferment temp °F
            <input type="number" min="45" max="100" value={values.tempF} onChange={(event) => onChange("tempF", event.target.value)} />
          </label>
          <label>
            Oxygen setup
            <select value={values.oxygen} onChange={(event) => onChange("oxygen", event.target.value)}>
              <option value="wide">Wide-mouth cloth cover</option>
              <option value="narrow">Narrow jar / low surface area</option>
              <option value="aerated">Gentle aeration / frequent stirring</option>
            </select>
          </label>
          <label>
            Planned weeks
            <input type="number" min="1" max="24" step="1" value={values.weeks} onChange={(event) => onChange("weeks", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="liquid-result-grid" aria-label="Vinegar calculations">
        <ResultCard label="Potential acidity" value={`${model.potentialAcidity.toFixed(1)}%`} detail="Approximate acetic acid ceiling from alcohol" tone={model.potentialAcidity >= 4.5 ? "safe" : "warning"} />
        <ResultCard label="Estimated conversion" value={`${formatAmount(model.estimatedWeeks, 1)} wk`} detail={`Oxygen ${model.oxygenFactor.toFixed(2)}× · temp ${model.tempFactor.toFixed(2)}×`} />
        <ResultCard label="Ferment pace" value={`${model.conversionRate.toFixed(2)}×`} detail={model.motherFood} />
        <ResultCard label="Dilution helper" value={model.waterToTargetMl > 0 ? `${formatAmount(model.waterToTargetMl)} ml` : "None"} detail={model.waterToTargetMl > 0 ? "Add water to target ~6% ABV" : "ABV already in a usable zone"} />
      </section>

      <section className="science-curves liquid-science-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label">Chemistry model</span><h2>Ethanol + oxygen → acetic acid</h2></div>
          <Beaker size={22} />
        </div>
        <div className="liquid-effect-grid">
          <EffectCard title="Oxygen is the throttle" body="Acetic-acid bacteria are aerobic. A wide mouth, cloth cover, and occasional movement increase oxygen transfer." />
          <EffectCard title="Alcohol is the feedstock" body="Too little alcohol makes weak vinegar; too much alcohol can inhibit the culture. A 5–7% starting range is a practical design zone." />
          <EffectCard title="pH is not acidity" body="pH tells sharpness and microbial pressure. Titratable acidity tells vinegar strength for labeling, consistency, and selling." />
          <EffectCard title="Heat is a stress knob" body="Warm rooms move faster, but high heat can stress the bacteria and flatten aroma." />
        </div>
      </section>

      <SafetyCallout>
        Do not seal active vinegar ferments. For customer-ready vinegar, test acidity/pH with proper equipment
        and follow your local food-sale rules.
      </SafetyCallout>
    </>
  );
}

function OilLab({ values, onChange }) {
  const model = useMemo(() => {
    const oilMl = Math.max(0, numeric(values.oilMl));
    const tempF = numeric(values.tempF, 70);
    const hours = Math.max(0, numeric(values.hours));
    const methodFactor = values.method === "warm" ? 2.4 : values.method === "heated" ? 3.1 : 1;
    const tempFactor = values.method === "cold"
      ? 1
      : tempF < 110
        ? 1.25
        : tempF <= 140
          ? 1.7
          : tempF <= 160
            ? 1.45
            : 0.85;
    const extractionScore = clamp(5, hours * methodFactor * tempFactor * 2.2, 100);
    const risk = {
      "dried-herbs": {
        label: "Lower water risk",
        storage: "Date it; refrigerate for conservative bakery use.",
        effect: "Dried herbs give cleaner oil and less microbial risk because water activity is lower.",
      },
      "fresh-garlic-herbs": {
        label: "High botulism risk",
        storage: "Refrigerate and discard after 4 days.",
        effect: "Fresh garlic and herbs carry water and soil-contact risk inside an oxygen-poor oil layer.",
      },
      "fresh-chiles": {
        label: "Medium-high water risk",
        storage: "Refrigerate; use quickly unless acidified and verified.",
        effect: "Fresh chiles bring water into the oil system; dried chiles are cleaner for shelf planning.",
      },
      "citrus-peel": {
        label: "Medium moisture risk",
        storage: "Dry peel first for longer holding; refrigerate fresh-peel oils.",
        effect: "Zest oils extract beautifully, but fresh peel still carries moisture and microbes.",
      },
      "roasted-spices": {
        label: "Lower water risk",
        storage: "Keep cool, dark, dated, and protected from oxygen.",
        effect: "Toasting releases fat-soluble aromatics; too much heat adds bitterness and oxidation.",
      },
    }[values.ingredient];
    const aromaWindow = values.method === "cold"
      ? "12–72 hours"
      : values.method === "warm"
        ? "1–4 hours"
        : "15–45 minutes";
    const batchYield = oilMl * 0.96;
    return {
      aromaWindow,
      batchYield,
      extractionScore,
      risk,
      tempFactor,
    };
  }, [values]);

  return (
    <>
      <section className="liquid-lab-hero oil-hero">
        <div>
          <span className="eyebrow-label">Infusion, not fermentation</span>
          <h2>Infused oil designer</h2>
          <p>
            Oils extract fat-soluble flavor compounds; they do not ferment. The science here is
            extraction speed, oxidation, water activity, and botulism prevention.
          </p>
        </div>
        <Sparkles size={39} />
      </section>

      <section className="model-controls liquid-model-controls">
        <div className="planner-input-grid">
          <label>
            Oil volume ml
            <input type="number" min="0" value={values.oilMl} onChange={(event) => onChange("oilMl", event.target.value)} />
          </label>
          <label>
            Ingredient type
            <select value={values.ingredient} onChange={(event) => onChange("ingredient", event.target.value)}>
              <option value="dried-herbs">Dried herbs or dried chiles</option>
              <option value="fresh-garlic-herbs">Fresh garlic or fresh herbs</option>
              <option value="fresh-chiles">Fresh chiles</option>
              <option value="citrus-peel">Citrus peel / zest</option>
              <option value="roasted-spices">Roasted spices</option>
            </select>
          </label>
          <label>
            Method
            <select value={values.method} onChange={(event) => onChange("method", event.target.value)}>
              <option value="cold">Cold infusion</option>
              <option value="warm">Warm infusion</option>
              <option value="heated">Quick heated extraction</option>
            </select>
          </label>
          <label>
            Oil temp °F
            <input type="number" min="40" max="190" value={values.tempF} onChange={(event) => onChange("tempF", event.target.value)} />
          </label>
          <label>
            Infusion time hours
            <input type="number" min="0" max="168" step="0.25" value={values.hours} onChange={(event) => onChange("hours", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="liquid-result-grid" aria-label="Infused oil calculations">
        <ResultCard label="Usable yield" value={`${formatAmount(model.batchYield)} ml`} detail="Assumes about 4% loss to solids and filtering" />
        <ResultCard label="Aroma extraction" value={`${formatAmount(model.extractionScore)}%`} detail={`Best checked around ${model.aromaWindow}`} />
        <ResultCard label="Risk class" value={model.risk.label} detail={model.risk.storage} tone={model.risk.label.includes("High") ? "warning" : "safe"} />
        <ResultCard label="Heat effect" value={`${model.tempFactor.toFixed(2)}×`} detail="Higher heat extracts faster but can oxidize delicate aromatics" />
      </section>

      <section className="science-curves liquid-science-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label">Extraction model</span><h2>Flavor and safety effects</h2></div>
          <Beaker size={22} />
        </div>
        <div className="liquid-meter-row">
          <span>Mild</span>
          <div className="liquid-meter amber"><i style={{ width: `${model.extractionScore}%` }} /></div>
          <span>Strong</span>
        </div>
        <div className="liquid-effect-grid">
          <EffectCard title="Oil blocks oxygen" body="That protects aromas, but it also creates the low-oxygen condition where unsafe fresh inclusions can become dangerous." />
          <EffectCard title="Water is the enemy" body={model.risk.effect} />
          <EffectCard title="pH belongs to the water phase" body="Oil itself does not have a useful pH reading. For marinated oil products, test the solid or aqueous phase, not the oil layer." />
          <EffectCard title="Heat trades speed for freshness" body="Warm oil pulls flavor fast. Too hot and you lose bright aromatics, increase bitterness, and shorten shelf life." />
        </div>
      </section>

      <SafetyCallout>
        Fresh garlic/herb oils need refrigeration and a short hold. If a jar smells fine, that does not prove it is safe.
        Botulinum toxin cannot be reliably detected by sight, smell, or taste.
      </SafetyCallout>
    </>
  );
}

function SafetyLogLab({
  logs = [],
  onDelete = () => {},
  onSave = () => {},
}) {
  const [draft, setDraft] = useState(defaultSafetyDraft);
  const findings = safetyFindings(draft);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function saveLog(event) {
    event.preventDefault();
    onSave({
      ...draft,
      ph: String(draft.ph).trim(),
      saltPct: String(draft.saltPct).trim(),
      quantity: String(draft.quantity).trim(),
      shelfLifeDays: Math.max(0, Number(draft.shelfLifeDays || 0)),
      findings: safetyFindings(draft),
    });
    setDraft(defaultSafetyDraft());
  }

  return (
    <>
      <section className="liquid-lab-hero safety-log-hero">
        <div>
          <span className="eyebrow-label">Traceability</span>
          <h2>Batch safety log</h2>
          <p>
            Keep the boring-but-important facts: pH, salt percentage, batch date,
            shelf life, storage instructions, warning notes, and recall notes.
          </p>
        </div>
        <ClipboardCheck size={39} />
      </section>

      <form className="safety-log-form" onSubmit={saveLog}>
        <section className="model-controls liquid-model-controls">
          <div className="planner-input-grid">
            <label>
              Product type
              <select value={draft.productType} onChange={(event) => update("productType", event.target.value)}>
                {SAFETY_PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label>
              Batch name
              <input required value={draft.batchName} onChange={(event) => update("batchName", event.target.value)} placeholder="Blueberry ghost pepper sauce" />
            </label>
            <label>
              Lot / batch code
              <input value={draft.lotCode} onChange={(event) => update("lotCode", event.target.value)} />
            </label>
            <label>
              Batch date
              <input type="date" value={draft.batchDate} onChange={(event) => update("batchDate", event.target.value)} />
            </label>
            <label>
              Quantity made
              <input value={draft.quantity} onChange={(event) => update("quantity", event.target.value)} placeholder={`12 ${SAFETY_PRODUCT_TYPES.find((type) => type.value === draft.productType)?.unit || "items"}`} />
            </label>
            <label>
              Measured pH
              <input type="number" min="0" max="14" step="0.01" value={draft.ph} onChange={(event) => update("ph", event.target.value)} placeholder={draft.productType === "infused_oil" ? "N/A for oil layer" : "4.10"} />
            </label>
            <label>
              Salt %
              <input type="number" min="0" max="20" step="0.1" value={draft.saltPct} onChange={(event) => update("saltPct", event.target.value)} placeholder={draft.productType === "hot_sauce" ? "3.0" : "Optional"} />
            </label>
            <label>
              Shelf life days
              <input type="number" min="0" max="730" value={draft.shelfLifeDays} onChange={(event) => update("shelfLifeDays", event.target.value)} />
            </label>
          </div>
          <div className="safety-textarea-grid">
            <label>Storage instructions<textarea value={draft.storageInstructions} onChange={(event) => update("storageInstructions", event.target.value)} placeholder="Refrigerate, keep capped, discard after opening date…" /></label>
            <label>Warning notes<textarea value={draft.warningNotes} onChange={(event) => update("warningNotes", event.target.value)} placeholder="Fresh garlic oil, heat level, cap pressure, allergen/storage warnings…" /></label>
            <label>Batch recall notes<textarea value={draft.recallNotes} onChange={(event) => update("recallNotes", event.target.value)} placeholder="Ingredient lots, pH meter calibration, where bottles went, pull instructions…" /></label>
          </div>
        </section>

        <section className="safety-status-panel">
          <div className="section-title-line">
            <div><span className="eyebrow-label">Review before saving</span><h2>Safety flags</h2></div>
            <ShieldCheck size={20} />
          </div>
          <div className="safety-finding-list">
            {findings.map((finding, index) => (
              <span className={`safety-finding ${finding.tone}`} key={`${finding.tone}-${index}`}>
                {finding.tone === "safe" ? <PackageCheck size={14} /> : finding.tone === "info" ? <Info size={14} /> : <AlertTriangle size={14} />}
                {finding.text}
              </span>
            ))}
          </div>
          <button className="primary-button" type="submit"><Save size={16} /> Save batch safety log</button>
        </section>
      </form>

      <section className="saved-safety-log-panel">
        <div className="section-title-line">
          <div><span className="eyebrow-label">Saved records</span><h2>Recent safety logs</h2></div>
          <CalendarDays size={20} />
        </div>
        {logs.length ? (
          <div className="saved-safety-log-list">
            {logs.map((log) => {
              const logFindings = Array.isArray(log.findings) && log.findings.length
                ? log.findings
                : safetyFindings(log);
              const topFinding = logFindings.find((finding) => finding.tone === "danger")
                || logFindings.find((finding) => finding.tone === "warning")
                || logFindings[0];
              return (
                <article className="saved-safety-log-card" key={log.id}>
                  <div>
                    <span className={`safety-log-type ${topFinding?.tone || "info"}`}>{productTypeLabel(log.productType)}</span>
                    <h3>{log.batchName}</h3>
                    <small>{log.lotCode || "No lot code"} · {log.batchDate || "No date"} · shelf life {log.shelfLifeDays || 0} days</small>
                  </div>
                  <div className="safety-log-measures">
                    <span><small>pH</small><strong>{log.ph || "—"}</strong></span>
                    <span><small>Salt</small><strong>{log.saltPct ? `${log.saltPct}%` : "—"}</strong></span>
                    <span><small>Qty</small><strong>{log.quantity || "—"}</strong></span>
                  </div>
                  {topFinding ? <p>{topFinding.text}</p> : null}
                  {log.storageInstructions ? <p><b>Storage:</b> {log.storageInstructions}</p> : null}
                  {log.warningNotes ? <p><b>Warnings:</b> {log.warningNotes}</p> : null}
                  {log.recallNotes ? <p><b>Recall:</b> {log.recallNotes}</p> : null}
                  <button className="storage-file-button" type="button" onClick={() => onDelete(log.id)}><Trash2 size={14} /> Delete log</button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-safety-log">
            <ClipboardCheck size={22} />
            <strong>No liquid safety batches saved yet.</strong>
            <span>Use this for sauces, vinegars, infused oils, and any batch you might need to trace later.</span>
          </div>
        )}
      </section>
    </>
  );
}

function ResultCard({ label, value, detail, tone }) {
  return (
    <article className={tone ? `liquid-result-card ${tone}` : "liquid-result-card"}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EffectCard({ title, body }) {
  return (
    <article className="liquid-effect-card">
      <strong>{title}</strong>
      <p>{body}</p>
    </article>
  );
}

function SafetyCallout({ children }) {
  return (
    <div className="warning-callout liquid-safety-callout">
      <AlertTriangle size={18} />
      <span>{children}</span>
    </div>
  );
}

export default function LiquidPage({
  liquidSafetyLogs = [],
  onDeleteLiquidSafetyLog = () => {},
  onSaveLiquidSafetyLog = () => {},
}) {
  const [view, setView] = useState("hot-sauce");
  const [hotSauce, setHotSauce] = useState({
    days: 10,
    produceG: 1000,
    saltPct: 3,
    style: "mash",
    targetPh: 4,
    tempF: 72,
    waterG: 150,
  });
  const [vinegar, setVinegar] = useState({
    alcoholPct: 6,
    oxygen: "wide",
    tempF: 78,
    volumeMl: 1000,
    weeks: 6,
  });
  const [oil, setOil] = useState({
    hours: 24,
    ingredient: "dried-herbs",
    method: "cold",
    oilMl: 500,
    tempF: 70,
  });

  const heading = view === "hot-sauce"
    ? ["Liquid lab", "Hot sauce salt, pH, and fermentation timing"]
    : view === "vinegar"
      ? ["Vinegar designer", "Alcohol, oxygen, acidity, and conversion pacing"]
      : view === "oil"
        ? ["Infused oils", "Extraction, aroma, and water-risk controls"]
        : ["Safety log", "pH, salt, shelf life, storage, warnings, and recall notes"];

  return (
    <main className="page liquid-page">
      <PageHeading title={heading[0]} subtitle={heading[1]} />

      <div className="view-switch liquid-view-switch">
        <button className={view === "hot-sauce" ? "selected" : ""} onClick={() => setView("hot-sauce")}>Hot sauce</button>
        <button className={view === "vinegar" ? "selected" : ""} onClick={() => setView("vinegar")}>Vinegar</button>
        <button className={view === "oil" ? "selected" : ""} onClick={() => setView("oil")}>Oils</button>
        <button className={view === "safety" ? "selected" : ""} onClick={() => setView("safety")}>Safety log</button>
      </div>

      {view === "hot-sauce" ? (
        <HotSauceLab
          values={hotSauce}
          onChange={(key, value) => setHotSauce((current) => ({ ...current, [key]: value }))}
        />
      ) : null}
      {view === "vinegar" ? (
        <VinegarLab
          values={vinegar}
          onChange={(key, value) => setVinegar((current) => ({ ...current, [key]: value }))}
        />
      ) : null}
      {view === "oil" ? (
        <OilLab
          values={oil}
          onChange={(key, value) => setOil((current) => ({ ...current, [key]: value }))}
        />
      ) : null}
      {view === "safety" ? (
        <SafetyLogLab
          logs={liquidSafetyLogs}
          onDelete={onDeleteLiquidSafetyLog}
          onSave={onSaveLiquidSafetyLog}
        />
      ) : null}

      <section className="liquid-reference-card">
        <Info size={18} />
        <p>
          These are planning calculators, not a food-safety certification. For customer products,
          use calibrated pH/acidity testing and local food-sale guidance. Oils with fresh garlic or
          herbs should be refrigerated and discarded after 4 days.
        </p>
      </section>

      <section className="liquid-quick-science">
        <span><Thermometer size={14} /> Temperature changes microbe speed.</span>
        <span><Gauge size={14} /> pH and acidity are related, but not the same measurement.</span>
        <span><Droplets size={14} /> Water phase controls microbial risk; oil mostly carries aroma.</span>
      </section>
    </main>
  );
}
