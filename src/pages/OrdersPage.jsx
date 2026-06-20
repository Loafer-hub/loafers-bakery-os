import { CalendarDays, CheckCircle2, List, MessageSquareText, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { CloudOrderInbox } from "../components/CloudOrderInbox";
import { OrderCalendar, orderPickupDate } from "../components/OrderCalendar";
import { EmptyState, Modal, Status } from "../components/Primitives";
import { downloadOrderCalendar } from "../lib/orderCalendarExport";
import { MAX_DAILY_LOAVES, orderCapacityForDate } from "../lib/orderCapacity";
import { BAKE_PHASES, normalizedBakeProgress } from "../lib/bakeProgress";

const filters = ["Pending", "Completed", "All"];

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

function localInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
}

function capacityError(status, requestedLoaves) {
  if (!status.key) return "Choose a pickup date and time.";
  if (status.feedReserved) return "That day is locked for feeding starter for the next full bake day.";
  if (status.full) return "That pickup day already has six loaves booked.";
  if (requestedLoaves > status.remaining) return `Only ${status.remaining} loaf${status.remaining === 1 ? "" : "s"} remain for that day.`;
  return "";
}

export default function OrdersPage({
  cloudAccount,
  orders,
  recipes,
  starters,
  starterLogs,
  onAddOrder,
  onClearSampleOrders,
  onCompleteOrder,
  onDeleteOrder,
  onImportCloudOrder,
  onOpenOrder,
  onUpdateOrder,
  onUpdateOrderProgress,
  selectedOrderId,
}) {
  const [filter, setFilter] = useState("Pending");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState("");
  const [addError, setAddError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [progressSaving, setProgressSaving] = useState("");
  const [detailForm, setDetailForm] = useState({ status: "New", notes: "", pickupAt: "" });
  const [detailProgress, setDetailProgress] = useState(() => normalizedBakeProgress());
  const [form, setForm] = useState({
    customer: "",
    product: recipes[0]?.name || "",
    quantity: 1,
    total: 13,
    pickupAt: defaultPickupInput(),
    status: "New",
  });

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesFilter = filter === "All"
        || (filter === "Pending" && order.status !== "Completed")
        || (filter === "Completed" && order.status === "Completed");
      const matchesQuery = !normalized || `${order.customer} ${order.product}`.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, orders, query]);

  const openOrders = orders.filter((order) => order.status !== "Completed").length;
  const bookedRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const sampleOrderCount = orders.filter(isSampleOrder).length;
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const addCapacity = orderCapacityForDate(orders, form.pickupAt, form.quantity);
  const detailCapacity = selectedOrder
    ? orderCapacityForDate(orders, detailForm.pickupAt, selectedOrder.quantity, selectedOrder.id)
    : null;

  useEffect(() => {
    if (!selectedOrder) return;
    setDetailForm({
      status: selectedOrder.status,
      notes: selectedOrder.notes || "",
      pickupAt: localInputValue(selectedOrder.pickupAt || orderPickupDate(selectedOrder)),
    });
    setDetailProgress(normalizedBakeProgress(selectedOrder.bakeProgress));
    setConfirmDelete(false);
    setDetailError("");
  }, [selectedOrder]);

  useEffect(() => {
    if (!recipes.length || recipes.some((recipe) => recipe.name === form.product)) return;
    setForm((current) => ({
      ...current,
      product: recipes[0].name,
      total: Number(recipes[0].price || current.total),
    }));
  }, [form.product, recipes]);

  function submitOrder(event) {
    event.preventDefault();
    if (!form.customer.trim()) return;
    const nextCapacity = orderCapacityForDate(orders, form.pickupAt, form.quantity);
    const nextError = capacityError(nextCapacity, form.quantity);
    if (nextError) {
      setAddError(nextError);
      return;
    }
    onAddOrder({
      ...form,
      due: pickupDueLabel(form.pickupAt),
      pickupAt: form.pickupAt ? new Date(form.pickupAt).toISOString() : null,
    });
    setShowAdd(false);
    setAddError("");
    setForm({
      customer: "",
      product: recipes[0]?.name || "",
      quantity: 1,
      total: Number(recipes[0]?.price || 13),
      pickupAt: defaultPickupInput(),
      status: "New",
    });
  }

  async function saveDetails(event) {
    event.preventDefault();
    const nextCapacity = orderCapacityForDate(orders, detailForm.pickupAt, selectedOrder.quantity, selectedOrder.id);
    const nextError = capacityError(nextCapacity, selectedOrder.quantity);
    if (nextError) {
      setDetailError(nextError);
      return;
    }
    const changes = {
      notes: detailForm.notes.trim(),
      pickupAt: detailForm.pickupAt ? new Date(detailForm.pickupAt).toISOString() : null,
      due: pickupDueLabel(detailForm.pickupAt),
    };
    try {
      if (detailForm.status === "Completed" && selectedOrder.status !== "Completed") {
        await onCompleteOrder(selectedOrder.id, changes);
        setFilter("Completed");
      } else {
        onUpdateOrder(selectedOrder.id, { ...changes, status: detailForm.status });
      }
      onOpenOrder(null);
    } catch (error) {
      setDetailError(error.message);
    }
  }

  function addOrderToCalendar() {
    setCalendarMessage("");
    try {
      downloadOrderCalendar({
        order: {
          ...selectedOrder,
          pickupAt: detailForm.pickupAt ? new Date(detailForm.pickupAt).toISOString() : selectedOrder.pickupAt,
        },
        pickupAt: detailForm.pickupAt ? new Date(detailForm.pickupAt).toISOString() : selectedOrder.pickupAt,
        recipes,
        starters,
        starterLogs,
      });
      setCalendarMessage("Calendar file created. Open it on your phone and tap Add.");
    } catch (error) {
      setCalendarMessage(error.message);
    }
  }

  async function completeBake() {
    setCompleting(true);
    setDetailError("");
    try {
      await onCompleteOrder(selectedOrder.id, {
        notes: detailForm.notes.trim(),
        pickupAt: detailForm.pickupAt ? new Date(detailForm.pickupAt).toISOString() : null,
        due: pickupDueLabel(detailForm.pickupAt),
      });
      setFilter("Completed");
    } catch (error) {
      setDetailError(error.message);
    } finally {
      setCompleting(false);
    }
  }

  async function toggleBakePhase(phaseId) {
    const nextProgress = { ...detailProgress, [phaseId]: !detailProgress[phaseId] };
    setDetailProgress(nextProgress);
    setProgressSaving(phaseId);
    setDetailError("");
    try {
      await onUpdateOrderProgress(selectedOrder.id, nextProgress);
    } catch (error) {
      setDetailProgress(normalizedBakeProgress(selectedOrder.bakeProgress));
      setDetailError(error.message);
    } finally {
      setProgressSaving("");
    }
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
          <button type="button" className={view === "calendar" ? "selected" : ""} onClick={() => {
            onOpenOrder(null);
            setView("calendar");
          }}><CalendarDays size={14} /> Calendar</button>
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
                <Status tone={order.status === "Completed" || order.status === "Paid" ? "success" : order.status === "New" ? "accent" : "neutral"}>
                  {order.status === "Completed" || order.status === "Paid" ? <CheckCircle2 size={13} /> : <ShoppingBag size={13} />}
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
              <select value={form.product} onChange={(event) => {
                const selectedRecipe = recipes.find((recipe) => recipe.name === event.target.value);
                setForm({
                  ...form,
                  product: event.target.value,
                  total: Number(selectedRecipe?.price || form.total) * Number(form.quantity || 1),
                });
              }}>
                {recipes.map((recipe) => <option key={recipe.id}>{recipe.name}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Loaves
                <input
                  type="number"
                  min="1"
                  max={MAX_DAILY_LOAVES}
                  value={form.quantity}
                  onChange={(event) => {
                    const quantity = Number(event.target.value);
                    const selectedRecipe = recipes.find((recipe) => recipe.name === form.product);
                    setForm({
                      ...form,
                      quantity,
                      total: Number(selectedRecipe?.price || 0) * quantity,
                    });
                  }}
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
              <label>Pickup<input type="datetime-local" value={form.pickupAt} onChange={(event) => {
                setAddError("");
                setForm({ ...form, pickupAt: event.target.value });
              }} /></label>
              <label>
                Payment
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option>New</option>
                  <option>Deposit</option>
                  <option>Paid</option>
                </select>
              </label>
            </div>
            <div className={`order-capacity-note ${addCapacity.full || addCapacity.feedReserved ? "locked" : ""}`}>
              <strong>{addCapacity.feedReserved ? "Starter-feed day locked" : `${addCapacity.booked} of ${MAX_DAILY_LOAVES} loaves booked`}</strong>
              <span>{addCapacity.feedReserved ? "Choose another pickup day." : `${addCapacity.remaining} remaining before this day closes.`}</span>
            </div>
            {addError ? <p className="form-error" role="alert">{addError}</p> : null}
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
              <input type="datetime-local" value={detailForm.pickupAt} onChange={(event) => {
                setDetailError("");
                setDetailForm({ ...detailForm, pickupAt: event.target.value });
              }} />
            </label>
            {detailCapacity ? (
              <div className={`order-capacity-note ${detailCapacity.full || detailCapacity.feedReserved ? "locked" : ""}`}>
                <strong>{detailCapacity.feedReserved ? "Starter-feed day locked" : `${detailCapacity.booked} of ${MAX_DAILY_LOAVES} other loaves booked`}</strong>
                <span>{detailCapacity.feedReserved ? "Keep this order on a different pickup day." : `${detailCapacity.remaining} spaces available for this order.`}</span>
              </div>
            ) : null}
            <label>
              Order status
              <select
                value={detailForm.status}
                onChange={(event) => setDetailForm({ ...detailForm, status: event.target.value })}
              >
                <option>New</option>
                <option>Deposit</option>
                <option>Paid</option>
                <option>Completed</option>
              </select>
            </label>
            {detailError ? <p className="form-error" role="alert">{detailError}</p> : null}
            <label>
              Baker notes
              <textarea
                value={detailForm.notes}
                onChange={(event) => setDetailForm({ ...detailForm, notes: event.target.value })}
                placeholder="Pickup details, scoring request, allergies, payment reminder…"
              />
            </label>
            <section className="baker-progress-panel" aria-label="Customer-visible bake progress">
              <div><strong>Customer bake tracker</strong><small>Check each phase to update the customer’s order lookup.</small></div>
              <div className="baker-progress-grid">
                {BAKE_PHASES.map((phase) => (
                  <label className={detailProgress[phase.id] ? "complete" : ""} key={phase.id}>
                    <input
                      type="checkbox"
                      checked={detailProgress[phase.id]}
                      disabled={Boolean(progressSaving)}
                      onChange={() => toggleBakePhase(phase.id)}
                    />
                    <span><strong>{phase.label}</strong><small>{progressSaving === phase.id ? "Saving…" : phase.detail}</small></span>
                  </label>
                ))}
              </div>
              {!selectedOrder.cloudOrderId ? <p>Local order: progress is saved here, but only online orders can be viewed by customers.</p> : null}
            </section>
            <button className="calendar-export-button" type="button" onClick={addOrderToCalendar}>
              <CalendarDays size={16} /> Add full bake plan to phone calendar
            </button>
            {calendarMessage ? <div className="calendar-export-message">{calendarMessage}</div> : null}
            {selectedOrder.status !== "Completed" ? (
              <button className="complete-bake-button" type="button" disabled={completing} onClick={completeBake}>
                <CheckCircle2 size={16} /> {completing ? "Completing…" : "Complete bake"}
              </button>
            ) : (
              <div className="completed-order-banner"><CheckCircle2 size={16} /> Bake completed</div>
            )}
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
