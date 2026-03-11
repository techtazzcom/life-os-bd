// src/lib/feedStore.ts
import { supabase } from "@/integrations/supabase/client";

export interface Post {
  id?: string;
  user_id: string;
  content: string;
  category: string;
  image_url?: string | null;
  created_at?: string;
}

/**
 * Create a new post in the feed
 */
export async function createPost(
  userId: string,
  content: string,
  category: string,
  imageUrl?: string | null
) {
  try {
    // Validate inputs
    if (!userId || !content.trim() || !category) {
      throw new Error("Missing required fields");
    }

    if (content.trim().length === 0 || content.trim().length > 5000) {
      throw new Error("পোস্ট ১-৫০০০ অক্ষরের মধ্যে হতে হবে");
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: content.trim(),
        category: category,
        image_url: imageUrl || null,
        created_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Post creation error:", error);
      throw new Error(error.message || "পোস্ট তৈরিতে ব্যর্থ হয়েছে");
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Feed store error:", error);
    return {
      success: false,
      error: error?.message || "অজানা ত্রুটি সংঘটিত হয়েছে",
    };
  }
}

/**
 * Get all posts with pagination
 */
export async function getPosts(
  limit: number = 20,
  offset: number = 0,
  currentUserId?: string
) {
  try {
    let query = supabase
      .from("posts")
      .select(
        `
        *,
        profile:user_id(name, is_verified, is_online, avatar_url),
        likes:post_likes(count),
        post_comments(count),
        my_like:post_likes(id, user_id)
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      data: (data as any[]) || [],
    };
  } catch (error: any) {
    console.error("Get posts error:", error);
    return { success: false, data: [], error: error?.message };
  }
}

/**
 * Delete a post
 */
export async function deletePost(postId: string, userId: string) {
  try {
    // Verify ownership
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (fetchError || post?.user_id !== userId) {
      throw new Error("আপনার এই পোস্টটি ডিলিট করার অনুমতি নেই");
    }

    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId);

    if (deleteError) throw deleteError;

    return { success: true };
  } catch (error: any) {
    console.error("Delete post error:", error);
    return { success: false, error: error?.message };
  }
}

/**
 * Like a post
 */
export async function likePost(postId: string, userId: string) {
  try {
    const { error } = await supabase
      .from("post_likes")
      .insert({ post_id: postId, user_id: userId } as any);

    if (error) {
      // If already liked, try to unlike
      if (error.code === "23505") {
        return unlikePost(postId, userId);
      }
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error("Like post error:", error);
    return { success: false, error: error?.message };
  }
}

/**
 * Unlike a post
 */
export async function unlikePost(postId: string, userId: string) {
  try {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Unlike post error:", error);
    return { success: false, error: error?.message };
  }
}
