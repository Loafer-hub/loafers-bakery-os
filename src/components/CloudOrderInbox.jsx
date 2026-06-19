import { Cloud, Download, RefreshCw, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  acceptCustomerOrderRequest,
  listCustomerOrderRequests,
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bakeryId = cloudAccount.workspace?.bakeryId;

  const refresh = useCallback(async () => {
    if (!bakeryId) return;
    setLoading(true);
    setError("");
    try {
      const nextRequests = await listCustomerOrderRequests(bakeryId);
      const imported = new Set(orders.map((order) => order.cloudOrderId).filter(Boolean));
      setRequests(nextRequests.filter((request) => !imported.has(request.id)));
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
      onImportOrder(request);
      await acceptCustomerOrderRequest(request.id);
      setRequests((current) => current.filter((item) => item.id !== request.id));
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
            <button className="storage-file-button" type="button" onClick={refresh} disabled={loading}><RefreshCw size={15} /> Refresh requests</button>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {!requests.length && !loading ? <p className="cloud-empty-copy">No new requests. Shared customer orders will appear here.</p> : null}
            {requests.map((request) => {
              const items = request.customer_order_items || [];
              return (
                <article className="cloud-request-card" key={request.id}>
                  <div className="cloud-request-heading">
                    <span><strong>{request.customer_name}</strong><small>Request {request.request_code}</small></span>
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
                  <button className="primary-button" type="button" disabled={loading} onClick={() => importRequest(request)}>
                    <Download size={15} /> Accept into Orders
                  </button>
                </article>
              );
            })}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
