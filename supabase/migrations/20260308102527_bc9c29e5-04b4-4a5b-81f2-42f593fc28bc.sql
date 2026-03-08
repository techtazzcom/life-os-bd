
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS intro text DEFAULT '',
  ADD COLUMN IF NOT EXISTS work text DEFAULT '',
  ADD COLUMN IF NOT EXISTS website text DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_link text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hide_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_mobile boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();
