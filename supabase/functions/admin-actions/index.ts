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
    const authHeader = req.headers.get("Authorization")!;

    // Client with user's token to verify admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    // Check admin role
    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single();
    if (!roleData) return new Response(JSON.stringify({ error: "Not admin" }), { status: 403, headers: corsHeaders });

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action, targetUserId } = await req.json();

    if (action === "delete_user") {
      // Delete user from auth (cascades to profiles etc.)
      const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

      // Log activity
      await adminClient.from("admin_activity_log").insert({
        admin_id: user.id,
        action: "delete_account",
        target_user_id: targetUserId,
        details: {},
      });

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === "set_online") {
      // Called by users to set their own online status
      const { online } = await req.json();
      // This doesn't need admin - but we use service role for beacon
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
