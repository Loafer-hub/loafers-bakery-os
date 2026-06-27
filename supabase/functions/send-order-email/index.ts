import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const phaseLabels: Record<string, string> = {
  starterFed: "Starter fed",
  doughMixed: "Dough mixed",
  bulkFerment: "Bulk fermentation",
  shaped: "Loaves shaped",
  coldProof: "Cold proof",
  oven: "In the oven",
  cooling: "Cooling",
  ready: "Ready for pickup",
};

const phaseOrder = Object.keys(phaseLabels);

const eventHeadings: Record<string, string> = {
  accepted: "Your order is accepted",
  bakeProgress: "Your bake is moving along",
  comments: "A note from your baker",
  ready: "Your order is ready for pickup",
  rejected: "An update about your order request",
  completed: "Your Loafers order is complete",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function environmentJson(name: string) {
  const value = Deno.env.get(name);
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pickupLabel(value: string | null) {
  if (!value) return "Pickup time is still being arranged";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Anchorage",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function latestPhase(progress: Record<string, boolean> | null) {
  return [...phaseOrder].reverse().find((phase) => Boolean(progress?.[phase])) || "";
}

function noteHash(value: string) {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}

function eventKey(eventType: string, order: Record<string, any>) {
  if (eventType === "bakeProgress") {
    const phase = latestPhase(order.bake_progress || {});
    return phase ? `bakeProgress:${phase}` : "bakeProgress:none";
  }
  if (eventType === "comments") return `comments:${noteHash(order.baker_notes || "")}`;
  return eventType;
}

function itemSummary(items: Array<Record<string, any>>) {
  return items.map((item) => (
    `${item.quantity} × ${item.sale_option_label || ""} ${item.product_name}`.replace(/\s+/g, " ").trim()
  )).join(" · ");
}

function createEmail(order: Record<string, any>, bakery: Record<string, any>, eventType: string) {
  const firstName = String(order.customer_name || "there").trim().split(/\s+/)[0];
  const items = itemSummary(order.customer_order_items || []);
  const phase = latestPhase(order.bake_progress || {});
  const heading = eventHeadings[eventType] || "Your Loafers order has an update";
  const comment = String(order.baker_notes || "").trim();
  const pickup = pickupLabel(order.pickup_at);
  const location = order.pickup_location || bakery.pickup_location || "Three Bears, Delta Junction, AK";
  const progressLine = eventType === "bakeProgress" && phase
    ? `Current step: ${phaseLabels[phase] || phase}.`
    : "";
  const text = [
    `Hi ${firstName},`,
    heading + ".",
    progressLine,
    items ? `Order: ${items}.` : "",
    `Pickup: ${pickup} at ${location}.`,
    comment ? `Baker note: ${comment}` : "",
    `Request code: ${order.request_code}.`,
    "",
    "Thank you,",
    bakery.name || "Loafers",
  ].filter(Boolean).join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#211a16;line-height:1.55">
      <div style="padding:22px 26px;background:#f5f0e8;border-radius:18px 18px 0 0">
        <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#667f58">${escapeHtml(bakery.name || "Loafers")}</div>
        <h1 style="font-family:Georgia,serif;font-size:30px;margin:8px 0 0">${escapeHtml(heading)}</h1>
      </div>
      <div style="padding:26px;border:1px solid #ddd3c7;border-top:0;border-radius:0 0 18px 18px">
        <p>Hi ${escapeHtml(firstName)},</p>
        ${progressLine ? `<p><strong>${escapeHtml(progressLine)}</strong></p>` : ""}
        ${items ? `<p><strong>Order</strong><br>${escapeHtml(items)}</p>` : ""}
        <p><strong>Pickup</strong><br>${escapeHtml(pickup)}<br>${escapeHtml(location)}</p>
        ${comment ? `<div style="padding:14px 16px;background:#e9efe6;border-radius:12px"><strong>Baker note</strong><br>${escapeHtml(comment)}</div>` : ""}
        <p style="color:#746b63;font-size:13px">Request code: ${escapeHtml(order.request_code)}</p>
        <p>Thank you,<br><strong>${escapeHtml(bakery.name || "Loafers")}</strong></p>
      </div>
    </div>`;
  return {
    subject: `${bakery.name || "Loafers"} · ${heading}${order.request_code ? ` · ${order.request_code}` : ""}`,
    text,
    html,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "Sign in to manage bakery email." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const secretKeys = environmentJson("SUPABASE_SECRET_KEYS") as Record<string, string>;
  const serviceRoleKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase service configuration is missing." }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return jsonResponse({ error: "Your bakery session has expired." }, 401);

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  const action = String(body.action || "send");
  const bakeryId = String(body.bakeryId || "");
  if (!bakeryId) return jsonResponse({ error: "Bakery is required." }, 400);

  const { data: membership } = await admin
    .from("bakery_members")
    .select("role")
    .eq("bakery_id", bakeryId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!membership) return jsonResponse({ error: "You do not have access to this bakery." }, 403);

  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "";
  const providerConfigured = Boolean(resendApiKey && fromEmail);

  if (action === "status") {
    return jsonResponse({
      configured: providerConfigured,
      hasApiKey: Boolean(resendApiKey),
      hasFromEmail: Boolean(fromEmail),
    });
  }

  const { data: bakery, error: bakeryError } = await admin
    .from("bakeries")
    .select("id, name, pickup_location")
    .eq("id", bakeryId)
    .single();
  if (bakeryError) return jsonResponse({ error: bakeryError.message }, 400);

  if (action === "test") {
    const recipient = String(body.recipient || "").trim().toLowerCase();
    if (!recipient || !recipient.includes("@")) return jsonResponse({ error: "Enter a valid test email." }, 400);
    if (!providerConfigured) return jsonResponse({ error: "Connect Resend and set the sender address first.", configured: false }, 424);
    const subject = `${bakery.name || "Loafers"} automatic email test`;
    const html = `<div style="font-family:Arial,sans-serif;color:#211a16"><h1>Automatic email is ready</h1><p>${escapeHtml(bakery.name || "Loafers")} can now send customer order updates automatically.</p></div>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        html,
        text: `${bakery.name || "Loafers"} automatic email is ready.`,
      }),
    });
    const provider = await response.json();
    await admin.from("email_notification_deliveries").insert({
      bakery_id: bakeryId,
      event_type: "test",
      event_key: `test:${crypto.randomUUID()}`,
      recipient,
      subject,
      status: response.ok ? "sent" : "failed",
      provider_message_id: response.ok ? String(provider.id || "") : "",
      error_message: response.ok ? "" : String(provider.message || provider.error || "Email provider rejected the message."),
      sent_at: response.ok ? new Date().toISOString() : null,
    });
    return response.ok
      ? jsonResponse({ sent: true, providerMessageId: provider.id || "" })
      : jsonResponse({ error: provider.message || provider.error || "Email provider rejected the message." }, 502);
  }

  const orderId = String(body.orderId || "");
  const eventType = String(body.eventType || "");
  if (!orderId || !eventHeadings[eventType]) return jsonResponse({ error: "Order and email event are required." }, 400);

  const [{ data: order, error: orderError }, { data: settingsRow }] = await Promise.all([
    admin
      .from("customer_orders")
      .select(`
        id, bakery_id, request_code, status, pickup_at, customer_name, customer_email,
        notify_email, pickup_location, baker_notes, bake_progress, updated_at,
        customer_order_items(product_name, quantity, sale_option_label)
      `)
      .eq("id", orderId)
      .eq("bakery_id", bakeryId)
      .single(),
    admin.from("bakery_settings").select("settings").eq("bakery_id", bakeryId).maybeSingle(),
  ]);
  if (orderError || !order) return jsonResponse({ error: orderError?.message || "Order not found." }, 404);

  const settings = settingsRow?.settings || {};
  const eventEnabled = settings.notificationEvents?.[eventType] !== false;
  const eligible = settings.emailNotifications !== false
    && settings.automaticEmailNotifications !== false
    && eventEnabled
    && order.notify_email
    && Boolean(order.customer_email);
  const key = eventKey(eventType, order);
  const email = createEmail(order, bakery, eventType);

  if (!eligible || !providerConfigured) {
    const reason = !eligible ? "Automatic email is disabled or the customer did not opt in." : "Resend is not connected.";
    const { error: skipError } = await admin.from("email_notification_deliveries").insert({
      bakery_id: bakeryId,
      order_id: order.id,
      event_type: eventType,
      event_key: key,
      recipient: order.customer_email || "",
      subject: email.subject,
      status: "skipped",
      error_message: reason,
    });
    if (skipError?.code === "23505") return jsonResponse({ sent: false, duplicate: true });
    return jsonResponse({ sent: false, skipped: true, reason, configured: providerConfigured });
  }

  const { data: delivery, error: insertError } = await admin
    .from("email_notification_deliveries")
    .insert({
      bakery_id: bakeryId,
      order_id: order.id,
      event_type: eventType,
      event_key: key,
      recipient: order.customer_email,
      subject: email.subject,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError?.code === "23505") return jsonResponse({ sent: false, duplicate: true });
  if (insertError || !delivery) return jsonResponse({ error: insertError?.message || "Could not reserve this email delivery." }, 500);

  const replyTo = String(settings.emailReplyTo || "").trim();
  const providerResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [order.customer_email],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const provider = await providerResponse.json();
  const sent = providerResponse.ok;
  await admin
    .from("email_notification_deliveries")
    .update({
      status: sent ? "sent" : "failed",
      provider_message_id: sent ? String(provider.id || "") : "",
      error_message: sent ? "" : String(provider.message || provider.error || "Email provider rejected the message."),
      sent_at: sent ? new Date().toISOString() : null,
    })
    .eq("id", delivery.id);

  return sent
    ? jsonResponse({ sent: true, providerMessageId: provider.id || "" })
    : jsonResponse({ error: provider.message || provider.error || "Email provider rejected the message." }, 502);
});
