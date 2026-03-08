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

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });
    }

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { word, contentType, contentId } = await req.json();
    const userId = user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Record violation
    await adminClient.from("spam_violations").insert({
      user_id: userId,
      word_matched: word,
      content_type: contentType,
      content_id: contentId || null,
    });

    // Get or create ban record
    const { data: banData } = await adminClient.from("spam_bans").select("*").eq("user_id", userId).single();

    const currentCount = banData?.violation_count || 0;
    const newCount = currentCount + 1;

    // Escalation logic
    let banDays = 0;
    let permanent = false;
    let banned = false;

    if (newCount >= 3 && newCount < 6) {
      banDays = 3;
      banned = true;
    } else if (newCount >= 6 && newCount < 9) {
      banDays = 7;
      banned = true;
    } else if (newCount >= 9) {
      permanent = true;
      banned = true;
    }

    const banUntil = banned && !permanent ? new Date(Date.now() + banDays * 86400000).toISOString() : null;

    if (banData) {
      await adminClient.from("spam_bans").update({
        violation_count: newCount,
        ban_until: banUntil,
        is_permanent: permanent,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    } else {
      await adminClient.from("spam_bans").insert({
        user_id: userId,
        violation_count: newCount,
        ban_until: banUntil,
        is_permanent: permanent,
      });
    }

    // Warning notification to user
    const warningMsg = banned
      ? permanent
        ? `আপনি বারবার স্প্যাম ওয়ার্ড ব্যবহার করেছেন। আপনার পোস্ট ও কমেন্ট করার অধিকার স্থায়ীভাবে বন্ধ করা হয়েছে।`
        : `আপনি স্প্যাম ওয়ার্ড ব্যবহার করেছেন। ${banDays} দিনের জন্য আপনি পোস্ট বা কমেন্ট করতে পারবেন না।`
      : `⚠️ সতর্কতা: "${word}" স্প্যাম ওয়ার্ড হিসেবে চিহ্নিত। বারবার ব্যবহার করলে ব্যান হবেন। (${newCount}/3)`;

    await adminClient.from("admin_notifications").insert({
      user_id: userId,
      title: banned ? "🚫 স্প্যাম ব্যান" : "⚠️ স্প্যাম সতর্কতা",
      message: warningMsg,
      type: banned ? "warning" : "info",
    });

    // Notify admins
    const { data: adminRoles } = await adminClient.from("user_roles").select("user_id").eq("role", "admin");
    if (adminRoles) {
      for (const admin of adminRoles) {
        await adminClient.from("admin_notifications").insert({
          user_id: admin.user_id,
          title: `🚨 স্প্যাম ডিটেক্টেড`,
          message: `একজন ইউজার "${word}" স্প্যাম ওয়ার্ড ব্যবহার করেছে (মোট: ${newCount} বার)${banned ? ` — ${permanent ? "স্থায়ী ব্যান" : `${banDays} দিনের ব্যান`}` : ""}`,
          type: "warning",
        });
      }
    }

    return new Response(JSON.stringify({ banned, banDays, permanent, warningOnly: !banned }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
