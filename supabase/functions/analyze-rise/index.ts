import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientKey(request: Request) {
  return Deno.env.get("SUPABASE_ANON_KEY")
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    || request.headers.get("apikey")
    || "";
}

function outputText(payload: Record<string, any>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  return "";
}

const riseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slotId: { type: "string" },
          risePercent: { type: "number" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          observation: { type: "string" },
        },
        required: ["slotId", "risePercent", "confidence", "observation"],
      },
    },
    cautions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "assessments", "cautions"],
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "Sign into the owner app before using Rise Review." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = clientKey(request);
  if (!supabaseUrl || !publishableKey) return jsonResponse({ error: "Supabase client configuration is missing." }, 500);

  const db = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) return jsonResponse({ error: "Your owner session has expired." }, 401);

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid Rise Review request." }, 400);
  }

  const bakeryId = String(body.bakeryId || "");
  if (!bakeryId) return jsonResponse({ error: "Bakery is required." }, 400);
  const { data: membership, error: membershipError } = await db
    .from("bakery_members")
    .select("role")
    .eq("bakery_id", bakeryId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (membershipError) return jsonResponse({ error: membershipError.message }, 400);
  if (!membership) return jsonResponse({ error: "You do not have access to this bakery." }, 403);

  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 6) : [];
  if (photos.length < 2 || photos[0]?.slotId !== "initial") {
    return jsonResponse({ error: "An Initial photo and at least one later photo are required." }, 400);
  }
  const allowedSlots = new Set(["initial", "fold-1", "fold-2", "fold-3", "fold-4", "final"]);
  let totalCharacters = 0;
  for (const photo of photos) {
    const image = String(photo.image || "");
    totalCharacters += image.length;
    if (!allowedSlots.has(String(photo.slotId || "")) || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
      return jsonResponse({ error: "One of the Rise Review photos is invalid." }, 400);
    }
  }
  if (totalCharacters > 8_000_000) return jsonResponse({ error: "Those photos are too large. Try fewer or smaller images." }, 413);

  const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!apiKey) {
    return jsonResponse({ error: "Rise Review is ready, but the OPENAI_API_KEY Supabase secret has not been added yet." }, 424);
  }

  const labels = photos.map((photo: Record<string, any>) => `${photo.slotId}: ${photo.label || photo.slotId}`).join("\n");
  const instructions = `You are reviewing a sequence of dough fermentation photos for a home baker.
Estimate percentage rise relative to the photo labeled initial, where initial is 0% and a doubling in apparent dough height or volume is 100% rise.
Compare the visible dough boundary, container geometry, surface doming, bubbles, and camera consistency. Do not confuse a fold-induced shape change with fermentation growth.
Return one assessment for every supplied photo, including initial at exactly 0%. Keep observations short and practical.
Lower confidence when the container, angle, distance, lighting, crop, or dough handling changes. Never claim an exact laboratory measurement or food-safety conclusion.
Session name: ${String(body.sessionName || "Unnamed dough").slice(0, 120)}
Photo labels in order:\n${labels}`;
  const content: Array<Record<string, any>> = [{ type: "input_text", text: instructions }];
  for (const photo of photos) {
    content.push({ type: "input_text", text: `PHOTO ${photo.slotId}: ${photo.label || photo.slotId}` });
    content.push({ type: "input_image", image_url: photo.image, detail: "high" });
  }

  const providerResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_VISION_MODEL") || "gpt-5-mini",
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "rise_review",
          strict: true,
          schema: riseSchema,
        },
      },
      max_output_tokens: 1600,
    }),
  });

  const providerPayload = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) {
    const providerMessage = providerPayload?.error?.message || "The AI image service rejected this review.";
    return jsonResponse({ error: providerMessage }, 502);
  }

  try {
    const parsed = JSON.parse(outputText(providerPayload));
    const supplied = new Set(photos.map((photo: Record<string, any>) => photo.slotId));
    parsed.assessments = (parsed.assessments || [])
      .filter((item: Record<string, any>) => supplied.has(item.slotId))
      .map((item: Record<string, any>) => ({
        ...item,
        risePercent: item.slotId === "initial" ? 0 : Math.max(-25, Math.min(400, Number(item.risePercent) || 0)),
      }));
    return jsonResponse(parsed);
  } catch {
    return jsonResponse({ error: "The AI completed the review but returned an unreadable result. Please try again." }, 502);
  }
});
