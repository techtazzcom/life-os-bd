
-- Appeals table for blocked/locked users
CREATE TABLE public.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  appeal_type text NOT NULL DEFAULT 'unblock',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- Users can insert their own appeals
CREATE POLICY "Users can insert own appeals" ON public.appeals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view own appeals
CREATE POLICY "Users can view own appeals" ON public.appeals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all appeals
CREATE POLICY "Admins can view all appeals" ON public.appeals
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update appeals
CREATE POLICY "Admins can update all appeals" ON public.appeals
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can delete appeals
CREATE POLICY "Admins can delete appeals" ON public.appeals
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can delete user profiles (for account deletion)
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
