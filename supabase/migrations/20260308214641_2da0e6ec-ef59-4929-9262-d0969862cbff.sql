
-- Add post_id and reply_enabled to reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reply_enabled boolean NOT NULL DEFAULT false;

-- Create report_replies table for conversation between admin and reporter
CREATE TABLE public.report_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.report_replies ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage report replies" ON public.report_replies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view replies on their own reports
CREATE POLICY "Users can view own report replies" ON public.report_replies
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reports r WHERE r.id = report_replies.report_id AND r.reporter_id = auth.uid()
  ));

-- Users can insert replies only when reply_enabled
CREATE POLICY "Users can reply when enabled" ON public.report_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND is_admin = false AND EXISTS (
      SELECT 1 FROM public.reports r WHERE r.id = report_replies.report_id AND r.reporter_id = auth.uid() AND r.reply_enabled = true
    )
  );
