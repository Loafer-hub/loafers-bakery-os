import { Cloud, Download, MessageSquareText, RefreshCw, ShoppingBag, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  acceptCustomerOrderRequest,
  commentCustomerOrderRequest,
  listCustomerFeedback,
  listCustomerOrderRequests,
  rejectCustomerOrderRequest,
} from "../lib/cloud";
import { Modal } from "./Primitives";

function pickupLabel(value) {
  if (!value) return "Pickup time to arrange";
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CloudOrderInbox({ cloudAccount, orders, onImportOrder }) {
  const [requests, setRequests] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const bakeryId = cloudAccount.workspace?.bakeryId;

  const refresh = useCallback(async () => {
    if (!bakeryId) return;
    setLoading(true);
    setError("");
    try {
      const [nextRequests, nextRejected, nextFeedback] = await Promise.all([
        listCustomerOrderRequests(bakeryId, "requested"),
        listCustomerOrderRequests(bakeryId, "declined"),
        listCustomerFeedback(bakeryId),
      ]);
      const imported = new Set(orders.map((order) => order.cloudOrderId).filter(Boolean));
      const pending = nextRequests.filter((request) => !imported.has(request.id));
      setRequests(pending);
      setRejected(nextRejected);
      setFeedback(nextFeedback);
      setComments((current) => Object.fromEntries(pending.map((request) => [
        request.id,
        current[request.id] ?? request.baker_notes ?? "",
      ])));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }, [bakeryId, orders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!bakeryId) return null;

  async function importRequest(request) {
    setLoading(true);
    setError("");
    try {
      const requestWithComment = { ...request, baker_notes: comments[request.id] || "" };
      await acceptCustomerOrderRequest(request.id, comments[request.id] || "");
      onImportOrder(requestWithComment);
      setRequests((current) => current.filter((item) => item.id !== request.id));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveComment(request) {
    setLoading(true);
    setError("");
    try {
      await commentCustomerOrderRequest(request.id, comments[request.id] || "");
      setRequests((current) => current.map((item) => (
        item.id === request.id ? { ...item, baker_notes: comments[request.id] || "" } : item
      )));
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  async function rejectRequest(request) {
    setLoading(true);
    setError("");
    try {
      await rejectCustomerOrderRequest(request.id, comments[request.id] || "");
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setRejected((current) => [{
        ...request,
        status: "declined",
        baker_notes: comments[request.id] || "",
      }, ...current]);
      setRejectingId(null);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className={requests.length ? "cloud-inbox-banner has-orders" : "cloud-inbox-banner"} type="button" onClick={() => setOpen(true)}>
        <span><Cloud size={18} /><span><strong>{requests.length ? `${requests.length} customer request${requests.length === 1 ? "" : "s"}` : "Customer request inbox"}</strong><small>{requests.length ? "Review and bring them into the bake queue." : "No new online requests."}</small></span></span>
        <span>{loading ? <RefreshCw className="spin" size={16} /> : <ShoppingBag size={16} />}</span>
      </button>

      {open ? (
        <Modal title="Customer requests" onClose={() => setOpen(false)}>
          <div className="cloud-request-list">
            <div className="cloud-history-switch" aria-label="Customer request history">
              <button type="button" className={view === "pending" ? "selected" : ""} onClick={() => setView("pending")}>
                Pending <span>{requests.length}</span>
              </button>
              <button type="button" className={view === "rejected" ? "selected" : ""} onClick={() => setView("rejected")}>
                Rejected <span>{rejected.length}</span>
              </button>
              <button type="button" className={view === "feedback" ? "selected" : ""} onClick={() => setView("feedback")}>
                Feedback <span>{feedback.length}</span>
              </button>
            </div>
            <button className="storage-file-button" type="button" onClick={refresh} disabled={loading}><RefreshCw size={15} /> Refresh requests</button>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {view === "pending" && !requests.length && !loading ? <p className="cloud-empty-copy">No new requests. Shared customer orders will appear here.</p> : null}
            {view === "rejected" && !rejected.length && !loading ? <p className="cloud-empty-copy">No rejected requests yet.</p> : null}
            {view === "feedback" && !feedback.length && !loading ? <p className="cloud-empty-copy">No customer suggestions or reviews yet.</p> : null}
            {view === "feedback" ? feedback.map((entry) => (
              <article className="cloud-feedback-card" key={entry.id}>
                <div><span><strong>{entry.customer_name}</strong><small>{entry.feedback_type}</small></span>{entry.rating ? <span className="feedback-rating">{Array.from({ length: entry.rating }, () => "★").join("")}</span> : null}</div>
                <p>{entry.message}</p>
                <small>{new Date(entry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</small>
              </article>
            )) : (view === "pending" ? requests : rejected).map((request) => {
              const items = request.customer_order_items || [];
              const isRejected = view === "rejected";
              return (
                <article className={isRejected ? "cloud-request-card rejected-history-card" : "cloud-request-card"} key={request.id}>
                  <div className="cloud-request-heading">
                    <span><strong>{request.customer_name}</strong><small>{isRejected ? "Rejected" : "Request"} {request.request_code}</small></span>
                    <strong>${(request.subtotal_cents / 100).toFixed(2)}</strong>
                  </div>
                  <p>{items.map((item) => `${item.quantity} × ${item.product_name}`).join(" · ")}</p>
                  <dl>
                    <div><dt>Pickup</dt><dd>{pickupLabel(request.pickup_at)}</dd></div>
                    <div><dt>Contact</dt><dd>{request.customer_email || request.customer_phone}</dd></div>
                    <div><dt>Payment</dt><dd>{request.payment_method || "Arrange later"}</dd></div>
                    <div><dt>Location</dt><dd>{request.pickup_location || "Three Bears, Delta Junction, AK"}</dd></div>
                  </dl>
                  {request.customer_notes ? <blockquote>{request.customer_notes}</blockquote> : null}
                  {request.allergies ? <div className="cloud-allergy-alert"><strong>Allergies</strong><span>{request.allergies}</span></div> : null}
                  {isRejected ? (
                    <div className="rejected-history-note">
                      <strong>Baker comment</strong>
                      <span>{request.baker_notes || "No comment was saved."}</span>
                    </div>
                  ) : (
                    <>
                      <label className="cloud-comment-field">
                        Baker comment
                        <textarea
                          value={comments[request.id] || ""}
                          onChange={(event) => setComments((current) => ({ ...current, [request.id]: event.target.value }))}
                          placeholder="Availability, pickup details, payment reminder…"
                        />
                      </label>
                      <div className="cloud-request-actions">
                        <button className="primary-button" type="button" disabled={loading} onClick={() => importRequest(request)}>
                          <Download size={15} /> Accept
                        </button>
                        <button className="secondary-button" type="button" disabled={loading} onClick={() => saveComment(request)}>
                          <MessageSquareText size={15} /> Comment
                        </button>
                        <button className="reject-request-button" type="button" disabled={loading} onClick={() => setRejectingId(request.id)}>
                          <XCircle size={15} /> Reject
                        </button>
                      </div>
                    </>
                  )}
                  {!isRejected && rejectingId === request.id ? (
                    <div className="reject-request-confirmation">
                      <span>Reject this request? The comment above will be saved with it.</span>
                      <div>
                        <button type="button" className="text-button" onClick={() => setRejectingId(null)}>Keep pending</button>
                        <button type="button" className="danger-button" disabled={loading} onClick={() => rejectRequest(request)}>Reject request</button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
