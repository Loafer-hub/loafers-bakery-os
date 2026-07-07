import {
  Banknote,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Heart,
  List,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CloudOrderInbox } from "../components/CloudOrderInbox";
import { OrderCalendar, orderPickupDate } from "../components/OrderCalendar";
import { EmptyState, Modal, Status } from "../components/Primitives";
import { downloadOrderCalendar } from "../lib/orderCalendarExport";
import { orderCapacityForDate } from "../lib/orderCapacity";
import {
  blankCustomerProfile,
  buildCustomerRecords as buildSharedCustomerRecords,
  isClosedOrder,
  orderTimestamp,
} from "../lib/orderRecords";
import { normalizedBakerySettings, notificationEventOptions } from "../lib/bakerySettings";
import { BAKE_PHASES, normalizedBakeProgress } from "../lib/bakeProgress";
import { emailNotificationHref, smsNotificationHref } from "../lib/customerNotifications";
import { normalizedSalesOptions, pluralUnit } from "../lib/salesOptions";
import { updateCustomerOrderNotificationPreferences } from "../lib/cloud";

// customer-options-v1
// checkout-flow-v1

const filters = ["Active", "Ready", "Completed", "All"];
const paymentMethods = ["Venmo", "Zelle", "Cash", "Other"];
const paymentStatuses = [
  { value: "unpaid", label: "Unpaid" },
  { value: "deposit", label: "Deposit paid" },
  { value: "paid", label: "Paid in full" },
  { value: "refunded", label: "Refunded" },
];
const ORDER_WORKFLOW = [
  { value: "New", label: "New", note: "Request received" },
  { value: "Accepted", label: "Accepted", note: "You approved it" },
  { value: "In progress", label: "In progress", note: "Baking work started" },
  { value: "Ready", label: "Ready", note: "Packed for pickup" },
  { value: "Picked up", label: "Picked up", note: "Customer has it" },
  { value: "Completed", label: "Completed", note: "Closed record" },
];
const workflowValues = new Set(ORDER_WORKFLOW.map((step) => step.value));

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

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function pickupTimeValue(order) {
  const pickup = orderPickupDate(order);
  return pickup ? pickup.getTime() : Number.MAX_SAFE_INTEGER;
}

function formatShortPickup(order) {
  const pickup = orderPickupDate(order);
  if (!pickup) return order.due || "Arrange pickup";
  return pickup.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatPickupTime(order) {
  const pickup = orderPickupDate(order);
  if (!pickup) return "";
  return pickup.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function capacityError(status, requestedSlots) {
  if (!status.key) return "Choose a pickup date and time.";
  if (status.feedReserved) return "That day is locked for feeding starter for the next full bake day.";
  if (status.full) return `That pickup day already has all ${status.maximum} bake slots booked.`;
  if (requestedSlots > status.remaining) return `Only ${status.remaining} bake slot${status.remaining === 1 ? "" : "s"} remain for that day.`;
  return "";
}

function paymentStatusLabel(value) {
  return paymentStatuses.find((status) => status.value === value)?.label || "Unpaid";
}

function inferredPaymentStatus(order = {}) {
  if (order.paymentStatus) return order.paymentStatus;
  if (order.status === "Paid") return "paid";
  if (order.status === "Deposit") return "deposit";
  return "unpaid";
}

const readyOrderStatuses = new Set(["ready", "picked up"]);

function dateTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isActiveOrder(order) {
  return order?.isSample !== true && !isClosedOrder(order);
}

function workflowLabel(status = "") {
  if (status === "Paid" || status === "Deposit" || status === "Confirmed") return "Accepted";
  return status || "New";
}

function workflowTone(status = "") {
  const normalized = workflowLabel(status).toLowerCase();
  if (normalized === "completed" || normalized === "picked up") return "success";
  if (normalized === "ready") return "success";
  if (normalized === "in progress" || normalized === "accepted") return "accent";
  return "neutral";
}

function orderItemsLabel(order) {
  if (order.items?.length) {
    return order.items.map((item) => (
      `${item.quantity || 1} × ${item.sale_option_label || item.product_name || "Item"}`
    )).join(" · ");
  }
  return order.itemSummary || `${order.quantity || 1} × ${order.product || "Order"}`;
}

function orderProgressLabel(order) {
  const progress = order.bakeProgress || {};
  const entries = Object.entries(progress);
  if (!entries.length) return "";
  const complete = entries.filter(([, value]) => Boolean(value)).length;
  return `${complete}/${entries.length} bake phases complete`;
}

function CustomerProfilesView({
  customerProfiles,
  onOpenOrder,
  onSaveCustomerProfile,
  orders,
}) {
  const [customerView, setCustomerView] = useState("active");
  const [customerDraft, setCustomerDraft] = useState(null);
  const customerRecords = useMemo(() => buildSharedCustomerRecords(orders, customerProfiles), [customerProfiles, orders]);
  const activeCustomerRecords = useMemo(() => customerRecords.filter((customer) => customer.isActive), [customerRecords]);
  const pastCustomerRecords = useMemo(() => customerRecords.filter((customer) => customer.orders.length && !customer.isActive), [customerRecords]);
  const accountCustomerRecords = useMemo(() => customerRecords.filter((customer) => customer.customerUserId), [customerRecords]);
  const visibleCustomers = customerView === "active"
    ? activeCustomerRecords
    : customerView === "past"
      ? pastCustomerRecords
      : customerView === "accounts"
        ? accountCustomerRecords
        : customerRecords;
  const linkedCustomer = customerDraft
    ? customerRecords.find((customer) => customer.id === customerDraft.id)
    : null;

  useEffect(() => {
    if (customerDraft) return;
    const starter = activeCustomerRecords[0] || customerRecords[0] || null;
    if (starter) setCustomerDraft({ ...starter, orders: undefined, activeOrders: undefined });
  }, [activeCustomerRecords, customerDraft, customerRecords]);

  function editCustomer(customer) {
    setCustomerDraft({ ...customer, orders: undefined, activeOrders: undefined });
  }

  function addCustomerProfile() {
    setCustomerDraft({
      ...blankCustomerProfile(""),
      id: `customer-${Date.now()}`,
      name: "",
    });
    setCustomerView("all");
  }

  function saveCustomerProfile(event) {
    event.preventDefault();
    if (!customerDraft || !onSaveCustomerProfile) return;
    onSaveCustomerProfile({
      ...customerDraft,
      name: customerDraft.name?.trim() || "Customer",
    });
  }

  return (
    <section className="customer-directory-panel orders-customer-panel">
      <div className="customer-directory-toolbar">
        <div className="segmented-control customer-filter">
          <button type="button" className={customerView === "active" ? "selected" : ""} onClick={() => setCustomerView("active")}>Active <span>{activeCustomerRecords.length}</span></button>
          <button type="button" className={customerView === "past" ? "selected" : ""} onClick={() => setCustomerView("past")}>Past <span>{pastCustomerRecords.length}</span></button>
          <button type="button" className={customerView === "accounts" ? "selected" : ""} onClick={() => setCustomerView("accounts")}>Accounts <span>{accountCustomerRecords.length}</span></button>
          <button type="button" className={customerView === "all" ? "selected" : ""} onClick={() => setCustomerView("all")}>All <span>{customerRecords.length}</span></button>
        </div>
        <button type="button" className="small-action-button" onClick={addCustomerProfile}><Plus size={14} /> Add customer</button>
      </div>
      <div className="customer-directory-layout">
        <div className="customer-directory-list">
          {visibleCustomers.length ? visibleCustomers.map((customer) => (
            <button type="button" className={`customer-directory-row ${customerDraft?.id === customer.id ? "selected" : ""}`} key={customer.id} onClick={() => editCustomer(customer)}>
              <UserRound size={17} />
              <span>
                <strong>{customer.name || "Customer"}</strong>
                <small>{customer.orders.length} order{customer.orders.length === 1 ? "" : "s"} · ${customer.totalSpent.toFixed(2)} lifetime</small>
                {customer.customerUserId ? <em>Customer account</em> : null}
              </span>
              <ChevronRight size={14} />
            </button>
          )) : <EmptyState title="No customers in this view" body="Switch to All or add a customer profile." />}
        </div>
        {customerDraft ? (
          <form className="form-stack customer-profile-form" onSubmit={saveCustomerProfile}>
            <div className="customer-profile-summary">
              <UserRound size={19} />
              <span>
                <strong>{customerDraft.name || "New customer"}</strong>
                <small>{linkedCustomer?.orders.length || 0} linked order record{(linkedCustomer?.orders.length || 0) === 1 ? "" : "s"}</small>
              </span>
            </div>
            <div className="customer-profile-stats">
              <span><strong>{linkedCustomer?.orders.length || 0}</strong><small>Lifetime orders</small></span>
              <span><strong>${Number(linkedCustomer?.totalSpent || 0).toFixed(2)}</strong><small>Total spent</small></span>
              <span><strong>{linkedCustomer?.lastOrderAt ? dateTimeLabel(linkedCustomer.lastOrderAt) : "—"}</strong><small>Last order</small></span>
              {customerDraft.customerUserId || linkedCustomer?.customerUserId ? (
                <span><strong>{dateTimeLabel(customerDraft.lastAccountProfileAt || linkedCustomer?.lastAccountProfileAt) || "Linked"}</strong><small>Account saved</small></span>
              ) : null}
            </div>
            {customerDraft.customerUserId || linkedCustomer?.customerUserId ? (
              <p className="customer-account-link-note"><UserRound size={13} /> Customer account linked</p>
            ) : null}
            <label>Name<input required value={customerDraft.name || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, name: event.target.value })} placeholder="Customer name" /></label>
            <div className="form-grid">
              <label>Email<input type="email" value={customerDraft.email || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, email: event.target.value })} placeholder="name@example.com" /></label>
              <label>Phone<input value={customerDraft.phone || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, phone: event.target.value })} placeholder="907…" /></label>
            </div>
            <label>Address<textarea value={customerDraft.address || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, address: event.target.value })} placeholder="Street, city, delivery notes…" /></label>
            <label>Allergies / safety notes<textarea value={customerDraft.allergies || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, allergies: event.target.value })} placeholder="Wheat, sesame, dairy, nut allergies, cross-contact notes…" /></label>
            <label>Preferences<textarea value={customerDraft.preferences || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, preferences: event.target.value })} placeholder="Crust darkness, slicing, add-ins, pickup habits…" /></label>
            <div className="form-grid">
              <label>Favorite items<input value={customerDraft.favoriteItems || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, favoriteItems: event.target.value })} placeholder="Country, bagels, hot sauce…" /></label>
              <label>Payment notes<input value={customerDraft.paymentNotes || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, paymentNotes: event.target.value })} placeholder="Venmo, cash, invoice…" /></label>
            </div>
            <label>Pickup / delivery notes<textarea value={customerDraft.pickupNotes || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, pickupNotes: event.target.value })} placeholder="Porch box, text on arrival, gate code…" /></label>
            <label>Private notes<textarea value={customerDraft.notes || ""} onChange={(event) => setCustomerDraft({ ...customerDraft, notes: event.target.value })} placeholder="Anything useful for future orders…" /></label>
            <div className="customer-profile-chips">
              <span><Mail size={13} /> {customerDraft.email || "No email"}</span>
              <span><Phone size={13} /> {customerDraft.phone || "No phone"}</span>
              <span><Heart size={13} /> {customerDraft.favoriteItems || "No favorites yet"}</span>
            </div>
            <button className="primary-button" type="submit">Save customer profile</button>

            <section className="customer-order-history-list">
              <div className="section-title-line">
                <div><strong>Order history</strong><small>All saved order details for this customer.</small></div>
                <UsersRound size={17} />
              </div>
              {linkedCustomer?.orders.length ? linkedCustomer.orders.map((order) => (
                <article className="order-history-card compact" key={order.id}>
                  <div className="order-history-heading">
                    <span>
                      <strong>{order.product || order.itemSummary || "Order"}</strong>
                      <small>{order.status || "New"} · {dateTimeLabel(order.pickupAt || order.createdAt) || order.due || "No date"}</small>
                    </span>
                    <strong>${Number(order.total || 0).toFixed(2)}</strong>
                  </div>
                  <div className="order-history-facts">
                    <span><MapPin size={13} /> {order.pickupAt ? dateTimeLabel(order.pickupAt) : order.due || "Pickup not set"}</span>
                    <span><BellRing size={13} /> {orderProgressLabel(order) || "Bake progress not started"}</span>
                    <span><MessageSquareText size={13} /> {order.allergies || customerDraft.allergies || "No allergy note"}</span>
                    <span><Banknote size={13} /> {order.paymentMethod || "Payment not recorded"}</span>
                  </div>
                  <div className="order-history-detail-grid">
                    <span><strong>Items</strong><small>{orderItemsLabel(order)}</small></span>
                    <span><strong>Contact</strong><small>{[order.customerEmail, order.customerPhone].filter(Boolean).join(" · ") || "No contact saved"}</small></span>
                  </div>
                  {order.notes ? <p className="order-history-notes">{order.notes}</p> : null}
                  <button type="button" className="text-button order-history-open" onClick={() => onOpenOrder?.(order.id)}>Open order <ChevronRight size={14} /></button>
                </article>
              )) : <EmptyState title="No orders linked yet" body="Orders with this customer name will appear here automatically." />}
            </section>
          </form>
        ) : (
          <EmptyState title="Pick a customer" body="Choose a customer or add a new profile to save details." />
        )}
      </div>
    </section>
  );
}

export default function OrdersPage({
  bakerySettings,
  cloudAccount,
  customerProfiles = [],
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
  onSaveCustomerProfile,
  onUpdateOrder,
  onUpdateOrderProgress,
  selectedOrderId,
}) {
  const rules = normalizedBakerySettings(bakerySettings);
  const dailyCapacity = rules.dailyCapacity;
  const enabledNotificationEvents = notificationEventOptions(rules);
  const [filter, setFilter] = useState("Active");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState("");
  const [addError, setAddError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [progressSaving, setProgressSaving] = useState("");
  const [notificationEvent, setNotificationEvent] = useState("accepted");
  const [detailForm, setDetailForm] = useState({
    status: "New",
    notes: "",
    pickupAt: "",
    customerEmail: "",
    customerPhone: "",
    notifyEmail: false,
    notifySms: false,
    paymentMethod: "Venmo",
    paymentStatus: "unpaid",
    paymentAmount: "",
    paymentNotes: "",
    internalNotes: "",
  });
  const [detailProgress, setDetailProgress] = useState(() => normalizedBakeProgress());
  const [form, setForm] = useState({
    customer: "",
    product: recipes[0]?.name || "",
    saleOptionId: normalizedSalesOptions(recipes[0] || {})[0]?.id || "default",
    packageCount: 1,
    customerEmail: "",
    customerPhone: "",
    notifyEmail: false,
    notifySms: false,
    pickupAt: defaultPickupInput(),
    status: "New",
    paymentMethod: "Venmo",
    paymentStatus: "unpaid",
    paymentAmount: "",
    paymentNotes: "",
  });

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders
      .filter((order) => {
        const matchesFilter = filter === "All"
          || (filter === "Active" && isActiveOrder(order))
          || (filter === "Ready" && readyOrderStatuses.has(String(workflowLabel(order.status)).toLowerCase()))
          || (filter === "Completed" && workflowLabel(order.status) === "Completed");
        const searchText = [
          order.customer,
          order.product,
          order.itemSummary,
          order.notes,
          order.internalNotes,
          order.requestCode,
          order.customerEmail,
          order.customerPhone,
          order.paymentMethod,
        ].filter(Boolean).join(" ").toLowerCase();
        const matchesQuery = !normalized || searchText.includes(normalized);
        return matchesFilter && matchesQuery;
      })
      .sort((a, b) => pickupTimeValue(a) - pickupTimeValue(b));
  }, [filter, orders, query]);

  const activeOrders = orders.filter(isActiveOrder);
  const readyOrders = orders.filter((order) => readyOrderStatuses.has(String(workflowLabel(order.status)).toLowerCase()));
  const completedOrders = orders.filter((order) => workflowLabel(order.status) === "Completed");
  const unpaidOrders = activeOrders.filter((order) => !["paid", "refunded"].includes(inferredPaymentStatus(order)));
  const openOrders = activeOrders.length;
  const bookedRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const activeRevenue = activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const sampleOrderCount = orders.filter(isSampleOrder).length;
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const todayKey = dateKey(new Date());
  const todaysPickups = activeOrders
    .filter((order) => dateKey(orderPickupDate(order)) === todayKey)
    .sort((a, b) => pickupTimeValue(a) - pickupTimeValue(b));
  const nextOrders = activeOrders
    .filter((order) => orderPickupDate(order))
    .sort((a, b) => pickupTimeValue(a) - pickupTimeValue(b))
    .slice(0, 4);
  const capacityToday = todaysPickups.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
  const nextPickup = nextOrders[0];
  const formRecipe = recipes.find((recipe) => recipe.name === form.product) || recipes[0];
  const formSaleOptions = normalizedSalesOptions(formRecipe || {});
  const formSaleOption = formSaleOptions.find((option) => option.id === form.saleOptionId) || formSaleOptions[0];
  const formCapacityUnits = Number(formSaleOption?.capacityUnits || 1) * Number(form.packageCount || 1);
  const formTotal = Number(formSaleOption?.price || 0) * Number(form.packageCount || 1);
  const addCapacity = orderCapacityForDate(orders, form.pickupAt, formCapacityUnits, null, dailyCapacity);
  const detailCapacity = selectedOrder
    ? orderCapacityForDate(orders, detailForm.pickupAt, selectedOrder.quantity, selectedOrder.id, dailyCapacity)
    : null;

  useEffect(() => {
    if (!selectedOrder) return;
    setDetailForm({
      status: selectedOrder.status,
      notes: selectedOrder.notes || "",
      pickupAt: localInputValue(selectedOrder.pickupAt || orderPickupDate(selectedOrder)),
      customerEmail: selectedOrder.customerEmail || "",
      customerPhone: selectedOrder.customerPhone || "",
      notifyEmail: Boolean(selectedOrder.notifyEmail),
      notifySms: Boolean(selectedOrder.notifySms),
      paymentMethod: selectedOrder.paymentMethod || "Venmo",
      paymentStatus: inferredPaymentStatus(selectedOrder),
      paymentAmount: selectedOrder.paymentAmount ?? "",
      paymentNotes: selectedOrder.paymentNotes || "",
      internalNotes: selectedOrder.internalNotes || "",
    });
    setDetailProgress(normalizedBakeProgress(selectedOrder.bakeProgress));
    setNotificationEvent(enabledNotificationEvents[0]?.id || "");
    setConfirmDelete(false);
    setDetailError("");
  }, [selectedOrder, bakerySettings]);

  useEffect(() => {
    if (!recipes.length || recipes.some((recipe) => recipe.name === form.product)) return;
    setForm((current) => ({
      ...current,
      product: recipes[0].name,
      saleOptionId: normalizedSalesOptions(recipes[0])[0].id,
    }));
  }, [form.product, recipes]);

  function submitOrder(event) {
    event.preventDefault();
    if (!form.customer.trim()) return;
    const selectedRecipe = formRecipe;
    const selectedOption = formSaleOption;
    const nextCapacity = orderCapacityForDate(orders, form.pickupAt, formCapacityUnits, null, dailyCapacity);
    const nextError = capacityError(nextCapacity, formCapacityUnits);
    if (nextError) {
      setAddError(nextError);
      return;
    }
    onAddOrder({
      ...form,
      notifyEmail: Boolean(rules.emailNotifications && form.notifyEmail && form.customerEmail.trim()),
      notifySms: Boolean(rules.smsNotifications && form.notifySms && form.customerPhone.trim()),
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentStatus,
      paymentAmount: Number(form.paymentAmount || 0),
      paymentNotes: form.paymentNotes.trim(),
      internalNotes: "",
      product: `${selectedRecipe.name} · ${selectedOption.label}`,
      quantity: formCapacityUnits,
      totalUnits: Number(selectedOption.units || 1) * Number(form.packageCount || 1),
      itemSummary: `${form.packageCount} × ${selectedOption.label} ${selectedRecipe.name}`,
      total: formTotal,
      items: [{
        product_name: selectedRecipe.name,
        quantity: Number(form.packageCount || 1),
        sale_option_id: selectedOption.id,
        sale_option_label: selectedOption.label,
        units_per_pack: selectedOption.units,
        capacity_units: formCapacityUnits,
      }],
      due: pickupDueLabel(form.pickupAt),
      pickupAt: form.pickupAt ? new Date(form.pickupAt).toISOString() : null,
    });
    setShowAdd(false);
    setAddError("");
    setForm({
      customer: "",
      product: recipes[0]?.name || "",
      saleOptionId: normalizedSalesOptions(recipes[0] || {})[0]?.id || "default",
      packageCount: 1,
      customerEmail: "",
      customerPhone: "",
      notifyEmail: false,
      notifySms: false,
      pickupAt: defaultPickupInput(),
      status: "New",
      paymentMethod: "Venmo",
      paymentStatus: "unpaid",
      paymentAmount: "",
      paymentNotes: "",
    });
  }

  async function saveDetails(event) {
    event.preventDefault();
    const nextCapacity = orderCapacityForDate(orders, detailForm.pickupAt, selectedOrder.quantity, selectedOrder.id, dailyCapacity);
    const nextError = capacityError(nextCapacity, selectedOrder.quantity);
    if (nextError) {
      setDetailError(nextError);
      return;
    }
    const changes = {
      notes: detailForm.notes.trim(),
      customerEmail: detailForm.customerEmail.trim(),
      customerPhone: detailForm.customerPhone.trim(),
      notifyEmail: Boolean(rules.emailNotifications && detailForm.notifyEmail && detailForm.customerEmail.trim()),
      notifySms: Boolean(rules.smsNotifications && detailForm.notifySms && detailForm.customerPhone.trim()),
      paymentMethod: detailForm.paymentMethod,
      paymentStatus: detailForm.paymentStatus,
      paymentAmount: Number(detailForm.paymentAmount || 0),
      paymentNotes: detailForm.paymentNotes.trim(),
      internalNotes: detailForm.internalNotes.trim(),
      pickupAt: detailForm.pickupAt ? new Date(detailForm.pickupAt).toISOString() : null,
      due: pickupDueLabel(detailForm.pickupAt),
    };
    try {
      if (selectedOrder.cloudOrderId) {
        await updateCustomerOrderNotificationPreferences(selectedOrder.cloudOrderId, changes);
      }
      if (detailForm.status === "Completed" && workflowLabel(selectedOrder.status) !== "Completed") {
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
      if (selectedOrder.cloudOrderId) {
        await updateCustomerOrderNotificationPreferences(selectedOrder.cloudOrderId, {
          customerEmail: detailForm.customerEmail,
          customerPhone: detailForm.customerPhone,
          notifyEmail: rules.emailNotifications && detailForm.notifyEmail,
          notifySms: rules.smsNotifications && detailForm.notifySms,
        });
      }
      await onCompleteOrder(selectedOrder.id, {
        notes: detailForm.notes.trim(),
        customerEmail: detailForm.customerEmail.trim(),
        customerPhone: detailForm.customerPhone.trim(),
        notifyEmail: Boolean(rules.emailNotifications && detailForm.notifyEmail && detailForm.customerEmail.trim()),
        notifySms: Boolean(rules.smsNotifications && detailForm.notifySms && detailForm.customerPhone.trim()),
        paymentMethod: detailForm.paymentMethod,
        paymentStatus: detailForm.paymentStatus,
        paymentAmount: Number(detailForm.paymentAmount || 0),
        paymentNotes: detailForm.paymentNotes.trim(),
        internalNotes: detailForm.internalNotes.trim(),
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
    <main className="page orders-page">
      <section className="orders-command-hero">
        <div>
          <span className="eyebrow-label dark">Loafers Home Bakery</span>
          <h1>Orders desk</h1>
          <p>Accept requests, watch pickup capacity, keep payment status separate, and open every customer record from one owner workspace.</p>
        </div>
        <button className="orders-add-button" onClick={() => setShowAdd(true)} type="button">
          <Plus size={18} />
          Add order
        </button>
      </section>

      <section className="orders-command-grid" aria-label="Order metrics">
        <article>
          <ShoppingBag size={18} />
          <span>Active orders</span>
          <strong>{openOrders}</strong>
          <small>{readyOrders.length} ready · {completedOrders.length} completed</small>
        </article>
        <article>
          <CalendarCheck2 size={18} />
          <span>Pickup today</span>
          <strong>{todaysPickups.length}</strong>
          <small>{capacityToday} of {dailyCapacity} bake slots</small>
        </article>
        <article>
          <Clock3 size={18} />
          <span>Next pickup</span>
          <strong>{nextPickup ? formatShortPickup(nextPickup) : "Clear"}</strong>
          <small>{nextPickup ? `${formatPickupTime(nextPickup)} · ${nextPickup.customer}` : "No dated pickups"}</small>
        </article>
        <article>
          <Sparkles size={18} />
          <span>Active revenue</span>
          <strong>${activeRevenue.toFixed(0)}</strong>
          <small>{unpaidOrders.length} unpaid · ${bookedRevenue.toFixed(0)} booked</small>
        </article>
      </section>

      <section className="orders-intake-card" aria-label="Customer requests">
        <div>
          <span className="eyebrow-label dark">Request intake</span>
          <h2>Accept orders without hunting</h2>
          <p>Customer web requests open below. Once accepted, they land in the active order list and capacity calendar.</p>
        </div>
        <CloudOrderInbox
          cloudAccount={cloudAccount}
          orders={orders}
          onImportOrder={onImportCloudOrder}
        />
      </section>

      {sampleOrderCount ? (
        <aside className="sample-record-banner">
          <span><strong>Demo records</strong><small>{sampleOrderCount} sample orders can be safely removed.</small></span>
          <button type="button" onClick={onClearSampleOrders}>
            <Trash2 size={14} />
            Erase samples
          </button>
        </aside>
      ) : null}

      <section className={view === "customers" ? "orders-workspace customers-open" : "orders-workspace"}>
        <div className="orders-main-column">
          <div className="orders-toolbar">
            <div>
              <span className="eyebrow-label dark">Order records</span>
              <h2>{view === "customers" ? "Customer profiles" : view === "calendar" ? "Production calendar" : "Customer queue"}</h2>
            </div>
            <div className="view-switch" aria-label="Order view">
              <button type="button" className={view === "list" ? "selected" : ""} onClick={() => setView("list")}><List size={14} /> List</button>
              <button type="button" className={view === "calendar" ? "selected" : ""} onClick={() => {
                onOpenOrder(null);
                setView("calendar");
              }}><CalendarDays size={14} /> Calendar</button>
              <button type="button" className={view === "customers" ? "selected" : ""} onClick={() => {
                onOpenOrder(null);
                setView("customers");
              }}><UsersRound size={14} /> Customers</button>
            </div>
          </div>

          {view === "list" ? <div className="search-row orders-search-row">
            <label className="search-field">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, item, note, code, payment" />
            </label>
            <div className="segmented-control">
              {filters.map((item) => (
                <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div> : null}

          {view === "customers" ? (
            <CustomerProfilesView
              customerProfiles={customerProfiles}
              onOpenOrder={onOpenOrder}
              onSaveCustomerProfile={onSaveCustomerProfile}
              orders={orders}
            />
          ) : view === "calendar" ? (
            <div className="orders-calendar-shell">
              <OrderCalendar
                orders={orders}
                recipes={recipes}
                starters={starters}
                starterLogs={starterLogs}
              />
            </div>
          ) : <section className="order-list orders-card-list">
            {filteredOrders.length ? filteredOrders.map((order) => (
              <button
                className={`order-row order-command-card status-${String(workflowLabel(order.status) || "new").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                key={order.id}
                onClick={() => onOpenOrder(order.id)}
                type="button"
                aria-label={`Open order for ${order.customer}`}
              >
                <span className={`avatar avatar-${order.accent}`}>{order.initials}</span>
                <div className="order-main">
                  <div className="order-title-line">
                    <h3>{order.customer}</h3>
                    <strong>${Number(order.total || 0).toFixed(0)}</strong>
                  </div>
                  <p>{order.itemSummary || `${order.quantity} × ${order.product}`}</p>
                  <div className="order-meta">
                    <span className="order-due">
                      {formatShortPickup(order)} {formatPickupTime(order)}
                      {order.notes || order.internalNotes ? <MessageSquareText size={13} aria-label="Has notes" /> : null}
                    </span>
                    <Status tone={workflowTone(order.status)}>
                      {workflowTone(order.status) === "success" ? <CheckCircle2 size={13} /> : <ShoppingBag size={13} />}
                      {workflowLabel(order.status)}
                    </Status>
                    <span className={`payment-status-chip ${inferredPaymentStatus(order)}`}>
                      <Banknote size={12} />
                      {paymentStatusLabel(inferredPaymentStatus(order))}
                    </span>
                  </div>
                </div>
                <ChevronRight className="order-card-arrow" size={17} />
              </button>
            )) : <EmptyState title="No matching orders" body={orders.length ? "Try a different status, customer, item, note, request code, or payment method." : "Add your first real order with the plus button."} />}
          </section>}
        </div>

        {view !== "customers" ? (
          <aside className="orders-side-panel" aria-label="Order day overview">
            <section>
              <div className="section-title-line">
                <div><span className="eyebrow-label dark">Today</span><h2>Pickup lane</h2></div>
                <UsersRound size={18} />
              </div>
              {todaysPickups.length ? (
                <div className="orders-mini-list">
                  {todaysPickups.map((order) => (
                    <button key={order.id} type="button" onClick={() => onOpenOrder(order.id)}>
                      <span>{formatPickupTime(order) || "Time TBD"}</span>
                      <strong>{order.customer}</strong>
                      <small>{orderItemsLabel(order)}</small>
                    </button>
                  ))}
                </div>
              ) : <p className="orders-side-empty">No pickups scheduled for today.</p>}
            </section>

            <section>
              <div className="section-title-line">
                <div><span className="eyebrow-label dark">Next</span><h2>Upcoming flow</h2></div>
                <Clock3 size={18} />
              </div>
              {nextOrders.length ? (
                <div className="orders-timeline-list">
                  {nextOrders.map((order) => (
                    <button key={order.id} type="button" onClick={() => onOpenOrder(order.id)}>
                      <i />
                      <span>
                        <strong>{formatShortPickup(order)} {formatPickupTime(order)}</strong>
                        <small>{order.customer} · {orderItemsLabel(order)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : <p className="orders-side-empty">No upcoming pickup dates yet.</p>}
            </section>

            <section className="orders-capacity-card">
              <span>Today’s bake slots</span>
              <strong>{Math.min(capacityToday, dailyCapacity)} / {dailyCapacity}</strong>
              <div className="capacity-track" style={{ "--slot-count": dailyCapacity }} aria-hidden="true">
                {Array.from({ length: dailyCapacity }, (_, index) => (
                  <i key={index} className={index < capacityToday ? "filled" : ""} />
                ))}
              </div>
            </section>
          </aside>
        ) : null}
      </section>

      {showAdd ? (
        <Modal title="New customer order" onClose={() => setShowAdd(false)}>
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
              Item
              <select value={form.product} onChange={(event) => {
                const selectedRecipe = recipes.find((recipe) => recipe.name === event.target.value);
                setForm({
                  ...form,
                  product: event.target.value,
                  saleOptionId: normalizedSalesOptions(selectedRecipe || {})[0]?.id || "default",
                });
              }}>
                {recipes.map((recipe) => <option key={recipe.id}>{recipe.name}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Package
                <select value={form.saleOptionId} onChange={(event) => setForm({ ...form, saleOptionId: event.target.value })}>
                  {formSaleOptions.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.units} {pluralUnit(formRecipe?.unitName || "item", option.units)} · ${option.price.toFixed(2)}</option>)}
                </select>
              </label>
              <label>
                Packages
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={form.packageCount}
                  onChange={(event) => setForm({ ...form, packageCount: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="order-package-summary">
              <span><strong>{form.packageCount} × {formSaleOption?.label}</strong><small>{Number(formSaleOption?.units || 1) * Number(form.packageCount || 1)} total {pluralUnit(formRecipe?.unitName || "item", Number(formSaleOption?.units || 1) * Number(form.packageCount || 1))} · {formCapacityUnits} bake slot{formCapacityUnits === 1 ? "" : "s"}</small></span>
              <strong>${formTotal.toFixed(2)}</strong>
            </div>
            <div className="form-grid">
              <label>Email<input type="email" value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} placeholder="Optional" /></label>
              <label>Phone<input value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} placeholder="Optional" /></label>
            </div>
            <div className="local-notification-options">
              <label><input type="checkbox" disabled={!rules.emailNotifications || !form.customerEmail.trim()} checked={rules.emailNotifications && form.notifyEmail && Boolean(form.customerEmail.trim())} onChange={(event) => setForm({ ...form, notifyEmail: event.target.checked })} /> Email status updates</label>
              <label><input type="checkbox" disabled={!rules.smsNotifications || !form.customerPhone.trim()} checked={rules.smsNotifications && form.notifySms && Boolean(form.customerPhone.trim())} onChange={(event) => setForm({ ...form, notifySms: event.target.checked })} /> Text status updates</label>
            </div>
            <div className="form-grid">
              <label>Pickup<input type="datetime-local" value={form.pickupAt} onChange={(event) => {
                setAddError("");
                setForm({ ...form, pickupAt: event.target.value });
              }} /></label>
              <label>
                Workflow status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option>New</option>
                  <option>Accepted</option>
                  <option>In progress</option>
                  <option>Ready</option>
                </select>
              </label>
            </div>
            <section className="payment-tracking-panel compact" aria-label="Payment tracking">
              <div className="section-title-line">
                <div><strong>Payment tracking</strong><small>Keep Venmo, Zelle, Cash, and deposits separate from bake status.</small></div>
                <Banknote size={17} />
              </div>
              <div className="form-grid">
                <label>
                  Method
                  <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
                    {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                  </select>
                </label>
                <label>
                  Payment status
                  <select value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })}>
                    {paymentStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label>Amount received<input type="number" min="0" step="0.01" value={form.paymentAmount} onChange={(event) => setForm({ ...form, paymentAmount: event.target.value })} placeholder="0.00" /></label>
                <label>Payment notes<input value={form.paymentNotes} onChange={(event) => setForm({ ...form, paymentNotes: event.target.value })} placeholder="Txn note, cash due, deposit…" /></label>
              </div>
            </section>
            <div className={`order-capacity-note ${addCapacity.full || addCapacity.feedReserved ? "locked" : ""}`}>
              <strong>{addCapacity.feedReserved ? "Starter-feed day locked" : `${addCapacity.booked} of ${dailyCapacity} bake slots booked`}</strong>
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
              <div><span>Item</span><strong>{selectedOrder.product}</strong></div>
              <div><span>Ordered</span><strong>{selectedOrder.itemSummary || `${selectedOrder.quantity} item${selectedOrder.quantity === 1 ? "" : "s"}`}</strong></div>
              <div><span>Total</span><strong>${selectedOrder.total}</strong></div>
              <div><span>Bake capacity</span><strong>{selectedOrder.quantity} slot{selectedOrder.quantity === 1 ? "" : "s"}</strong></div>
              <div><span>Payment</span><strong>{detailForm.paymentMethod || selectedOrder.paymentMethod || "Not set"}</strong></div>
              <div><span>Payment status</span><strong>{paymentStatusLabel(detailForm.paymentStatus)}</strong></div>
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
                <strong>{detailCapacity.feedReserved ? "Starter-feed day locked" : `${detailCapacity.booked} of ${dailyCapacity} other bake slots booked`}</strong>
                <span>{detailCapacity.feedReserved ? "Keep this order on a different pickup day." : `${detailCapacity.remaining} spaces available for this order.`}</span>
              </div>
            ) : null}
            <section className="order-workflow-panel" aria-label="Order workflow">
              <div className="section-title-line">
                <div><strong>Order workflow</strong><small>Move the order through production without mixing it up with payment.</small></div>
                <ShoppingBag size={18} />
              </div>
              <div className="order-workflow-steps">
                {ORDER_WORKFLOW.map((step) => {
                  const active = workflowLabel(detailForm.status) === step.value;
                  const completed = ORDER_WORKFLOW.findIndex((item) => item.value === workflowLabel(detailForm.status)) > ORDER_WORKFLOW.findIndex((item) => item.value === step.value);
                  return (
                    <button
                      className={[active ? "active" : "", completed ? "complete" : ""].filter(Boolean).join(" ")}
                      key={step.value}
                      onClick={() => setDetailForm({ ...detailForm, status: step.value })}
                      type="button"
                    >
                      <span>{completed || active ? <CheckCircle2 size={14} /> : <ShoppingBag size={14} />}</span>
                      <strong>{step.label}</strong>
                      <small>{step.note}</small>
                    </button>
                  );
                })}
              </div>
              <label>
                Workflow status
                <select
                  value={detailForm.status}
                  onChange={(event) => setDetailForm({ ...detailForm, status: event.target.value })}
                >
                  {!workflowValues.has(detailForm.status) ? <option>{detailForm.status}</option> : null}
                  {ORDER_WORKFLOW.map((step) => <option key={step.value}>{step.value}</option>)}
                  <option>Rejected</option>
                  <option>Cancelled</option>
                </select>
              </label>
            </section>
            <section className="payment-tracking-panel" aria-label="Payment tracking">
              <div className="section-title-line">
                <div><strong>Payment tracking</strong><small>Use this for Venmo, Zelle, Cash, deposits, and “paid at pickup” notes.</small></div>
                <Banknote size={18} />
              </div>
              <div className="form-grid">
                <label>
                  Method
                  <select value={detailForm.paymentMethod} onChange={(event) => setDetailForm({ ...detailForm, paymentMethod: event.target.value })}>
                    {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                  </select>
                </label>
                <label>
                  Payment status
                  <select value={detailForm.paymentStatus} onChange={(event) => setDetailForm({ ...detailForm, paymentStatus: event.target.value })}>
                    {paymentStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label>Amount received<input type="number" min="0" step="0.01" value={detailForm.paymentAmount} onChange={(event) => setDetailForm({ ...detailForm, paymentAmount: event.target.value })} placeholder="0.00" /></label>
                <label>Payment notes<input value={detailForm.paymentNotes} onChange={(event) => setDetailForm({ ...detailForm, paymentNotes: event.target.value })} placeholder="Txn note, cash due, deposit…" /></label>
              </div>
            </section>
            {detailError ? <p className="form-error" role="alert">{detailError}</p> : null}
            <label>
              Customer-visible baker note
              <textarea
                value={detailForm.notes}
                onChange={(event) => setDetailForm({ ...detailForm, notes: event.target.value })}
                placeholder="Pickup details, customer-visible comment, payment reminder…"
              />
            </label>
            <label>
              Private internal note
              <textarea
                value={detailForm.internalNotes}
                onChange={(event) => setDetailForm({ ...detailForm, internalNotes: event.target.value })}
                placeholder="Kitchen-only notes, customer preferences, delivery reminders, private context…"
              />
            </label>
            <section className="order-notification-panel" aria-label="Customer status notifications">
              <div className="section-title-line">
                <div><strong>Customer notifications</strong><small>These buttons open your phone’s email or text app with the status message filled in. You still tap Send.</small></div>
                <Send size={18} />
              </div>
              <div className="form-grid">
                <label>Email<input type="email" value={detailForm.customerEmail} onChange={(event) => setDetailForm({ ...detailForm, customerEmail: event.target.value })} placeholder="Customer email" /></label>
                <label>Phone<input value={detailForm.customerPhone} onChange={(event) => setDetailForm({ ...detailForm, customerPhone: event.target.value })} placeholder="Customer phone" /></label>
              </div>
              <label>
                Message type
                <select disabled={!enabledNotificationEvents.length} value={notificationEvent} onChange={(event) => setNotificationEvent(event.target.value)}>
                  {!enabledNotificationEvents.length ? <option value="">All message events are off in Bakery Settings</option> : null}
                  {enabledNotificationEvents.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}
                </select>
              </label>
              <div className="local-notification-options">
                <label><input type="checkbox" disabled={!rules.emailNotifications || !detailForm.customerEmail.trim()} checked={rules.emailNotifications && detailForm.notifyEmail && Boolean(detailForm.customerEmail.trim())} onChange={(event) => setDetailForm({ ...detailForm, notifyEmail: event.target.checked })} /> Email updates requested</label>
                <label><input type="checkbox" disabled={!rules.smsNotifications || !detailForm.customerPhone.trim()} checked={rules.smsNotifications && detailForm.notifySms && Boolean(detailForm.customerPhone.trim())} onChange={(event) => setDetailForm({ ...detailForm, notifySms: event.target.checked })} /> Text updates requested</label>
              </div>
              <div className="notification-action-grid">
                <a
                  className={!rules.emailNotifications || !notificationEvent || !detailForm.notifyEmail || !detailForm.customerEmail.trim() ? "disabled" : ""}
                  aria-disabled={!rules.emailNotifications || !notificationEvent || !detailForm.notifyEmail || !detailForm.customerEmail.trim()}
                  href={rules.emailNotifications && notificationEvent && detailForm.notifyEmail && detailForm.customerEmail.trim() ? emailNotificationHref({
                    ...selectedOrder,
                    ...detailForm,
                    customerEmail: detailForm.customerEmail.trim(),
                    orderSlug: cloudAccount.workspace?.bakery?.slug || "loafers",
                  }, detailProgress, notificationEvent) : undefined}
                ><Mail size={16} /> Email status</a>
                <a
                  className={!rules.smsNotifications || !notificationEvent || !detailForm.notifySms || !detailForm.customerPhone.trim() ? "disabled" : ""}
                  aria-disabled={!rules.smsNotifications || !notificationEvent || !detailForm.notifySms || !detailForm.customerPhone.trim()}
                  href={rules.smsNotifications && notificationEvent && detailForm.notifySms && detailForm.customerPhone.trim() ? smsNotificationHref({
                    ...selectedOrder,
                    ...detailForm,
                    customerPhone: detailForm.customerPhone.trim(),
                    orderSlug: cloudAccount.workspace?.bakery?.slug || "loafers",
                  }, detailProgress, notificationEvent) : undefined}
                ><MessageSquareText size={16} /> Text status</a>
              </div>
            </section>
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
            {workflowLabel(selectedOrder.status) !== "Completed" ? (
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
