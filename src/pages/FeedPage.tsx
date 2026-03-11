// src/pages/FeedPage.tsx - এই অংশ যোগ করুন/পরিবর্তন করুন

import { createPost, getPosts, deletePost, likePost, unlikePost } from "@/lib/feedStore";

// Component-এর মধ্যে post submission handler যোগ করুন:

const handlePostSubmit = async () => {
  if (!postContent.trim()) {
    toast.error("পোস্ট খালি রাখা যায় না!");
    return;
  }

  if (!selectedCategory) {
    toast.error("ক্যাটাগরি নির্বাচন করুন!");
    return;
  }

  // Check spam
  if (spamWordsLoaded) {
    const spamResult = checkSpam(postContent);
    if (spamResult.isSpam) {
      recordViolation(currentUserId, "spam_post");
      const isBanned = await isSpamBanned(currentUserId);
      if (isBanned) {
        toast.error("আপনি স্প্যাম করার কারণে সাময়িক নিষেধাজ্ঞায় আছেন!");
        return;
      }
      toast.error("আপনার পোস্টে নিষিদ্ধ শব্দ রয়েছে!");
      return;
    }
  }

  setPosting(true);

  try {
    let imageUrl = null;

    // Upload image if selected
    if (selectedImage) {
      const compressed = await compressImage(selectedImage);
      const fileName = `posts/${currentUserId}/${Date.now()}.jpg`;
      const { error: uploadError, data } = await supabase.storage
        .from("user-media")
        .upload(fileName, compressed);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("user-media").getPublicUrl(fileName);
      imageUrl = publicUrl;
    }

    // Create post
    const result = await createPost(
      currentUserId,
      postContent,
      selectedCategory,
      imageUrl
    );

    if (!result.success) {
      toast.error(result.error || "পোস্ট তৈরি করতে ব্যর্থ");
      return;
    }

    // Success - clear form and reload posts
    toast.success("পোস্ট সফলভাবে শেয়ার করা হয়েছে! ✨");
    setPostContent("");
    setSelectedImage(null);
    setPreviewUrl(null);
    setSelectedCategory("general");

    // Reload posts
    await loadPosts();
  } catch (error: any) {
    console.error("Submit error:", error);
    toast.error(error?.message || "পোস্ট শেয়ার করতে ব্যর্থ");
  } finally {
    setPosting(false);
  }
};
