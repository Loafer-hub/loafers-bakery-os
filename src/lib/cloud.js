import { createClient } from "@supabase/supabase-js";
import { normalizedBakerySettings } from "./bakerySettings";
import { normalizedSalesOptions } from "./salesOptions";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const cloudConfigured = Boolean(supabaseUrl && supabaseKey);

let client;

export function getCloudClient() {
  if (!cloudConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

function requireClient() {
  const nextClient = getCloudClient();
  if (!nextClient) {
    throw new Error("Cloud storage has not been connected yet.");
  }
  return nextClient;
}

function throwIfError(error) {
  if (error) throw new Error(error.message || "The cloud request failed.");
}

export async function getCloudSession() {
  if (!cloudConfigured) return null;
  const { data, error } = await requireClient().auth.getSession();
  throwIfError(error);
  return data.session;
}

export function onCloudAuthChange(callback) {
  if (!cloudConfigured) return () => {};
  const { data } = requireClient().auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmail(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  throwIfError(error);
  return data;
}

export async function signUpBaker({ email, password, fullName, bakeryName, slug }) {
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        account_type: "baker",
        full_name: fullName,
        bakery_name: bakeryName,
        bakery_slug: slug,
      },
    },
  });
  throwIfError(error);
  return data;
}

export async function signUpCustomer({ email, password, fullName }) {
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        account_type: "customer",
        full_name: fullName,
      },
    },
  });
  throwIfError(error);
  return data;
}

export async function signOutCloud() {
  const { error } = await requireClient().auth.signOut();
  throwIfError(error);
}

export async function loadBakerWorkspace(userId) {
  if (!userId) return null;
  const { data, error } = await requireClient()
    .from("bakery_members")
    .select("bakery_id, role, bakeries(id, name, slug, public_ordering, ordering_intro, pickup_location, payment_methods)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return {
    bakeryId: data.bakery_id,
    role: data.role,
    bakery: data.bakeries,
  };
}

export async function loadBakerySettings(bakeryId) {
  if (!bakeryId) return null;
  const { data, error } = await requireClient()
    .from("bakery_settings")
    .select("settings")
    .eq("bakery_id", bakeryId)
    .maybeSingle();
  throwIfError(error);
  return normalizedBakerySettings(data?.settings || {});
}

export async function saveBakerySettings(bakeryId, settings) {
  const normalized = normalizedBakerySettings(settings);
  const timestamp = new Date().toISOString();
  const [settingsResult, bakeryResult] = await Promise.all([
    requireClient()
      .from("bakery_settings")
      .upsert({
        bakery_id: bakeryId,
        settings: normalized,
        updated_at: timestamp,
      }, { onConflict: "bakery_id" }),
    requireClient()
      .from("bakeries")
      .update({
        public_ordering: normalized.onlineOrdering,
        ordering_intro: normalized.orderingIntro,
        pickup_location: normalized.pickupLocation,
        updated_at: timestamp,
      })
      .eq("id", bakeryId),
  ]);
  throwIfError(settingsResult.error);
  throwIfError(bakeryResult.error);
  return normalized;
}

export async function uploadCloudSnapshot(bakeryId, backup, userId) {
  const { data, error } = await requireClient()
    .from("bakery_snapshots")
    .upsert({
      bakery_id: bakeryId,
      data: backup,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("updated_at")
    .single();
  throwIfError(error);
  return data;
}

export async function downloadCloudSnapshot(bakeryId) {
  const { data, error } = await requireClient()
    .from("bakery_snapshots")
    .select("data, updated_at")
    .eq("bakery_id", bakeryId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function publishRecipeCatalog(bakeryId, recipes) {
  const products = recipes.map((recipe, index) => {
    const salesOptions = normalizedSalesOptions(recipe);
    return {
      bakery_id: bakeryId,
      recipe_id: String(recipe.id),
      name: recipe.name,
      description: recipe.note || "",
      price_cents: Math.min(...salesOptions.map((option) => Math.round(option.price * 100))),
      sales_options: salesOptions.map((option) => ({
        id: option.id,
        label: option.label,
        units: option.units,
        price_cents: Math.round(option.price * 100),
        capacity_units: option.capacityUnits,
      })),
      recipe_details: {
        yield: Math.max(1, Number(recipe.yield || 1)),
        unitName: recipe.unitName || "loaf",
        hydration: Number(recipe.hydration || 0),
        ingredients: (recipe.ingredients || []).map((ingredient) => ({
          name: ingredient.name,
          weight: Number(ingredient.weight || 0),
          percent: Number(ingredient.percent || 0),
          category: ingredient.category || "",
          flourType: ingredient.flourType || "",
        })),
      },
      active: true,
      sort_order: index,
    };
  });

  if (products.length) {
    const { error } = await requireClient()
      .from("products")
      .upsert(products, { onConflict: "bakery_id,recipe_id" });
    throwIfError(error);
  }

  const { data: existing, error: listError } = await requireClient()
    .from("products")
    .select("id, recipe_id")
    .eq("bakery_id", bakeryId);
  throwIfError(listError);

  const currentIds = new Set(products.map((product) => product.recipe_id));
  const removedIds = (existing || [])
    .filter((product) => !currentIds.has(product.recipe_id))
    .map((product) => product.id);

  if (removedIds.length) {
    const { error } = await requireClient()
      .from("products")
      .update({ active: false })
      .in("id", removedIds);
    throwIfError(error);
  }

  return products.length;
}

export async function loadPublicStorefront(slug) {
  const { data: config, error: configError } = await requireClient().rpc(
    "get_public_storefront_config",
    { p_slug: slug },
  );
  throwIfError(configError);
  if (!config?.bakery) return null;
  const bakery = config.bakery;
  const settings = normalizedBakerySettings(config.settings || {});
  if (!settings.onlineOrdering) {
    return { bakery, settings, products: [], shelf: [], reviews: [] };
  }

  const [productsResult, shelfResult, reviewsResult] = await Promise.all([
    requireClient()
      .from("products")
      .select("id, recipe_id, name, description, price_cents, sales_options, recipe_details, sort_order")
      .eq("bakery_id", bakery.id)
      .eq("active", true)
      .order("sort_order"),
    settings.readyShelfEnabled ? requireClient()
      .from("ready_shelf_items")
      .select("id, name, description, baked_on, quantity, price_cents")
      .eq("bakery_id", bakery.id)
      .eq("active", true)
      .gt("quantity", 0)
      .order("baked_on", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    settings.reviewsVisible ? requireClient().rpc("get_public_reviews", {
      p_slug: slug,
      p_limit: 12,
    }) : Promise.resolve({ data: [], error: null }),
  ]);
  throwIfError(productsResult.error);
  throwIfError(shelfResult.error);
  throwIfError(reviewsResult.error);
  return {
    bakery,
    settings,
    products: productsResult.data || [],
    shelf: shelfResult.data || [],
    reviews: reviewsResult.data || [],
  };
}

export async function loadPublicOrderCapacity(slug, from, to) {
  const { data, error } = await requireClient().rpc("get_public_order_capacity", {
    p_slug: slug,
    p_from: from,
    p_to: to,
  });
  throwIfError(error);
  return data || [];
}

export async function lookupCustomerOrder({ slug, requestCode, contact }) {
  const { data, error } = await requireClient().rpc("lookup_customer_order", {
    p_slug: slug,
    p_request_code: requestCode,
    p_contact: contact,
  });
  throwIfError(error);
  return data;
}

export async function submitCustomerFeedback({
  slug,
  requestCode,
  contact,
  feedbackType,
  rating,
  message,
}) {
  const { data, error } = await requireClient().rpc("submit_customer_feedback", {
    p_slug: slug,
    p_request_code: requestCode,
    p_contact: contact,
    p_feedback_type: feedbackType,
    p_rating: feedbackType === "review" ? rating : null,
    p_message: message,
  });
  throwIfError(error);
  return data;
}

export async function submitPublicOrder({
  slug,
  customer,
  items,
  pickupAt,
  paymentMethod,
  allergies,
  notes,
  notifications,
}) {
  const { data, error } = await requireClient().rpc("submit_public_order", {
    p_slug: slug,
    p_customer: customer,
    p_items: items,
    p_pickup_at: pickupAt || null,
    p_payment_method: paymentMethod || "Cash",
    p_allergies: allergies || "",
    p_notes: notes || "",
    p_notifications: notifications || {},
  });
  throwIfError(error);
  return data;
}

async function invokeOrderEmail(body, { throwOnError = false } = {}) {
  try {
    const { data, error } = await requireClient().functions.invoke("send-order-email", { body });
    if (error) {
      if (throwOnError) throw new Error(error.message || "The email service could not be reached.");
      return { sent: false, error: error.message || "The email service could not be reached." };
    }
    if (data?.error) {
      if (throwOnError) throw new Error(data.error);
      return { sent: false, error: data.error };
    }
    return data || { sent: false };
  } catch (error) {
    if (throwOnError) throw error;
    return { sent: false, error: error.message || "The automatic email could not be sent." };
  }
}

export async function getAutomaticEmailStatus(bakeryId) {
  return invokeOrderEmail({ action: "status", bakeryId }, { throwOnError: true });
}

export async function sendAutomaticEmailTest(bakeryId, recipient) {
  return invokeOrderEmail({
    action: "test",
    bakeryId,
    recipient: recipient.trim().toLowerCase(),
  }, { throwOnError: true });
}

export async function sendAutomaticOrderEmail(bakeryId, orderId, eventType) {
  return invokeOrderEmail({
    action: "send",
    bakeryId,
    orderId,
    eventType,
  });
}

export async function listEmailNotificationDeliveries(bakeryId, limit = 20) {
  const { data, error } = await requireClient()
    .from("email_notification_deliveries")
    .select("id, order_id, event_type, recipient, subject, status, provider_message_id, error_message, created_at, sent_at")
    .eq("bakery_id", bakeryId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, Number(limit || 20))));
  throwIfError(error);
  return data || [];
}

export async function listCustomerOrderRequests(bakeryId, status = "requested") {
  const { data, error } = await requireClient()
    .from("customer_orders")
    .select(`
      id,
      request_code,
      status,
      pickup_at,
      subtotal_cents,
      customer_name,
      customer_email,
      customer_phone,
      notify_email,
      notify_sms,
      payment_method,
      pickup_location,
      allergies,
      customer_notes,
      baker_notes,
      bake_progress,
      created_at,
      customer_order_items(id, product_name, unit_price_cents, quantity, sale_option_id, sale_option_label, units_per_pack, capacity_units)
    `)
    .eq("bakery_id", bakeryId)
    .eq("status", status)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function acceptCustomerOrderRequest(orderId, bakerNotes = "", bakeryId = "") {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      status: "accepted",
      baker_notes: bakerNotes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
  return bakeryId ? sendAutomaticOrderEmail(bakeryId, orderId, "accepted") : { sent: false };
}

export async function commentCustomerOrderRequest(orderId, bakerNotes, bakeryId = "") {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      baker_notes: bakerNotes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
  return bakeryId && bakerNotes.trim()
    ? sendAutomaticOrderEmail(bakeryId, orderId, "comments")
    : { sent: false, skipped: true };
}

export async function rejectCustomerOrderRequest(orderId, bakerNotes, bakeryId = "") {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      status: "declined",
      baker_notes: bakerNotes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
  return bakeryId ? sendAutomaticOrderEmail(bakeryId, orderId, "rejected") : { sent: false };
}

export async function completeCustomerOrder(orderId, bakeryId = "") {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
  return bakeryId ? sendAutomaticOrderEmail(bakeryId, orderId, "completed") : { sent: false };
}

export async function updateCustomerOrderBakeProgress(
  orderId,
  bakeProgress,
  bakeryId = "",
  { notify = true } = {},
) {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      bake_progress: bakeProgress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
  if (!bakeryId || !notify) return { sent: false };
  return sendAutomaticOrderEmail(
    bakeryId,
    orderId,
    bakeProgress?.ready ? "ready" : "bakeProgress",
  );
}

export async function updateCustomerOrderNotificationPreferences(orderId, {
  customerEmail,
  customerPhone,
  notifyEmail,
  notifySms,
}) {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      customer_email: customerEmail.trim().toLowerCase(),
      customer_phone: customerPhone.trim(),
      notify_email: Boolean(notifyEmail && customerEmail.trim()),
      notify_sms: Boolean(notifySms && customerPhone.trim()),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
}

export async function listBakeryUnavailableDays(bakeryId) {
  const { data, error } = await requireClient()
    .from("bakery_unavailable_days")
    .select("id, unavailable_date, reason")
    .eq("bakery_id", bakeryId)
    .order("unavailable_date");
  throwIfError(error);
  return data || [];
}

export async function blockBakeryDay(bakeryId, unavailableDate, reason = "Baker unavailable") {
  const { data, error } = await requireClient()
    .from("bakery_unavailable_days")
    .upsert({
      bakery_id: bakeryId,
      unavailable_date: unavailableDate,
      reason,
    }, { onConflict: "bakery_id,unavailable_date" })
    .select("id, unavailable_date, reason")
    .single();
  throwIfError(error);
  return data;
}

export async function unblockBakeryDay(bakeryId, unavailableDate) {
  const { error } = await requireClient()
    .from("bakery_unavailable_days")
    .delete()
    .eq("bakery_id", bakeryId)
    .eq("unavailable_date", unavailableDate);
  throwIfError(error);
}

export async function listCustomerFeedback(bakeryId) {
  const { data, error } = await requireClient()
    .from("customer_feedback")
    .select("id, feedback_type, rating, message, customer_name, created_at, read_at")
    .eq("bakery_id", bakeryId)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function deleteCustomerFeedback(feedbackId) {
  const { error } = await requireClient()
    .from("customer_feedback")
    .delete()
    .eq("id", feedbackId);
  throwIfError(error);
}

export async function listReadyShelfItems(bakeryId) {
  const { data, error } = await requireClient()
    .from("ready_shelf_items")
    .select("id, name, description, baked_on, quantity, price_cents, active, created_at, updated_at")
    .eq("bakery_id", bakeryId)
    .order("baked_on", { ascending: false })
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function saveReadyShelfItem(bakeryId, item) {
  const values = {
    bakery_id: bakeryId,
    name: item.name,
    description: item.description || "",
    baked_on: item.baked_on,
    quantity: Math.max(0, Math.min(24, Number(item.quantity || 0))),
    price_cents: Math.max(0, Number(item.price_cents || 0)),
    active: Boolean(item.active) && Number(item.quantity || 0) > 0,
    updated_at: new Date().toISOString(),
  };
  const query = item.id
    ? requireClient().from("ready_shelf_items").update(values).eq("id", item.id)
    : requireClient().from("ready_shelf_items").insert(values);
  const { data, error } = await query
    .select("id, name, description, baked_on, quantity, price_cents, active")
    .single();
  throwIfError(error);
  return data;
}

export async function deleteReadyShelfItem(itemId) {
  const { error } = await requireClient()
    .from("ready_shelf_items")
    .delete()
    .eq("id", itemId);
  throwIfError(error);
}

export async function syncBakerCapacityReservations(bakeryId, orders) {
  const reservations = orders.flatMap((order) => {
    if (order.cloudOrderId || order.isSample || !order.pickupAt) return [];
    const date = new Date(order.pickupAt);
    if (Number.isNaN(date.getTime())) return [];
    const pickupDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    return [{
      source_key: String(order.id),
      pickup_date: pickupDate,
      loaf_count: Math.max(1, Math.min(6, Number(order.quantity || 1))),
    }];
  });
  const { error } = await requireClient().rpc("sync_bakery_capacity_reservations", {
    p_bakery_id: bakeryId,
    p_reservations: reservations,
  });
  throwIfError(error);
}

export function publicOrderUrl(slug) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("order", slug || "loafers");
  return url.toString();
}
