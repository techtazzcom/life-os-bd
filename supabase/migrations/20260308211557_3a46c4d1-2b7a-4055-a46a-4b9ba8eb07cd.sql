
-- Group chats table
CREATE TABLE public.chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  avatar_url text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Group members table
CREATE TABLE public.chat_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chat_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now()
);

-- Group messages table
CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chat_groups(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one membership per user per group
ALTER TABLE public.chat_group_members ADD CONSTRAINT unique_group_member UNIQUE (group_id, user_id);

-- Enable RLS
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS for chat_groups: members can view groups they belong to
CREATE POLICY "Members can view their groups" ON public.chat_groups
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = chat_groups.id AND user_id = auth.uid()));

CREATE POLICY "Authenticated users can create groups" ON public.chat_groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creator can update" ON public.chat_groups
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Group creator can delete" ON public.chat_groups
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- RLS for chat_group_members
CREATE POLICY "Members can view group members" ON public.chat_group_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_group_members gm WHERE gm.group_id = chat_group_members.group_id AND gm.user_id = auth.uid()));

CREATE POLICY "Group admins can add members" ON public.chat_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.chat_group_members gm WHERE gm.group_id = chat_group_members.group_id AND gm.user_id = auth.uid() AND gm.role IN ('admin', 'creator'))
    OR EXISTS (SELECT 1 FROM public.chat_groups g WHERE g.id = chat_group_members.group_id AND g.created_by = auth.uid())
  );

CREATE POLICY "Members can leave group" ON public.chat_group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.chat_groups g WHERE g.id = chat_group_members.group_id AND g.created_by = auth.uid()));

-- RLS for group_messages
CREATE POLICY "Members can view group messages" ON public.group_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()));

CREATE POLICY "Members can send group messages" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
