import {
  Check,
  CheckCircle2,
  Circle,
  MessageCircle,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BAKE_PHASES, normalizedBakeProgress } from "../lib/bakeProgress";
import { lookupCustomerOrder, submitCustomerFeedback } from "../lib/cloud";

// checkout-flow-v1

const STATUS_LABELS = {
  requested: "Awaiting baker approval",
  accepted: "Accepted",
  scheduled: "Scheduled",
  ready: "Ready for pickup",
  completed: "Completed",
  declined: "Unable to accept",
  cancelled: "Cancelled",
};

function pickupLabel(value) {
  if (!value) return "Pickup time is still being arranged";
  return new Date(value).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CustomerOrderLookup({
  configured,
  feedbackEnabled = true,
  initialCode = "",
  initialContact = "",
  slug,
}) {
  const [form, setForm] = useState({ code: initialCode, contact: initialContact });
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "suggestion", rating: 5, message: "" });
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const runLookup = useCallback(async ({ quiet = false } = {}) => {
    if (!configured || !form.code.trim() || !form.contact.trim()) return;
    if (!quiet) setLoading(true);
    if (!quiet) setError("");
    try {
      const result = await lookupCustomerOrder({
        slug,
        requestCode: form.code.trim(),
        contact: form.contact.trim(),
      });
      if (!result) {
        if (!quiet) setError("Order not found. Check the request code and email or phone.");
        setLookup(null);
        return;
      }
      setLookup(result);
    } catch (nextError) {
      if (!quiet) setError(nextError.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [configured, form.code, form.contact, slug]);

  useEffect(() => {
    if (initialCode && initialContact && configured) runLookup();
  }, [configured, initialCode, initialContact, runLookup]);

  useEffect(() => {
    if (!lookup) return undefined;
    const timer = window.setInterval(() => runLookup({ quiet: true }), 12000);
    return () => window.clearInterval(timer);
  }, [lookup, runLookup]);

  const progress = useMemo(
    () => normalizedBakeProgress(lookup?.bake_progress),
    [lookup?.bake_progress],
  );
  const completedPhases = BAKE_PHASES.filter((phase) => progress[phase.id]).length;
  const progressPercent = Math.round(completedPhases / BAKE_PHASES.length * 100);
  const nextPhase = BAKE_PHASES.find((phase) => !progress[phase.id]);

  async function submitLookup(event) {
    event.preventDefault();
    await runLookup();
  }

  async function sendFeedback(event) {
    event.preventDefault();
    setFeedbackMessage("");
    setError("");
    try {
      await submitCustomerFeedback({
        slug,
        requestCode: form.code.trim(),
        contact: form.contact.trim(),
        feedbackType: feedback.type,
        rating: feedback.rating,
        message: feedback.message.trim(),
      });
      setFeedback((current) => ({ ...current, message: "" }));
      setFeedbackMessage(feedback.type === "review" ? "Thank you for the review." : "Suggestion sent to the baker.");
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  return (
    <section className="customer-tracking" aria-label="Track a bread order">
      <div className="customer-section-heading">
        <div><h2>Track my bake</h2><p>Use your request code plus the email or phone used when ordering.</p></div>
      </div>
      <form className="tracking-lookup-form" onSubmit={submitLookup}>
        <label>Request code<input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="Example: A1B2C3D4" /></label>
        <label>Email or phone<input required value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="Used on your order" /></label>
        <button className="secondary-button" type="submit" disabled={!configured || loading}>
          {loading ? <RefreshCw className="spin" size={15} /> : <Search size={15} />} Look up order
        </button>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {lookup ? (
        <div className="customer-order-status">
          <div className="track-bake-hero">
            <span><small>Request {lookup.request_code}</small><strong>{STATUS_LABELS[lookup.status] || lookup.status}</strong></span>
            <div>
              <span><b style={{ width: `${progressPercent}%` }} /></span>
              <small>{progressPercent}% complete · {nextPhase ? `Next: ${nextPhase.label}` : "Bake complete"}</small>
            </div>
          </div>
          <span className={`customer-status-pill status-${lookup.status}`}>{completedPhases}/{BAKE_PHASES.length} phases checked off</span>
          <div className="customer-status-facts">
            <span><small>Pickup</small><strong>{pickupLabel(lookup.pickup_at)}</strong></span>
            <span><small>Order</small><strong>{(lookup.items || []).map((item) => `${item.quantity} × ${item.sale_option_label || item.product_name}${item.sale_option_label ? ` ${item.product_name}` : ""}`).join(" · ")}</strong></span>
            <span><small>Location</small><strong>{lookup.pickup_location}</strong></span>
          </div>
          {lookup.baker_notes ? <aside className="customer-baker-comment"><MessageCircle size={17} /><span><small>Baker comment</small><strong>{lookup.baker_notes}</strong></span></aside> : null}
          <aside className="track-next-step">
            <CheckCircle2 size={18} />
            <span><small>Next checkpoint</small><strong>{nextPhase ? `${nextPhase.label}: ${nextPhase.detail}` : "Your bake is marked complete."}</strong></span>
          </aside>

          <div className="customer-progress-heading">
            <span><strong>Live bake progress</strong><small>Updates automatically about every 12 seconds.</small></span>
            <button type="button" onClick={() => runLookup()} aria-label="Refresh bake progress"><RefreshCw size={15} /></button>
          </div>
          <div className="customer-progress-list">
            {BAKE_PHASES.map((phase) => (
              <div className={progress[phase.id] ? "customer-progress-step complete" : "customer-progress-step"} key={phase.id}>
                <span>{progress[phase.id] ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
                <span><strong>{phase.label}</strong><small>{phase.detail}</small></span>
              </div>
            ))}
          </div>

          {feedbackEnabled ? <form className="customer-feedback-form" onSubmit={sendFeedback}>
            <div className="customer-feedback-switch">
              <button type="button" className={feedback.type === "suggestion" ? "selected" : ""} onClick={() => setFeedback({ ...feedback, type: "suggestion" })}><MessageCircle size={14} /> Suggestion</button>
              <button type="button" className={feedback.type === "review" ? "selected" : ""} onClick={() => setFeedback({ ...feedback, type: "review" })}><Star size={14} /> Review</button>
            </div>
            {feedback.type === "review" ? (
              <fieldset className="customer-rating">
                <legend>Your rating</legend>
                <div>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button type="button" className={rating <= feedback.rating ? "selected" : ""} key={rating} onClick={() => setFeedback({ ...feedback, rating })} aria-label={`${rating} stars`}><Star size={18} /></button>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label>{feedback.type === "review" ? "Review" : "Suggestion"}<textarea required value={feedback.message} onChange={(event) => setFeedback({ ...feedback, message: event.target.value })} placeholder={feedback.type === "review" ? "How was your bread and pickup experience?" : "What could Loafers improve or offer next?"} /></label>
            {feedback.type === "review" ? <p className="customer-review-disclosure">Reviews appear publicly using your first name and last initial.</p> : null}
            <button className="secondary-button" type="submit"><Check size={15} /> Send {feedback.type}</button>
            {feedbackMessage ? <p className="feedback-success">{feedbackMessage}</p> : null}
          </form> : null}
        </div>
      ) : null}
    </section>
  );
}
