import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureSettings {
  feature_post_images: boolean;
  feature_chat_images: boolean;
  feature_comment_images: boolean;
  feature_stories: boolean;
}

const defaults: FeatureSettings = {
  feature_post_images: true,
  feature_chat_images: true,
  feature_comment_images: true,
  feature_stories: true,
};

export function useFeatureSettings() {
  const [settings, setSettings] = useState<FeatureSettings>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .like("key", "feature_%");
      if (data) {
        const s = { ...defaults };
        data.forEach((row: any) => {
          if (row.key in s) {
            (s as any)[row.key] = row.value === "true";
          }
        });
        setSettings(s);
      }
      setLoading(false);
    };
    load();
  }, []);

  const toggle = async (key: keyof FeatureSettings) => {
    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));
    await supabase
      .from("site_settings")
      .update({ value: newVal ? "true" : "false", updated_at: new Date().toISOString() } as any)
      .eq("key", key);
  };

  return { settings, loading, toggle };
}
