import { pickupDateKey } from "./orderCapacity";

export const CLOSED_ORDER_STATUS_KEYS = new Set([
  "completed",
  "rejected",
  "declined",
  "cancelled",
  "canceled",
]);

export const PRODUCTION_ORDER_STATUS_KEYS = new Set([
  "",
  "new",
  "request",
  "requested",
  "pending",
  "submitted",
  "accepted",
  "confirmed",
  "paid",
  "deposit",
  "deposit paid",
  "in progress",
  "ready",
  "picked up",
]);

export function statusKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function isClosedOrder(order) {
  return CLOSED_ORDER_STATUS_KEYS.has(statusKey(order?.status));
}

export function isProductionOrder(order) {
  const status = statusKey(order?.status);
  return order?.isSample !== true
    && !isClosedOrder(order)
    && (!status || PRODUCTION_ORDER_STATUS_KEYS.has(status));
}

export function orderCapacityUnits(order = {}) {
  const candidates = [
    order.totalUnits,
    order.quantity,
    order.packageCount,
  ];
  const value = candidates.map(Number).find((number) => Number.isFinite(number) && number > 0);
  return value || 1;
}

export function orderProductionDateKey(order = {}) {
  return pickupDateKey(order.pickupAt || order.pickupDate || order.date || order.due);
}

export function acceptedOrderBakesFromOrders(orders = []) {
  return orders
    .filter(isProductionOrder)
    .flatMap((order) => {
      const date = orderProductionDateKey(order);
      if (!date) return [];
      return [{
        id: `accepted-${order.id || order.cloudOrderId || date}`,
        date,
        customer: order.customer || "Customer",
        recipeName: order.product || order.itemSummary || "Order",
        loaves: orderCapacityUnits(order),
        orderId: order.id,
        kind: "accepted-order",
      }];
    });
}

export function customerIdFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function customerEmailKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function customerPhoneKey(value) {
  return String(value || "").replace(/\D/g, "");
}

export function customerAliasKeys({ customerId, customerUserId, email, phone, name }) {
  return [
    customerUserId ? `account:${customerUserId}` : "",
    customerId ? `cloud:${customerId}` : "",
    customerEmailKey(email) ? `email:${customerEmailKey(email)}` : "",
    customerPhoneKey(phone) ? `phone:${customerPhoneKey(phone)}` : "",
    customerIdFromName(name) ? `name:${customerIdFromName(name)}` : "",
  ].filter(Boolean);
}

export function customerIdFromAliases(aliases, fallback = "") {
  const preferred = aliases.find((alias) => !alias.startsWith("name:")) || aliases[0];
  return preferred
    ? preferred.replace(":", "-").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()
    : fallback;
}

function rememberCustomerAliases(aliasMap, aliases, id) {
  aliases.forEach((alias) => aliasMap.set(alias, id));
}

export function orderProductNames(order) {
  const itemNames = (order.items || [])
    .map((item) => item.product_name || item.name)
    .filter(Boolean);
  return itemNames.length ? itemNames : [order.product || order.itemSummary].filter(Boolean);
}

export function orderTimestamp(order) {
  const candidates = [order.pickupAt, order.createdAt, order.date, order.due];
  for (const value of candidates) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return 0;
}

export function isActiveCustomerOrder(order) {
  return order?.isSample !== true && !isClosedOrder(order);
}

export function blankCustomerProfile(name = "") {
  const id = customerIdFromName(name) || `customer-${Date.now()}`;
  return {
    id,
    name,
    email: "",
    phone: "",
    customerId: "",
    customerUserId: "",
    allergies: "",
    preferences: "",
    address: "",
    pickupNotes: "",
    paymentNotes: "",
    favoriteItems: "",
    notes: "",
  };
}

export function buildCustomerRecords(orders = [], profiles = [], options = {}) {
  const includeSamples = options.includeSamples === true;
  const byId = new Map();
  const aliasesById = new Map();

  profiles.forEach((profile) => {
    const aliases = customerAliasKeys({
      customerId: profile.customerId,
      customerUserId: profile.customerUserId,
      email: profile.email,
      phone: profile.phone,
      name: profile.name,
    });
    const id = profile.id || customerIdFromAliases(aliases, customerIdFromName(profile.name));
    if (!id) return;
    byId.set(id, {
      ...blankCustomerProfile(profile.name),
      ...profile,
      id,
      orders: [],
    });
    rememberCustomerAliases(aliasesById, aliases, id);
  });

  orders.forEach((order) => {
    if (!includeSamples && order.isSample === true) return;
    const aliases = customerAliasKeys({
      customerId: order.customerId,
      customerUserId: order.customerUserId,
      email: order.customerEmail,
      phone: order.customerPhone,
      name: order.customer,
    });
    const matchedId = aliases.map((alias) => aliasesById.get(alias)).find(Boolean);
    const id = matchedId || customerIdFromAliases(aliases, `order-customer-${order.id}`);
    const existing = byId.get(id) || {
      ...blankCustomerProfile(order.customer),
      id,
      orders: [],
    };
    byId.set(id, {
      ...existing,
      name: existing.name || order.customer || "Customer",
      email: existing.email || order.customerEmail || "",
      phone: existing.phone || order.customerPhone || "",
      customerId: existing.customerId || order.customerId || "",
      customerUserId: existing.customerUserId || order.customerUserId || "",
      allergies: existing.allergies || order.allergies || "",
      orders: [...existing.orders, order],
    });
    rememberCustomerAliases(aliasesById, aliases, id);
  });

  return Array.from(byId.values()).map((customer) => {
    const sortedOrders = [...customer.orders].sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
    const activeOrders = sortedOrders.filter(isActiveCustomerOrder);
    const totalSpent = sortedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const products = [...new Set(sortedOrders.flatMap(orderProductNames))].slice(0, 4);
    return {
      ...customer,
      orders: sortedOrders,
      activeOrders,
      isActive: activeOrders.length > 0,
      lastOrderAt: sortedOrders[0] ? orderTimestamp(sortedOrders[0]) : 0,
      firstOrderAt: sortedOrders.length ? orderTimestamp(sortedOrders[sortedOrders.length - 1]) : 0,
      totalSpent,
      favoriteItems: customer.favoriteItems || products.join(", "),
    };
  }).sort((a, b) => (
    Number(b.isActive) - Number(a.isActive)
    || b.lastOrderAt - a.lastOrderAt
    || String(a.name || "").localeCompare(String(b.name || ""))
  ));
}
