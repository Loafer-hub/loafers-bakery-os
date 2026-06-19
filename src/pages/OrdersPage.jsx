import { CalendarDays, CheckCircle2, List, MessageSquareText, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { CloudOrderInbox } from "../components/CloudOrderInbox";
import { OrderCalendar } from "../components/OrderCalendar";
import { EmptyState, Modal, Status } from "../components/Primitives";

const filters = ["All", "New", "Paid"];

const sampleCustomers = new Set([
  "Emily Morgan",
  "James Walker",
  "Sophie Lee",
  "Maya Patel",
  "Avery Brooks",
]);

function isSampleOrder(order) {
  return order.isSample === true
    || (Number(order.id) >= 1 && Number(order.id) <= 5 && sampleCustomers.has(order.customer));
}

function defaultPickupInput() {
  const date = new Date();
  const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  date.setHours(10, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function pickupDueLabel(value) {
  if (!value) return "Arrange pickup";
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OrdersPage({
  cloudAccount,
  orders,
  recipes,
  starters,
  starterLogs,
  onAddOrder,
  onClearSampleOrders,
  onDeleteOrder,
  onImportCloudOrder,
  onOpenOrder,
  onUpdateOrder,
  selectedOrderId,
}) {
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailForm, setDetailForm] = useState({ status: "New", notes: "", pickupAt: "" });
  const [form, setForm] = useState({
    customer: "",
    product: "Country Sourdough",
    quantity: 1,
    total: 13,
    pickupAt: defaultPickupInput(),
    status: "New",
  });

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesFilter = filter === "All" || order.status === filter;
      const matchesQuery = !normalized || `${order.customer} ${order.product}`.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, orders, query]);

  const openOrders = orders.filter((order) => order.status !== "Paid").length;
  const bookedRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const sampleOrderCount = orders.filter(isSampleOrder).length;
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);

  useEffect(() => {
    if (!selectedOrder) return;
    setDetailForm({
      status: selectedOrder.status,
      notes: selectedOrder.notes || "",
      pickupAt: selectedOrder.pickupAt
        ? new Date(new Date(selectedOrder.pickupAt).getTime() - new Date(selectedOrder.pickupAt).getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16)
        : "",
    });
    setConfirmDelete(false);
  }, [selectedOrder]);

  function submitOrder(event) {
    event.preventDefault();
    if (!form.customer.trim()) return;
    onAddOrder({
      ...form,
      due: pickupDueLabel(form.pickupAt),
      pickupAt: form.pickupAt ? new Date(form.pickupAt).toISOString() : null,
    });
    setShowAdd(false);
    setForm({
      customer: "",
      product: "Country Sourdough",
      quantity: 1,
      total: 13,
      pickupAt: defaultPickupInput(),
      status: "New",
    });
  }

  function saveDetails(event) {
    event.preventDefault();
    onUpdateOrder(selectedOrder.id, {
      status: detailForm.status,
      notes: detailForm.notes.trim(),
      pickupAt: detailForm.pickupAt ? new Date(detailForm.pickupAt).toISOString() : null,
      due: pickupDueLabel(detailForm.pickupAt),
    });
    onOpenOrder(null);
  }

  return (
    <main className="page">
      <PageHeading
        title="Orders"
        subtitle="Keep commitments clear and capacity honest."
        action={
          <button className="round-action" onClick={() => setShowAdd(true)} aria-label="Add order">
            <Plus size={21} />
          </button>
        }
      />

      <section className="metric-strip" aria-label="Order metrics">
        <div><strong>{orders.length}</strong><span>booked orders</span></div>
        <div><strong>{openOrders}</strong><span>need attention</span></div>
        <div><strong>${bookedRevenue}</strong><span>booked revenue</span></div>
      </section>

      <CloudOrderInbox
        cloudAccount={cloudAccount}
        orders={orders}
        onImportOrder={onImportCloudOrder}
      />

      <div className="orders-view-row">
        <div className="view-switch" aria-label="Order view">
          <button type="button" className={view === "list" ? "selected" : ""} onClick={() => setView("list")}><List size={14} /> List</button>
          <button type="button" className={view === "calendar" ? "selected" : ""} onClick={() => setView("calendar")}><CalendarDays size={14} /> Calendar</button>
        </div>
      </div>

      {sampleOrderCount ? (
        <aside className="sample-record-banner">
          <span><strong>Demo records</strong><small>{sampleOrderCount} sample orders can be safely removed.</small></span>
          <button type="button" onClick={onClearSampleOrders}>
            <Trash2 size={14} />
            Erase samples
          </button>
        </aside>
      ) : null}

      {view === "list" ? <div className="search-row">
        <label className="search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders" />
        </label>
        <div className="segmented-control">
          {filters.map((item) => (
            <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
      </div> : null}

      {view === "calendar" ? (
        <OrderCalendar
          orders={orders}
          recipes={recipes}
          starters={starters}
          starterLogs={starterLogs}
          onOpenOrder={onOpenOrder}
        />
      ) : <section className="order-list">
        {filteredOrders.length ? filteredOrders.map((order) => (
          <button
            className="order-row"
            key={order.id}
            onClick={() => onOpenOrder(order.id)}
            type="button"
            aria-label={`Open order for ${order.customer}`}
          >
            <span className={`avatar avatar-${order.accent}`}>{order.initials}</span>
            <div className="order-main">
              <div className="order-title-line">
                <h3>{order.customer}</h3>
                <strong>${order.total}</strong>
              </div>
              <p>{order.quantity} × {order.product}</p>
              <div className="order-meta">
                <span className="order-due">
                  {order.due}
                  {order.notes ? <MessageSquareText size={13} aria-label="Has notes" /> : null}
                </span>
                <Status tone={order.status === "Paid" ? "success" : order.status === "New" ? "accent" : "neutral"}>
                  {order.status === "Paid" ? <CheckCircle2 size={13} /> : <ShoppingBag size={13} />}
                  {order.status}
                </Status>
              </div>
            </div>
          </button>
        )) : <EmptyState title="No matching orders" body={orders.length ? "Try a different status or customer name." : "Add your first real order with the plus button."} />}
      </section>}

      {showAdd ? (
        <Modal title="New bread order" onClose={() => setShowAdd(false)}>
          <form className="form-stack" onSubmit={submitOrder}>
            <label>
              Customer
              <input
                autoFocus
                value={form.customer}
                onChange={(event) => setForm({ ...form, customer: event.target.value })}
                placeholder="Customer name"
              />
            </label>
            <label>
              Bread
              <select value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })}>
                <option>Country Sourdough</option>
                <option>Whole Wheat</option>
                <option>Seeded Sourdough</option>
                <option>Cheddar Jalapeño</option>
              </select>
            </label>
            <div className="form-grid">
              <label>
                Loaves
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                />
              </label>
              <label>
                Total
                <input
                  type="number"
                  min="0"
                  value={form.total}
                  onChange={(event) => setForm({ ...form, total: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>Pickup<input type="datetime-local" value={form.pickupAt} onChange={(event) => setForm({ ...form, pickupAt: event.target.value })} /></label>
              <label>
                Payment
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option>New</option>
                  <option>Deposit</option>
                  <option>Paid</option>
                </select>
              </label>
            </div>
            <button className="primary-button" type="submit">Add order</button>
          </form>
        </Modal>
      ) : null}

      {selectedOrder ? (
        <Modal title={selectedOrder.customer} onClose={() => onOpenOrder(null)}>
          <form className="form-stack" onSubmit={saveDetails}>
            <div className="order-detail-summary">
              <div><span>Bread</span><strong>{selectedOrder.product}</strong></div>
              <div><span>Loaves</span><strong>{selectedOrder.quantity}</strong></div>
              <div><span>Total</span><strong>${selectedOrder.total}</strong></div>
              <div><span>Due</span><strong>{selectedOrder.due}</strong></div>
            </div>
            <label>
              Pickup date and time
              <input type="datetime-local" value={detailForm.pickupAt} onChange={(event) => setDetailForm({ ...detailForm, pickupAt: event.target.value })} />
            </label>
            <label>
              Payment status
              <select
                value={detailForm.status}
                onChange={(event) => setDetailForm({ ...detailForm, status: event.target.value })}
              >
                <option>New</option>
                <option>Deposit</option>
                <option>Paid</option>
              </select>
            </label>
            <label>
              Baker notes
              <textarea
                value={detailForm.notes}
                onChange={(event) => setDetailForm({ ...detailForm, notes: event.target.value })}
                placeholder="Pickup details, scoring request, allergies, payment reminder…"
              />
            </label>
            <button className="primary-button" type="submit">Save order details</button>
            {confirmDelete ? (
              <div className="delete-confirmation">
                <span>Delete this order permanently?</span>
                <div>
                  <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Keep it</button>
                  <button type="button" className="danger-button" onClick={() => onDeleteOrder(selectedOrder.id)}>Delete order</button>
                </div>
              </div>
            ) : (
              <button className="delete-order-button" type="button" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} />
                Delete this order
              </button>
            )}
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
