import {
  Box,
  CircleDollarSign,
  LineChart,
  Package,
  UsersRound,
} from "lucide-react";
import { PageHeading } from "../components/AppChrome";

export default function MorePage({ inventory, orders }) {
  const repeatCustomers = new Set(orders.map((order) => order.customer)).size;
  return (
    <main className="page">
      <PageHeading title="Trends" subtitle="A simple pulse check on your one-person bakery." />

      <section className="trend-card">
        <div className="section-title-line">
          <div><span className="eyebrow-label">4-week trend</span><h2>Sales are building</h2></div>
          <LineChart size={23} />
        </div>
        <div className="trend-number"><strong>$1,284</strong><span>+18% from last month</span></div>
        <svg viewBox="0 0 340 100" role="img" aria-label="Four week sales trend increasing">
          <path className="chart-fill" d="M0 88 C38 82,55 68,85 72 S135 84,170 55 S220 58,250 36 S305 20,340 10 L340 100 L0 100 Z" />
          <path className="chart-line" d="M0 88 C38 82,55 68,85 72 S135 84,170 55 S220 58,250 36 S305 20,340 10" />
        </svg>
        <div className="chart-labels"><span>May 25</span><span>Jun 1</span><span>Jun 8</span><span>Jun 15</span></div>
      </section>

      <section className="quick-metrics">
        <div><CircleDollarSign /><strong>$12.74</strong><span>avg. loaf</span></div>
        <div><Box /><strong>31</strong><span>loaves / week</span></div>
        <div><UsersRound /><strong>{repeatCustomers}</strong><span>active customers</span></div>
      </section>

      <section className="inventory-section">
        <div className="section-title-line"><h2>Inventory snapshot</h2></div>
        <div className="inventory-list">
          {inventory.map((item) => (
            <div className="inventory-row" key={item.id}>
              <Package size={18} />
              <span><strong>{item.name}</strong><small>Target {item.target} {item.unit}</small></span>
              <span className={item.status === "low" ? "inventory-low" : ""}>{item.amount} {item.unit}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
