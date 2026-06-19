import {
  ArrowRight,
  ChevronRight,
  Gauge,
  ShoppingBag,
  Thermometer,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { BrandHeader } from "../components/AppChrome";

function BakeTimeline() {
  const steps = [
    { label: "Mix", time: "6:30 AM" },
    { label: "Shape", time: "11:45 AM" },
    { label: "Bake", time: "4:30 PM" },
  ];

  return (
    <div className="bake-timeline" aria-label="Today's bake timeline">
      <div className="timeline-line" />
      {steps.map((step, index) => (
        <div className="timeline-step" key={step.label}>
          <span className={index === 0 ? "timeline-number active" : "timeline-number"}>{index + 1}</span>
          <span className="timeline-art">
            {index === 0 ? <Wheat size={27} /> : index === 1 ? <span className="dough-glyph">◒</span> : <span className="loaf-glyph">╱╱╱</span>}
          </span>
          <strong>{step.label}</strong>
          <span>{step.time}</span>
        </div>
      ))}
    </div>
  );
}

export default function TodayPage({ orders, setActive, onLogStarter, onOpenOrder }) {
  const todayOrders = orders.filter((order) => order.due === "Today");
  const totalLoaves = todayOrders.reduce((sum, order) => sum + order.quantity, 0);
  const revenue = todayOrders.reduce((sum, order) => sum + order.total, 0);

  return (
    <main className="page today-page">
      <BrandHeader />
      <section className="greeting">
        <h1>Good morning, Joshua</h1>
        <p>Thursday, June 18</p>
      </section>

      <section>
        <h2 className="display-title">Today’s bake</h2>
        <BakeTimeline />
      </section>

      <button className="starter-panel" onClick={onLogStarter}>
        <span className="starter-illustration"><Wheat size={39} strokeWidth={1.4} /></span>
        <span className="starter-copy">
          <span className="panel-title">Mabel</span>
          <span className="starter-ready">Ready in 1h 20m</span>
          <span className="starter-stats">
            <span><TrendingUp size={18} /> <b>2.1×</b> rise</span>
            <span><Thermometer size={18} /> <b>76°F</b></span>
          </span>
        </span>
        <ChevronRight size={22} className="panel-chevron" />
      </button>

      <section className="order-panel">
        <div className="panel-heading">
          <span><ShoppingBag size={21} /> Order summary</span>
          <button onClick={() => setActive("orders")}>
            {totalLoaves} loaves&nbsp; / &nbsp;${revenue}
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="order-preview-list">
          {todayOrders.map((order) => (
            <button className="order-preview" key={order.id} onClick={() => onOpenOrder(order.id)}>
              <span className={`avatar avatar-${order.accent}`}>{order.initials}</span>
              <span className="order-preview-copy">
                <strong>{order.customer}</strong>
                <small>{order.quantity} × {order.product}</small>
              </span>
              <span className="order-preview-price">
                <strong>${order.total}</strong>
                <small>{order.status}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        <div className="capacity-row">
          <Gauge size={21} />
          <span><b>{totalLoaves}</b> of 10 loaves</span>
          <span className="capacity-track" aria-label={`${totalLoaves} of 10 loaves planned`}>
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} className={index < totalLoaves ? "filled" : ""} />
            ))}
          </span>
        </div>
        <button className="primary-button" onClick={() => setActive("bake")}>
          Plan next bake <ArrowRight size={19} />
        </button>
      </section>
    </main>
  );
}
