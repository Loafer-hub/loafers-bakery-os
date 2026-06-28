import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Croissant,
  Droplets,
  House,
  LineChart,
  UserRound,
  Wheat,
} from "lucide-react";

const navItems = [
  { id: "today", label: "Today", icon: House },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "bake", label: "Bake", icon: Croissant },
  { id: "liquid", label: "Liquid", icon: Droplets },
  { id: "recipes", label: "Recipes", icon: BookOpen },
  { id: "more", label: "Trends", icon: LineChart },
];

export function BrandHeader({ compact = false, onOpenStorage }) {
  if (compact) {
    return (
      <header className="compact-brand">
        <div className="brand-lockup">
          <span className="brand-mark"><Wheat size={20} strokeWidth={1.8} /></span>
          <span className="brand-name">Loafers</span>
        </div>
        <button className="icon-button" aria-label="Open storage and backup" onClick={onOpenStorage}>
          <UserRound size={21} />
        </button>
      </header>
    );
  }

  return (
    <header className="brand-header">
      <div className="brand-lockup">
        <span className="brand-mark"><Wheat size={23} strokeWidth={1.8} /></span>
        <span className="brand-name">Loafers</span>
      </div>
      <button className="icon-button" aria-label="Open storage and backup" onClick={onOpenStorage}>
        <UserRound size={23} />
      </button>
    </header>
  );
}

export function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={active === id ? "nav-item active" : "nav-item"}
          onClick={() => onChange(id)}
          aria-current={active === id ? "page" : undefined}
        >
          <Icon size={22} strokeWidth={active === id ? 2.2 : 1.65} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function PageHeading({ title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DateStamp() {
  return (
    <span className="date-stamp">
      <CalendarDays size={15} />
      June 18, 2026
    </span>
  );
}
