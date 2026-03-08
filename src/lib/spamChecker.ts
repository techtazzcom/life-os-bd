import { supabase } from "@/integrations/supabase/client";

let cachedSpamWords: string[] = [];
let lastFetch = 0;

export async function loadSpamWords(): Promise<string[]> {
  if (Date.now() - lastFetch < 60000 && cachedSpamWords.length > 0) return cachedSpamWords;
  const { data } = await supabase.from("spam_words" as any).select("word");
  cachedSpamWords = (data as any[])?.map(d => d.word.toLowerCase()) || [];
  lastFetch = Date.now();
  return cachedSpamWords;
}

export function checkSpam(content: string, spamWords: string[]): string | null {
  const lower = content.toLowerCase();
  for (const word of spamWords) {
    if (lower.includes(word.toLowerCase())) return word;
  }
  return null;
}

export async function recordViolation(userId: string, word: string, contentType: string, contentId?: string): Promise<{ banned: boolean; banDays: number; permanent: boolean; warningOnly: boolean }> {
  // Record violation
  await supabase.from("spam_violations" as any).insert({
    user_id: userId,
    word_matched: word,
    content_type: contentType,
    content_id: contentId || null,
  });

  // Get or create ban record
  const { data: banData } = await supabase.from("spam_bans" as any).select("*").eq("user_id", userId).single();
  
  const currentCount = (banData as any)?.violation_count || 0;
  const newCount = currentCount + 1;

  // Escalation logic: 3 strikes -> 3 days, next -> 7 days, next -> permanent
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
    await supabase.from("spam_bans" as any).update({
      violation_count: newCount,
      ban_until: banUntil,
      is_permanent: permanent,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  } else {
    await supabase.from("spam_bans" as any).insert({
      user_id: userId,
      violation_count: newCount,
      ban_until: banUntil,
      is_permanent: permanent,
    });
  }

  // Send warning notification to user
  const warningMsg = banned
    ? permanent
      ? `আপনি বারবার স্প্যাম ওয়ার্ড ব্যবহার করেছেন। আপনার পোস্ট ও কমেন্ট করার অধিকার স্থায়ীভাবে বন্ধ করা হয়েছে। আনলক করতে আবেদন করুন।`
      : `আপনি স্প্যাম ওয়ার্ড ব্যবহার করেছেন। ${banDays} দিনের জন্য আপনি পোস্ট বা কমেন্ট করতে পারবেন না।`
    : `⚠️ সতর্কতা: "${word}" স্প্যাম ওয়ার্ড হিসেবে চিহ্নিত। বারবার ব্যবহার করলে আপনার পোস্ট/কমেন্ট করার অধিকার বন্ধ হয়ে যাবে। (${newCount}/3)`;

  await supabase.from("admin_notifications" as any).insert({
    user_id: userId,
    title: banned ? "🚫 স্প্যাম ব্যান" : "⚠️ স্প্যাম সতর্কতা",
    message: warningMsg,
    type: banned ? "warning" : "info",
  });

  // Notify admins
  const { data: adminRoles } = await supabase.from("user_roles" as any).select("user_id").eq("role", "admin");
  if (adminRoles) {
    for (const admin of adminRoles as any[]) {
      await supabase.from("admin_notifications" as any).insert({
        user_id: admin.user_id,
        title: `🚨 স্প্যাম ডিটেক্টেড`,
        message: `একজন ইউজার "${word}" স্প্যাম ওয়ার্ড ব্যবহার করেছে (মোট: ${newCount} বার)${banned ? ` — ${permanent ? "স্থায়ী ব্যান" : `${banDays} দিনের ব্যান`}` : ""}`,
        type: "warning",
      });
    }
  }

  return { banned, banDays, permanent, warningOnly: !banned };
}

export async function isSpamBanned(userId: string): Promise<{ banned: boolean; permanent: boolean; banUntil: string | null }> {
  const { data } = await supabase.from("spam_bans" as any).select("*").eq("user_id", userId).single();
  if (!data) return { banned: false, permanent: false, banUntil: null };
  const ban = data as any;
  if (ban.is_permanent) return { banned: true, permanent: true, banUntil: null };
  if (ban.ban_until && new Date(ban.ban_until) > new Date()) {
    return { banned: true, permanent: false, banUntil: ban.ban_until };
  }
  return { banned: false, permanent: false, banUntil: null };
}
