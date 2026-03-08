ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS accounts jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS quick_notes jsonb NOT NULL DEFAULT '[""]'::jsonb,
ADD COLUMN IF NOT EXISTS habit_definitions jsonb NOT NULL DEFAULT '[]'::jsonb;