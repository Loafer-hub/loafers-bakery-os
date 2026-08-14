import {
  ArrowLeft,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { analyzeStarterRise } from "../lib/cloud";

const PHOTO_SLOTS = [
  { id: "initial", label: "Initial", note: "Baseline before the first fold" },
  { id: "fold-1", label: "Fold 1", note: "Photo after the first fold" },
  { id: "fold-2", label: "Fold 2", note: "Photo after the second fold" },
  { id: "fold-3", label: "Fold 3", note: "Photo after the third fold" },
  { id: "fold-4", label: "Fold 4", note: "Photo after the fourth fold" },
  { id: "final", label: "Final check", note: "Optional photo before shaping" },
];

function resizeRisePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Choose an image file for each rise check."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const source = String(reader.result || "");
      const image = new window.Image();
      image.onerror = () => reject(new Error(`Could not prepare ${file.name}.`));
      image.onload = () => {
        const maxEdge = 1100;
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error(`Could not resize ${file.name}.`));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL("image/jpeg", 0.78),
          fileName: file.name,
          width: canvas.width,
          height: canvas.height,
          capturedAt: new Date().toISOString(),
        });
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

function timeLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function elapsedLabel(from, to) {
  if (!from || !to) return "";
  const minutes = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
  if (minutes < 60) return `${minutes} min after baseline`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""} after baseline`;
}

function confidenceLabel(value) {
  const clean = String(value || "").toLowerCase();
  if (clean === "high") return "High confidence";
  if (clean === "medium") return "Medium confidence";
  return "Low confidence";
}

export default function RiseReviewWorkspace({ bakeryId, onBack }) {
  const [photos, setPhotos] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionName, setSessionName] = useState("");

  const uploadedSlots = useMemo(() => PHOTO_SLOTS.filter((slot) => photos[slot.id]), [photos]);
  const baseline = photos.initial;
  const resultBySlot = useMemo(() => Object.fromEntries(
    (analysis?.assessments || []).map((item) => [item.slotId, item]),
  ), [analysis]);
  const canAnalyze = Boolean(bakeryId && baseline && uploadedSlots.length > 1 && !isAnalyzing && !isPreparing);

  async function prepareFiles(files, preferredSlotId = "") {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    const openSlotIds = preferredSlotId
      ? [preferredSlotId]
      : PHOTO_SLOTS.filter((slot) => !photos[slot.id]).map((slot) => slot.id);
    if (!openSlotIds.length) {
      setError("All six photo slots are full. Replace a photo or clear the review first.");
      return;
    }
    if (incoming.length > openSlotIds.length) {
      setError(`This review has room for ${openSlotIds.length} more photo${openSlotIds.length === 1 ? "" : "s"}.`);
      return;
    }

    setError("");
    setIsPreparing(true);
    try {
      const prepared = await Promise.all(incoming.map(resizeRisePhoto));
      setPhotos((current) => {
        const next = { ...current };
        prepared.forEach((photo, index) => {
          next[openSlotIds[index]] = photo;
        });
        return next;
      });
      setAnalysis(null);
    } catch (uploadError) {
      setError(uploadError?.message || "One of those photos could not be prepared.");
    } finally {
      setIsPreparing(false);
    }
  }

  function removePhoto(slotId) {
    setPhotos((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
    setAnalysis(null);
    setError("");
  }

  async function runAnalysis() {
    if (!baseline) {
      setError("Add the Initial photo first so AI has a baseline.");
      return;
    }
    if (uploadedSlots.length < 2) {
      setError("Add at least one fold or final photo to compare with the Initial photo.");
      return;
    }
    if (!bakeryId) {
      setError("Sign into the owner cloud account before running AI Rise Review.");
      return;
    }

    setError("");
    setIsAnalyzing(true);
    try {
      const response = await analyzeStarterRise({
        bakeryId,
        sessionName: sessionName.trim(),
        photos: uploadedSlots.map((slot) => ({
          slotId: slot.id,
          label: slot.label,
          capturedAt: photos[slot.id].capturedAt,
          image: photos[slot.id].dataUrl,
        })),
      });
      setAnalysis(response);
    } catch (analysisError) {
      setError(analysisError?.message || "Rise Review could not analyze these photos.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function clearReview() {
    if (uploadedSlots.length && !window.confirm("Clear all Rise Review photos and AI results for this bake?")) return;
    setPhotos({});
    setAnalysis(null);
    setError("");
    setSessionName("");
  }

  return (
    <main className="page resource-hub-page rise-review-page">
      <header className="rise-review-heading">
        <div>
          <span className="eyebrow-label dark">Owner resources · visual fermentation</span>
          <h1>Rise Review</h1>
          <p>Compare one baseline photo with Fold 1–4 and an optional final check. AI estimates rise relative to the Initial photo.</p>
        </div>
        <button className="resource-back-button" type="button" onClick={onBack}>
          <ArrowLeft size={18} />
          Back to hub
        </button>
      </header>

      <section className="rise-review-guide" aria-label="Photo guidance">
        <div><Camera size={23} /><span><strong>Keep the view repeatable.</strong><small>Use the same straight-sided container, angle, distance, and lighting.</small></span></div>
        <div><TrendingUp size={23} /><span><strong>Rise means growth over baseline.</strong><small>100% rise means the dough appears twice as high or voluminous as the Initial photo.</small></span></div>
        <div><ShieldCheck size={23} /><span><strong>Estimate, then verify by feel.</strong><small>Use dough strength, bubbles, doming, and handling—not the percentage alone.</small></span></div>
      </section>

      <section className="rise-review-toolbar">
        <label>
          Bake / dough name
          <input
            type="text"
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            placeholder="Saturday country loaf"
          />
        </label>
        <label className="rise-review-bulk-upload">
          <ImagePlus size={18} />
          {isPreparing ? "Preparing photos…" : "Upload up to 6 photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isPreparing || isAnalyzing}
            onChange={(event) => {
              prepareFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        <button className="rise-review-clear" type="button" onClick={clearReview} disabled={!uploadedSlots.length && !analysis}>
          <Trash2 size={17} />
          Clear after bake
        </button>
      </section>

      <section className="rise-review-slots" aria-label="Rise Review photos">
        {PHOTO_SLOTS.map((slot, index) => {
          const photo = photos[slot.id];
          const result = resultBySlot[slot.id];
          return (
            <article className={`rise-photo-card${photo ? " has-photo" : ""}${slot.id === "initial" ? " baseline" : ""}`} key={slot.id}>
              <header>
                <span className="rise-photo-number">{index + 1}</span>
                <span><strong>{slot.label}</strong><small>{slot.note}</small></span>
                {photo ? (
                  <button type="button" onClick={() => removePhoto(slot.id)} aria-label={`Remove ${slot.label} photo`}><X size={16} /></button>
                ) : null}
              </header>

              {photo ? (
                <figure>
                  <img src={photo.dataUrl} alt={`${slot.label} dough rise check`} />
                  <figcaption>
                    <span><Clock3 size={13} />{timeLabel(photo.capturedAt)}</span>
                    {slot.id !== "initial" ? <span>{elapsedLabel(baseline?.capturedAt, photo.capturedAt)}</span> : <span>Baseline</span>}
                  </figcaption>
                </figure>
              ) : (
                <label className="rise-photo-empty">
                  <Camera size={25} />
                  <strong>Add {slot.label} photo</strong>
                  <small>Camera or photo library</small>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={isPreparing || isAnalyzing}
                    onChange={(event) => {
                      prepareFiles(event.target.files, slot.id);
                      event.target.value = "";
                    }}
                  />
                </label>
              )}

              {photo ? (
                <label className="rise-photo-replace">
                  <RefreshCcw size={14} /> Replace photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={isPreparing || isAnalyzing}
                    onChange={(event) => {
                      prepareFiles(event.target.files, slot.id);
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : null}

              {slot.id === "initial" && photo ? (
                <div className="rise-result baseline-result"><CheckCircle2 size={17} /><span><strong>0% baseline</strong><small>All later photos compare with this image.</small></span></div>
              ) : result ? (
                <div className={`rise-result confidence-${result.confidence || "low"}`}>
                  <TrendingUp size={18} />
                  <span>
                    <strong>{Math.round(Number(result.risePercent) || 0)}% estimated rise</strong>
                    <small>{confidenceLabel(result.confidence)} · {result.observation}</small>
                  </span>
                </div>
              ) : photo ? <div className="rise-result pending-result"><span>Ready for comparison</span></div> : null}
            </article>
          );
        })}
      </section>

      <section className="rise-review-analysis-bar">
        <div>
          <BrainCircuit size={24} />
          <span><strong>{uploadedSlots.length} of 6 photos ready</strong><small>Photos are sent for analysis only and are not stored in Loafers cloud records.</small></span>
        </div>
        <button type="button" onClick={runAnalysis} disabled={!canAnalyze}>
          {isAnalyzing ? <LoaderCircle className="spin" size={19} /> : <BrainCircuit size={19} />}
          {isAnalyzing ? "Assessing rise…" : "Analyze rise"}
        </button>
      </section>

      {error ? <p className="rise-review-error" role="alert">{error}</p> : null}
      {analysis ? (
        <section className="rise-review-summary">
          <div className="section-title-line"><div><span className="eyebrow-label dark">AI review</span><h2>What the photos suggest</h2></div><BrainCircuit size={24} /></div>
          <p>{analysis.summary}</p>
          {analysis.cautions?.length ? <ul>{analysis.cautions.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          <small>AI image review is an estimate, not a measurement or food-safety decision.</small>
        </section>
      ) : null}
    </main>
  );
}
