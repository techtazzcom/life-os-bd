import { supabase } from "@/integrations/supabase/client";

export interface AdminUser {
  user_id: string;
  name: string;
  email: string;
  mobile: string | null;
  avatar_url: string | null;
  status: string;
  is_verified: boolean;
  lock_until: string | null;
  suspend_reason: string | null;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface AdminNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_user_id: string | null;
  details: any;
  created_at: string;
}

// Check if current user is admin
export async function isAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('user_roles' as any).select('role').eq('user_id', user.id).eq('role', 'admin').single();
  return !!data;
}

// Get all users
export async function getAllUsers(): Promise<AdminUser[]> {
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (!data) return [];
  return data.map((p: any) => ({
    user_id: p.user_id,
    name: p.name,
    email: p.email,
    mobile: p.mobile,
    avatar_url: p.avatar_url,
    status: p.status || 'active',
    is_verified: p.is_verified || false,
    lock_until: p.lock_until,
    suspend_reason: p.suspend_reason,
    is_online: p.is_online,
    last_seen: p.last_seen,
    created_at: p.created_at,
  }));
}

// Update user status
export async function updateUserStatus(userId: string, status: string, reason?: string, lockDays?: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const updates: any = { status };
  if (reason) updates.suspend_reason = reason;
  if (lockDays && lockDays > 0) {
    const lockUntil = new Date();
    lockUntil.setDate(lockUntil.getDate() + lockDays);
    updates.lock_until = lockUntil.toISOString();
  } else if (status === 'active') {
    updates.lock_until = null;
    updates.suspend_reason = null;
  }

  await supabase.from('profiles').update(updates as any).eq('user_id', userId);

  // Log activity
  await logActivity(user.id, `status_${status}`, userId, { reason, lockDays });

  // Notify user
  const titles: Record<string, string> = {
    active: '✅ অ্যাকাউন্ট সক্রিয়',
    blocked: '🚫 অ্যাকাউন্ট ব্লক',
    suspended: '⚠️ অ্যাকাউন্ট সাসপেন্ড',
    locked: '🔒 অ্যাকাউন্ট লক',
  };
  const messages: Record<string, string> = {
    active: 'আপনার অ্যাকাউন্ট আবার সক্রিয় করা হয়েছে।',
    blocked: `আপনার অ্যাকাউন্ট ব্লক করা হয়েছে।${reason ? ` কারণ: ${reason}` : ''}`,
    suspended: `আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে।${reason ? ` কারণ: ${reason}` : ''}`,
    locked: `আপনার অ্যাকাউন্ট ${lockDays} দিনের জন্য লক করা হয়েছে।${reason ? ` কারণ: ${reason}` : ''}`,
  };

  await sendAdminNotification(userId, titles[status] || 'স্ট্যাটাস পরিবর্তন', messages[status] || '', status === 'active' ? 'success' : 'warning');
}

// Toggle verified
export async function toggleVerified(userId: string, verified: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('profiles').update({ is_verified: verified } as any).eq('user_id', userId);
  await logActivity(user.id, verified ? 'verify' : 'unverify', userId, {});
  await sendAdminNotification(
    userId,
    verified ? '✅ অ্যাকাউন্ট ভেরিফাইড' : '❌ ভেরিফিকেশন সরানো হয়েছে',
    verified ? 'আপনার অ্যাকাউন্ট ভেরিফাই করা হয়েছে!' : 'আপনার অ্যাকাউন্টের ভেরিফিকেশন সরিয়ে নেওয়া হয়েছে।',
    verified ? 'success' : 'info'
  );
}

// Send notification
export async function sendAdminNotification(userId: string, title: string, message: string, type: string = 'info') {
  await supabase.from('admin_notifications' as any).insert({ user_id: userId, title, message, type });
}

// Log admin activity
async function logActivity(adminId: string, action: string, targetUserId: string, details: any) {
  await supabase.from('admin_activity_log' as any).insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    details,
  });
}

// Get activity logs
export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { data } = await supabase.from('admin_activity_log' as any).select('*').order('created_at', { ascending: false }).limit(100);
  return (data as any[]) || [];
}

// Get user's data for a specific date (admin view)
export async function getUserDayData(userId: string, date: string) {
  const { data } = await supabase.from('user_data').select('data_content').eq('user_id', userId).eq('date_key', date).single();
  return data?.data_content || null;
}

// Get user's settings (admin view)
export async function getUserSettings(userId: string) {
  const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
  return data;
}

// Get admin notifications for a user
export async function getUserNotifications(userId: string): Promise<AdminNotification[]> {
  const { data } = await supabase.from('admin_notifications' as any).select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return (data as any[]) || [];
}

// Get MY admin notifications (for regular users)
export async function getMyAdminNotifications(): Promise<AdminNotification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('admin_notifications' as any).select('*').eq('user_id', user.id).eq('is_read', false).order('created_at', { ascending: false });
  return (data as any[]) || [];
}

// Mark notification as read
export async function markNotificationRead(notifId: string) {
  await supabase.from('admin_notifications' as any).update({ is_read: true }).eq('id', notifId);
}

// Get dashboard stats
export async function getAdminStats() {
  const { data: users } = await supabase.from('profiles').select('status, is_verified, is_online');
  if (!users) return { total: 0, active: 0, blocked: 0, suspended: 0, locked: 0, verified: 0, online: 0 };
  return {
    total: users.length,
    active: users.filter((u: any) => u.status === 'active').length,
    blocked: users.filter((u: any) => u.status === 'blocked').length,
    suspended: users.filter((u: any) => u.status === 'suspended').length,
    locked: users.filter((u: any) => u.status === 'locked').length,
    verified: users.filter((u: any) => u.is_verified).length,
    online: users.filter((u: any) => u.is_online).length,
  };
}
