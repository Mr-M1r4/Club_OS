import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://mr-m1r4.github.io",
  "http://localhost:3000",
]);

function response(req: Request, body: unknown, status = 200): Response {
  const origin = req.headers.get("origin") || "";
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin",
  });
  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "authorization, x-client-info, apikey, content-type");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(req, { ok: true });
  if (req.method !== "POST") return response(req, { error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) return response(req, { error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return response(req, { error: "Service unavailable" }, 503);

    const db = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await db.auth.getUser(tokenMatch[1]);
    if (userError || !user) return response(req, { error: "Unauthorized" }, 401);

    const { data: platformAdmin, error: adminError } = await db
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError || !platformAdmin) return response(req, { error: "Forbidden" }, 403);

    const dates = [0, 1, 3, 7].map((offset) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return date.toISOString().slice(0, 10);
    });

    const { data: memberships, error } = await db
      .from("memberships")
      .select("id, athlete_id, club_id, end_date")
      .eq("status", "active")
      .in("end_date", dates);
    if (error) throw error;

    let created = 0;
    for (const membership of memberships || []) {
      const { data: athlete, error: athleteError } = await db
        .from("athletes")
        .select("full_name, email, phone")
        .eq("id", membership.athlete_id)
        .eq("club_id", membership.club_id)
        .maybeSingle();
      if (athleteError) throw athleteError;
      if (!athlete) continue;

      for (const channel of ["email", "whatsapp", "sms"]) {
        const { data: existing, error: existingError } = await db
          .from("notifications")
          .select("id")
          .eq("athlete_id", membership.athlete_id)
          .eq("club_id", membership.club_id)
          .eq("channel", channel)
          .eq("template", "membership_expiring")
          .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
          .limit(1);
        if (existingError) throw existingError;

        if (!existing?.length) {
          const { error: insertError } = await db.from("notifications").insert({
            athlete_id: membership.athlete_id,
            club_id: membership.club_id,
            channel,
            template: "membership_expiring",
            scheduled_for: new Date().toISOString(),
            status: "pending",
            payload: {
              membership_id: membership.id,
              end_date: membership.end_date,
              full_name: athlete.full_name,
              email: athlete.email,
              phone: athlete.phone,
            },
          });
          if (insertError) throw insertError;
          created++;
        }
      }
    }

    return response(req, { ok: true, checked: (memberships || []).length, created });
  } catch {
    return response(req, { error: "Internal server error" }, 500);
  }
});
