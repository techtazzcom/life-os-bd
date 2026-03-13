import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImagePlus, Send } from "lucide-react";

interface PostComposerProps {
  currentUserId: string;
  onPostSubmitted: () => void;
}

export default function PostComposer({ currentUserId, onPostSubmitted }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [category] = useState("general");

  const handleSubmit = async () => {
    if (!content.trim() || !currentUserId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: currentUserId,
          content: content.trim(),
          category,
          created_at: new Date().toISOString(),
        } as any);

      if (error) {
        console.error("Post error:", error);
        toast.error("পোস্ট করতে সমস্যা হয়েছে");
      } else {
        setContent("");
        toast.success("পোস্ট সফল হয়েছে!");
        onPostSubmitted();
      }
    } catch (err) {
      console.error(err);
      toast.error("কিছু ভুল হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="আপনার মনে কী চলছে?"
        className="min-h-[80px] resize-none border-none focus-visible:ring-0"
        maxLength={5000}
      />
      <div className="flex justify-between items-center mt-2">
        <button className="text-gray-400 hover:text-blue-500 transition">
          <ImagePlus size={20} />
        </button>
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || loading}
          size="sm"
        >
          {loading ? "পোস্ট হচ্ছে..." : <><Send size={16} className="mr-1" /> পোস্ট</>}
        </Button>
      </div>
    </div>
  );
}
