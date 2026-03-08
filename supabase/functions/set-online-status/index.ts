import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    let userId: string | null = null;

    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    const body = await req.json();
    // Allow passing user_id in body for sendBeacon (no auth header)
    if (!userId && body.user_id) {
      userId = body.user_id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "No user" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    await adminClient.from("profiles").update({
      is_online: !!body.online,
      last_seen: new Date().toISOString(),
    }).eq("user_id", userId);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
