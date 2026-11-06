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

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id, full_name, active_club_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.active_club_id) {
      return response(req, { error: "No active club" }, 403);
    }

    const { data: membership, error: membershipError } = await db
      .from("club_memberships")
      .select("role")
      .eq("club_id", profile.active_club_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      return response(req, { error: "Forbidden" }, 403);
    }

    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 16_384) return response(req, { error: "Request too large" }, 413);
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return response(req, { error: "Request too large" }, 413);
    }

    let body: Record<string, unknown>;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
    } catch {
      return response(req, { error: "Invalid JSON body" }, 400);
    }

    const action = typeof body.action === "string" ? body.action : "list";

    if (action === "list") {
      const { data: members, error } = await db
        .from("club_memberships")
        .select("user_id, role, created_at")
        .eq("club_id", profile.active_club_id)
        .eq("active", true);
      if (error) throw error;

      const ids = (members || []).map((member) => member.user_id);
      const userById = new Map<string, { email?: string; last_sign_in_at?: string }>();
      for (let page = 1; page <= 20; page++) {
        const { data, error: listError } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (listError) throw listError;
        for (const account of data.users || []) {
          if (ids.includes(account.id)) {
            userById.set(account.id, {
              email: account.email,
              last_sign_in_at: account.last_sign_in_at,
            });
          }
        }
        if (!data.users || data.users.length < 1000 || ids.every((id) => userById.has(id))) break;
      }

      const { data: profiles, error: namesError } = ids.length
        ? await db.from("profiles").select("id, full_name").in("id", ids)
        : { data: [], error: null };
      if (namesError) throw namesError;
      const names = new Map((profiles || []).map((item) => [item.id, item.full_name]));

      return response(req, {
        users: (members || []).map((member) => ({
          id: member.user_id,
          email: userById.get(member.user_id)?.email || "",
          created_at: member.created_at,
          last_sign_in_at: userById.get(member.user_id)?.last_sign_in_at || null,
          full_name: names.get(member.user_id) || "",
          role: member.role,
        })),
      });
    }

    if (membership.role !== "owner") {
      return response(req, { error: "Only the owner can change users or roles" }, 403);
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.full_name || "").trim();
      const role = body.role === undefined ? "staff" : body.role;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return response(req, { error: "A valid email is required" }, 400);
      }
      if (password.length < 8 || password.length > 128) {
        return response(req, { error: "Password must contain between 8 and 128 characters" }, 400);
      }
      if (fullName.length > 120) return response(req, { error: "Name is too long" }, 400);
      if (!["owner", "admin", "staff"].includes(String(role))) {
        return response(req, { error: "Invalid role" }, 400);
      }

      const { data: created, error: createError } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) throw createError || new Error("User creation failed");

      const { error: profileWriteError } = await db.from("profiles").upsert({
        id: created.user.id,
        full_name: fullName,
        role,
        active_club_id: profile.active_club_id,
      });
      if (profileWriteError) {
        await db.auth.admin.deleteUser(created.user.id);
        throw profileWriteError;
      }

      const { error: membershipWriteError } = await db.from("club_memberships").upsert({
        club_id: profile.active_club_id,
        user_id: created.user.id,
        role,
        active: true,
      }, { onConflict: "club_id,user_id" });
      if (membershipWriteError) {
        await db.auth.admin.deleteUser(created.user.id);
        throw membershipWriteError;
      }

      return response(req, { ok: true, id: created.user.id });
    }

    if (action === "role") {
      const id = String(body.id || "");
      const role = body.role;
      if (!id || !["owner", "admin", "staff"].includes(String(role))) {
        return response(req, { error: "User ID and a valid role are required" }, 400);
      }
      if (id === user.id && role !== "owner") {
        return response(req, { error: "You cannot remove your own owner role" }, 400);
      }

      const { data: updated, error } = await db
        .from("club_memberships")
        .update({ role })
        .eq("club_id", profile.active_club_id)
        .eq("user_id", id)
        .eq("active", true)
        .select("user_id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return response(req, { error: "Active club member not found" }, 404);
      return response(req, { ok: true });
    }

    if (action === "disable") {
      const id = String(body.id || "");
      if (!id) return response(req, { error: "User ID is required" }, 400);
      if (id === user.id) return response(req, { error: "You cannot disable your own membership" }, 400);

      const { data: updated, error } = await db
        .from("club_memberships")
        .update({ active: false })
        .eq("club_id", profile.active_club_id)
        .eq("user_id", id)
        .eq("active", true)
        .select("user_id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return response(req, { error: "Active club member not found" }, 404);
      return response(req, { ok: true });
    }

    return response(req, { error: "Unsupported action" }, 400);
  } catch {
    return response(req, { error: "Internal server error" }, 500);
  }
});
