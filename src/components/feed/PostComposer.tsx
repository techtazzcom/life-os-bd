import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";

interface PostComposerProps {
  currentUserId: string;
  onPostSubmitted: () => void;
}

export default function PostComposer({ currentUserId, onPostSubmitted }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) {
      toast.error("পোস্টে কিছু লিখুন অথবা ছবি যোগ করুন");
      return;
    }
    if (!currentUserId) {
      toast.error("আগে লগইন করুন");
      return;
    }

    setIsSubmitting(true);

    try {
      let image_url: string | null = null;

      // Upload image if exists
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageFile);

        if (uploadError) {
          console.error("Image upload error:", uploadError);
          toast.error("ছবি আপলোড ব্যর্থ হয়েছে");
          setIsSubmitting(false);
          return;
        }

        const { data: publicUrl } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);
        image_url = publicUrl.publicUrl;
      }

      // Insert post
      const { error } = await supabase.from("posts").insert({
        content: content.trim(),
        image_url,
        user_id: currentUserId,
      });

      if (error) {
        console.error("Post insert error:", error);
        toast.error("পোস্ট করতে ব্যর্থ: " + error.message);
        return;
      }

      toast.success("পোস্ট সফল হয়েছে!");
      setContent("");
      setImageFile(null);
      setImagePreview(null);
      onPostSubmitted();
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("কিছু একটা সমস্যা হয়েছে");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
          H
        </div>
        <textarea
          className="flex-1 resize-none border-none outline-none text-sm placeholder:text-gray-400 min-h-[60px]"
          placeholder="আপনার মনে কী আছে...?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {imagePreview && (
        <div className="mt-3 relative">
          <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg object-cover" />
          <button
            onClick={() => { setImageFile(null); setImagePreview(null); }}
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs"
          >✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <label className="cursor-pointer text-blue-500 hover:text-blue-600">
          <ImagePlus size={22} />
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </label>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || (!content.trim() && !imageFile)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-1.5 rounded-full text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          পোস্ট করুন
        </button>
      </div>
    </div>
  );
}
