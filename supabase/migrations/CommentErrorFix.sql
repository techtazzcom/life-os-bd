-- প্রথমে নিশ্চিত করুন post_comments এ RLS চালু আছে
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- ব্যবহারকারীদেরকে কমেন্ট Insert করার পারমিশন দিন
CREATE POLICY "Users can insert comments" 
ON post_comments
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- সবাই যেন কমেন্ট পড়তে পারে সেই পারমিশন দিন
CREATE POLICY "Everyone can view comments" 
ON post_comments
FOR SELECT 
USING (true);
