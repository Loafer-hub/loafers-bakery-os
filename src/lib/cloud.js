import { createClient } from "@supabase/supabase-js";

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
    .select("bakery_id, role, bakeries(id, name, slug, public_ordering, ordering_intro)")
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
  const products = recipes.map((recipe, index) => ({
    bakery_id: bakeryId,
    recipe_id: String(recipe.id),
    name: recipe.name,
    description: recipe.note || "",
    price_cents: Math.max(0, Math.round(Number(recipe.price || 0) * 100)),
    active: true,
    sort_order: index,
  }));

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
  const { data: bakery, error: bakeryError } = await requireClient()
    .from("bakeries")
    .select("id, name, slug, ordering_intro, pickup_location, payment_methods")
    .eq("slug", slug)
    .eq("public_ordering", true)
    .maybeSingle();
  throwIfError(bakeryError);
  if (!bakery) return null;

  const { data: products, error: productError } = await requireClient()
    .from("products")
    .select("id, recipe_id, name, description, price_cents, sort_order")
    .eq("bakery_id", bakery.id)
    .eq("active", true)
    .order("sort_order");
  throwIfError(productError);
  return { bakery, products: products || [] };
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
}) {
  const { data, error } = await requireClient().rpc("submit_public_order", {
    p_slug: slug,
    p_customer: customer,
    p_items: items,
    p_pickup_at: pickupAt || null,
    p_payment_method: paymentMethod || "Cash",
    p_allergies: allergies || "",
    p_notes: notes || "",
  });
  throwIfError(error);
  return data;
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
      payment_method,
      pickup_location,
      allergies,
      customer_notes,
      baker_notes,
      bake_progress,
      created_at,
      customer_order_items(id, product_name, unit_price_cents, quantity)
    `)
    .eq("bakery_id", bakeryId)
    .eq("status", status)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function acceptCustomerOrderRequest(orderId, bakerNotes = "") {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      status: "accepted",
      baker_notes: bakerNotes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
}

export async function commentCustomerOrderRequest(orderId, bakerNotes) {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      baker_notes: bakerNotes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
}

export async function rejectCustomerOrderRequest(orderId, bakerNotes) {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      status: "declined",
      baker_notes: bakerNotes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
}

export async function completeCustomerOrder(orderId) {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  throwIfError(error);
}

export async function updateCustomerOrderBakeProgress(orderId, bakeProgress) {
  const { error } = await requireClient()
    .from("customer_orders")
    .update({
      bake_progress: bakeProgress,
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
