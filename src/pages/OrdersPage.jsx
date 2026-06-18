import { CheckCircle2, Plus, Search, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/AppChrome";
import { EmptyState, Modal, Status } from "../components/Primitives";

const filters = ["All", "New", "Paid"];

export default function OrdersPage({ orders, onAddOrder }) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    customer: "",
    product: "Country Sourdough",
    quantity: 1,
    total: 13,
    due: "Saturday",
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

  function submitOrder(event) {
    event.preventDefault();
    if (!form.customer.trim()) return;
    onAddOrder(form);
    setShowAdd(false);
    setForm({
      customer: "",
      product: "Country Sourdough",
      quantity: 1,
      total: 13,
      due: "Saturday",
      status: "New",
    });
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

      <div className="search-row">
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
      </div>

      <section className="order-list">
        {filteredOrders.length ? filteredOrders.map((order) => (
          <article className="order-row" key={order.id}>
            <span className={`avatar avatar-${order.accent}`}>{order.initials}</span>
            <div className="order-main">
              <div className="order-title-line">
                <h3>{order.customer}</h3>
                <strong>${order.total}</strong>
              </div>
              <p>{order.quantity} × {order.product}</p>
              <div className="order-meta">
                <span>{order.due}</span>
                <Status tone={order.status === "Paid" ? "success" : order.status === "New" ? "accent" : "neutral"}>
                  {order.status === "Paid" ? <CheckCircle2 size={13} /> : <ShoppingBag size={13} />}
                  {order.status}
                </Status>
              </div>
            </div>
          </article>
        )) : <EmptyState title="No matching orders" body="Try a different status or customer name." />}
      </section>

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
              <label>
                Due
                <select value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })}>
                  <option>Tomorrow</option>
                  <option>Saturday</option>
                  <option>Sunday</option>
                </select>
              </label>
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
    </main>
  );
}
