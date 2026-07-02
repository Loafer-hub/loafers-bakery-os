import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Croissant,
  House,
  LineChart,
  Plus,
  Settings2,
  Store,
  X,
  UserRound,
} from "lucide-react";
import { LOAFERS_BRAND } from "../lib/brand";

const navItems = [
  { id: "today", label: "Today", icon: House },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "production", label: "Production", icon: Croissant },
  { id: "menu", label: "Menu", icon: Store },
  { id: "business", label: "Business", icon: LineChart },
];

export function BrandHeader({ compact = false, onOpenSettings, onOpenStorage }) {
  const actions = (
    <span className="brand-actions">
      {onOpenSettings ? (
        <button className="icon-button subtle" aria-label="Open bakery settings" onClick={onOpenSettings}>
          <Settings2 size={compact ? 19 : 21} />
        </button>
      ) : null}
      <button className="icon-button" aria-label="Open storage and backup" onClick={onOpenStorage}>
        <UserRound size={compact ? 21 : 23} />
      </button>
    </span>
  );

  if (compact) {
    return (
      <header className="compact-brand">
        <div className="brand-lockup">
          <span className="brand-mark"><img src={LOAFERS_BRAND.badgeSrc} alt="" /></span>
          <span>
            <span className="brand-name">{LOAFERS_BRAND.shortName}</span>
            <span className="brand-subname">Home Bakery</span>
          </span>
        </div>
        {actions}
      </header>
    );
  }

  return (
    <header className="brand-header">
      <div className="brand-lockup">
        <span className="brand-mark"><img src={LOAFERS_BRAND.badgeSrc} alt="" /></span>
        <span>
          <span className="brand-name">{LOAFERS_BRAND.shortName}</span>
          <span className="brand-subname">Home Bakery</span>
        </span>
      </div>
      {actions}
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

export function GlobalQuickAction({ isOpen, onClose, onOpen, actions = [] }) {
  return (
    <>
      <button
        className={isOpen ? "global-quick-action open" : "global-quick-action"}
        type="button"
        onClick={isOpen ? onClose : onOpen}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
      >
        {isOpen ? <X size={22} /> : <Plus size={24} />}
      </button>
      {isOpen ? (
        <div className="quick-action-popover" role="dialog" aria-label="Quick actions">
          <strong>Quick actions</strong>
          <div>
            {actions.map(({ icon: Icon, label, note, onClick }) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  onClick?.();
                  onClose?.();
                }}
              >
                <span>{Icon ? <Icon size={17} /> : <BookOpen size={17} />}</span>
                <span><b>{label}</b><small>{note}</small></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
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
