import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DayData, Goal, NamazTimes, ExtraSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface Props {
  data: DayData;
  goals: Goal[];
  namazTimes: NamazTimes;
  extraSettings: ExtraSettings;
}

const DailySummary = ({ data, goals, namazTimes, extraSettings }: Props) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateSummary = useCallback(async () => {
    setLoading(true);
    setSummary(null);
    try {
      const { data: result, error } = await supabase.functions.invoke("daily-summary", {
        body: { dayData: data, goals, namazTimes, extraSettings },
      });

      if (error) throw error;
      if (result?.error) {
        toast({ title: "সমস্যা", description: result.error, variant: "destructive" });
        return;
      }
      setSummary(result.summary);
    } catch (err: any) {
      console.error("Summary error:", err);
      toast({ title: "সমস্যা হয়েছে", description: "সারাংশ তৈরি করতে পারিনি।", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [data, goals, namazTimes, extraSettings, toast]);

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-primary shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-primary">🧠 AI দৈনিক সারাংশ</h3>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              তৈরি হচ্ছে...
            </span>
          ) : summary ? "আবার তৈরি করুন" : "সারাংশ দেখুন"}
        </button>
      </div>

      {loading && !summary && (
        <div className="flex items-center justify-center py-8 gap-3">
          <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground font-bold text-sm animate-pulse">AI আপনার দিন বিশ্লেষণ করছে...</p>
        </div>
      )}

      {summary && (
        <div className="bg-secondary/50 rounded-xl p-4 border border-border">
          <p className="text-sm md:text-base font-medium text-foreground leading-relaxed whitespace-pre-line">
            {summary}
          </p>
        </div>
      )}

      {!summary && !loading && (
        <div className="text-center py-6">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-muted-foreground text-sm font-bold">
            বাটনে ক্লিক করে আজকের দিনের AI সারাংশ দেখুন
          </p>
        </div>
      )}
    </div>
  );
};

export default DailySummary;
