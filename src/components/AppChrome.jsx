import {
  BookOpen,
  CalendarDays,
  ChevronRight,
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

const desktopNavItems = [
  { id: "today", label: "Today", icon: House, page: "today" },
  { id: "orders", label: "Orders", icon: ClipboardList, page: "orders", showBadge: true },
  { id: "bake-desk", label: "Bake desk", icon: Croissant, page: "production", activeWhen: "bake-desk" },
  { id: "production", label: "Production", icon: ClipboardList, page: "production" },
  { id: "menu", label: "Menu", icon: Store, page: "menu" },
  { id: "logbook", label: "Logbook", icon: BookOpen, page: "business", activeWhen: "logbook" },
  { id: "customers", label: "Customers", icon: UserRound, page: "business", activeWhen: "customers" },
  { id: "reports", label: "Reports", icon: LineChart, page: "business", activeWhen: "business" },
  { id: "settings", label: "Settings", icon: Settings2, page: "settings" },
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

export function BottomNav({ active, onChange, orderBadgeCount = 0 }) {
  const badgeLabel = orderBadgeCount > 99 ? "99+" : String(orderBadgeCount || "");

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <div className="desktop-nav-brand" aria-hidden="true">
        <img src={LOAFERS_BRAND.badgeSrc} alt="" />
      </div>

      <div className="mobile-nav-items">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = active === id || (active === "settings" && id === "business");
          return (
            <button
              key={id}
              className={isActive ? "nav-item active" : "nav-item"}
              onClick={() => onChange(id)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.65} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="desktop-nav-items">
        {desktopNavItems.map(({ id, label, icon: Icon, page, activeWhen, showBadge }) => {
          const isActive = active === (activeWhen || page);
          return (
            <button
              key={id}
              className={isActive ? "nav-item active" : "nav-item"}
              onClick={() => onChange(page)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} />
              <span>{label}</span>
              {showBadge && badgeLabel ? <b className="nav-badge">{badgeLabel}</b> : null}
            </button>
          );
        })}
      </div>

      <div className="desktop-nav-footer">
        <button className="desktop-help-link" type="button" onClick={() => onChange("settings")}>
          <BookOpen size={18} />
          <span>Need help?</span>
        </button>
        <button className="desktop-profile-link" type="button" onClick={() => onChange("settings")}>
          <span className="desktop-profile-avatar">LB</span>
          <span>
            <strong>Loafers Bakery</strong>
            <small>Owner</small>
          </span>
          <ChevronRight size={17} />
        </button>
      </div>
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
