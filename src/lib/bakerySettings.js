import { normalizeProductTypeSettings } from "./productTypes";

// product-type-settings-v1

export const DEFAULT_BAKERY_SETTINGS = {
  onlineOrdering: true,
  allowGuestCheckout: true,
  requireSignInForOrders: false,
  trackMyBakePublic: true,
  reviewsVisible: true,
  feedbackEnabled: true,
  readyShelfEnabled: true,
  customerPasswordAccountsEnabled: true,
  customerReorderEnabled: true,
  customerProfileSavingEnabled: true,
  announcementEnabled: false,
  announcementTitle: "From the baker",
  announcementText: "",
  emailNotifications: true,
  automaticEmailNotifications: true,
  emailReplyTo: "",
  smsNotifications: true,
  dailyCapacity: 6,
  orderWindowDays: 30,
  leadTimeDays: 0,
  pickupIntervalMinutes: 30,
  pickupLocation: "Three Bears, Delta Junction, AK",
  orderingIntro: "Fresh sourdough, made in small batches. Request a pickup below.",
  weekdayWindows: [
    { start: "07:00", end: "08:30" },
    { start: "17:00", end: "20:00" },
  ],
  weekendWindows: [
    { start: "13:00", end: "16:30" },
  ],
  notificationEvents: {
    accepted: true,
    bakeProgress: true,
    comments: true,
    ready: true,
    rejected: true,
    completed: true,
  },
};

const TIME_PATTERN = /^\d{2}:\d{2}$/;

function normalizedWindows(value, fallback) {
  if (!Array.isArray(value) || !value.length) return fallback;
  const windows = value
    .map((window) => ({
      start: TIME_PATTERN.test(window?.start || "") ? window.start : "",
      end: TIME_PATTERN.test(window?.end || "") ? window.end : "",
    }))
    .filter((window) => window.start && window.end && window.start <= window.end);
  return windows.length ? windows : fallback;
}

export function normalizedBakerySettings(value = {}) {
  const settings = {
    ...DEFAULT_BAKERY_SETTINGS,
    ...(value || {}),
    notificationEvents: {
      ...DEFAULT_BAKERY_SETTINGS.notificationEvents,
      ...(value?.notificationEvents || {}),
    },
  };
  const hasPasswordAccountSetting = Object.prototype.hasOwnProperty.call(value || {}, "customerPasswordAccountsEnabled");
  const customerPasswordAccountsEnabled = settings.customerPasswordAccountsEnabled !== false;
  return {
    ...settings,
    onlineOrdering: Boolean(settings.onlineOrdering),
    allowGuestCheckout: true,
    requireSignInForOrders: false,
    trackMyBakePublic: Boolean(settings.trackMyBakePublic),
    reviewsVisible: Boolean(settings.reviewsVisible),
    feedbackEnabled: Boolean(settings.feedbackEnabled),
    readyShelfEnabled: Boolean(settings.readyShelfEnabled),
    customerPasswordAccountsEnabled,
    customerReorderEnabled: customerPasswordAccountsEnabled && (hasPasswordAccountSetting ? settings.customerReorderEnabled !== false : true),
    customerProfileSavingEnabled: customerPasswordAccountsEnabled && (hasPasswordAccountSetting ? settings.customerProfileSavingEnabled !== false : true),
    announcementEnabled: Boolean(settings.announcementEnabled),
    announcementTitle: String(settings.announcementTitle || DEFAULT_BAKERY_SETTINGS.announcementTitle).trim(),
    announcementText: String(settings.announcementText || "").trim(),
    emailNotifications: Boolean(settings.emailNotifications),
    automaticEmailNotifications: Boolean(settings.automaticEmailNotifications),
    emailReplyTo: String(settings.emailReplyTo || "").trim().toLowerCase(),
    smsNotifications: Boolean(settings.smsNotifications),
    dailyCapacity: Math.max(1, Math.min(24, Number(settings.dailyCapacity || 6))),
    orderWindowDays: Math.max(1, Math.min(90, Number(settings.orderWindowDays || 30))),
    leadTimeDays: Math.max(0, Math.min(14, Number(settings.leadTimeDays || 0))),
    pickupIntervalMinutes: [15, 30, 60].includes(Number(settings.pickupIntervalMinutes))
      ? Number(settings.pickupIntervalMinutes)
      : 30,
    pickupLocation: String(settings.pickupLocation || DEFAULT_BAKERY_SETTINGS.pickupLocation).trim(),
    orderingIntro: String(settings.orderingIntro || DEFAULT_BAKERY_SETTINGS.orderingIntro).trim(),
    weekdayWindows: normalizedWindows(settings.weekdayWindows, DEFAULT_BAKERY_SETTINGS.weekdayWindows),
    weekendWindows: normalizedWindows(settings.weekendWindows, DEFAULT_BAKERY_SETTINGS.weekendWindows),
    productTypes: normalizeProductTypeSettings(settings),
  };
}

export function notificationEventOptions(settings) {
  const normalized = normalizedBakerySettings(settings);
  return [
    { id: "accepted", label: "Order accepted" },
    { id: "bakeProgress", label: "Bake progress" },
    { id: "comments", label: "Baker comment" },
    { id: "ready", label: "Ready for pickup" },
    { id: "rejected", label: "Order rejected" },
    { id: "completed", label: "Order completed" },
  ].filter((event) => normalized.notificationEvents[event.id]);
}
