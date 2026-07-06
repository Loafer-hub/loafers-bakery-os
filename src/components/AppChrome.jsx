import { useState } from "react";
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
  { id: "business", label: "Manage", icon: ClipboardList },
];

const desktopNavItems = [
  { id: "today", label: "Today", icon: House, page: "today" },
  { id: "orders", label: "Orders", icon: ClipboardList, page: "orders", showBadge: true },
  { id: "bake-desk", label: "Bake desk", icon: Croissant, page: "production", productionView: "bake" },
  { id: "production", label: "Production", icon: ClipboardList, page: "production", productionView: "operations", productionArea: "calendar" },
  { id: "menu", label: "Menu", icon: Store, page: "menu" },
  { id: "management", label: "Management", icon: ClipboardList, page: "business", businessFocus: "management" },
  { id: "reports", label: "Reports", icon: LineChart, page: "business", businessFocus: "reports" },
  { id: "logbook", label: "Logbook", icon: BookOpen, page: "business", businessFocus: "logbook" },
  { id: "customers", label: "Customers", icon: UserRound, page: "business", businessFocus: "customers" },
  { id: "settings", label: "Settings", icon: Settings2, page: "settings" },
];

const mobileOwnerNavItems = [
  ...desktopNavItems,
  { id: "help", label: "Need help?", icon: BookOpen, page: "help" },
  { id: "resources", label: "Owner resources", icon: UserRound, page: "resources" },
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

export function BottomNav({ active, activeNavKey = active, onChange, orderBadgeCount = 0 }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const badgeLabel = orderBadgeCount > 99 ? "99+" : String(orderBadgeCount || "");

  const navigateFromMobile = ({ id, page, productionView, productionArea, businessFocus }) => {
    onChange(page, { navKey: id, productionView, productionArea, businessFocus });
    setMobileMenuOpen(false);
  };

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

      <div className={mobileMenuOpen ? "mobile-owner-menu open" : "mobile-owner-menu"}>
        {mobileMenuOpen ? (
          <button
            className="mobile-owner-menu-scrim"
            type="button"
            aria-label="Close owner menu"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}
        <div className="mobile-owner-menu-dock">
          {mobileMenuOpen ? (
            <div className="mobile-owner-menu-panel" role="dialog" aria-label="Owner navigation">
              <div className="mobile-owner-menu-header">
                <span>
                  <strong>Loafers Home Bakery</strong>
                  <small>Owner workspace</small>
                </span>
                <button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="mobile-owner-menu-list">
                {mobileOwnerNavItems.map((item) => {
                  const { id, label, icon: Icon, page, showBadge } = item;
                  const isActive = activeNavKey === id || (!activeNavKey && active === page);
                  return (
                    <button
                      key={id}
                      className={isActive ? "mobile-owner-menu-item active" : "mobile-owner-menu-item"}
                      type="button"
                      onClick={() => navigateFromMobile(item)}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                      {showBadge && badgeLabel ? <b className="nav-badge">{badgeLabel}</b> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <button
            className="mobile-owner-menu-toggle"
            type="button"
            aria-label={mobileMenuOpen ? "Close owner menu" : "Open owner menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            {mobileMenuOpen ? <X size={23} /> : <Plus size={25} />}
            <span>Menu</span>
            {!mobileMenuOpen && badgeLabel ? <b className="nav-badge">{badgeLabel}</b> : null}
          </button>
        </div>
      </div>

      <div className="desktop-nav-items">
        {desktopNavItems.map(({ id, label, icon: Icon, page, productionView, productionArea, businessFocus, showBadge }) => {
          const isActive = activeNavKey === id || (!activeNavKey && active === page);
          return (
            <button
              key={id}
              className={isActive ? "nav-item active" : "nav-item"}
              onClick={() => onChange(page, { navKey: id, productionView, productionArea, businessFocus })}
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
        <button
          className={activeNavKey === "help" ? "desktop-help-link active" : "desktop-help-link"}
          type="button"
          onClick={() => onChange("help", { navKey: "help" })}
        >
          <BookOpen size={18} />
          <span>Need help?</span>
        </button>
        <button
          className={activeNavKey === "resources" ? "desktop-profile-link active" : "desktop-profile-link"}
          type="button"
          onClick={() => onChange("resources", { navKey: "resources" })}
        >
          <span className="desktop-profile-avatar">LB</span>
          <span>
            <strong>Loafers Bakery</strong>
            <small>Owner resources</small>
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
