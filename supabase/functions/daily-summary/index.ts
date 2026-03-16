import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dayData, goals, namazTimes, extraSettings } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context from user's day data
    const namazDone = Object.entries(dayData.namaz || {}).filter(([_, v]) => v).map(([k]) => k);
    const namazMissed = ["fajr", "dhuhr", "asr", "maghrib", "isha"].filter(k => !dayData.namaz?.[k]);
    const tasksDone = (dayData.tasks || []).filter((t: any) => t.done).length;
    const tasksTotal = (dayData.tasks || []).length;
    const habitsDone = (dayData.habits || []).filter((h: any) => h.checked).length;
    const habitsTotal = (dayData.habits || []).length;
    const totalExpense = (dayData.expenses || []).reduce((s: number, e: any) => s + (e.amt || 0), 0);
    const mood = dayData.mood || "না জানানো";
    const water = dayData.water || 0;
    const sleepHours = dayData.sleepHours || 0;

    const context = `
আজকের ডেটা:
- মুড: ${mood}
- পানি: ${water} গ্লাস (লক্ষ্য ৮)
- ঘুম: ${sleepHours} ঘণ্টা
- নামাজ পড়া হয়েছে: ${namazDone.length}/5 (${namazDone.join(", ") || "কোনটাই না"})
- নামাজ বাকি: ${namazMissed.join(", ") || "সব পড়া হয়েছে"}
- কাজ সম্পন্ন: ${tasksDone}/${tasksTotal}
- রুটিন পালন: ${habitsDone}/${habitsTotal}
- আজকের খরচ: ৳${totalExpense} (দৈনিক বাজেট: ৳${extraSettings?.dailyLimit || 500})
- লক্ষ্য সংখ্যা: ${(goals || []).length}
${(goals || []).map((g: any) => `  • ${g.title}`).join("\n")}
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `আপনি একজন বাংলা ভাষায় কথা বলা Life OS AI অ্যাসিস্ট্যান্ট। ইউজারের দিনের ডেটা দেখে একটি সুন্দর, অনুপ্রেরণামূলক দৈনিক সারাংশ দিন।

নিয়ম:
- সম্পূর্ণ বাংলায় লিখুন
- ইমোজি ব্যবহার করুন
- ৪-৬ লাইনে সংক্ষেপে বলুন
- ভালো কাজের প্রশংসা করুন
- যেখানে উন্নতি দরকার সেটা নরমভাবে বলুন
- শেষে একটি অনুপ্রেরণামূলক কথা দিন
- মার্কডাউন ব্যবহার করবেন না, প্লেইন টেক্সট দিন`
          },
          {
            role: "user",
            content: `আমার আজকের দিনের সারাংশ দিন:\n${context}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "অনেক বেশি রিকোয়েস্ট হচ্ছে, একটু পরে চেষ্টা করুন।" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI ক্রেডিট শেষ।" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI সার্ভিসে সমস্যা হয়েছে।" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content || "সারাংশ তৈরি করা যায়নি।";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
