
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can delete own call signals" ON public.call_signals;
DROP POLICY IF EXISTS "Users can insert call signals" ON public.call_signals;
DROP POLICY IF EXISTS "Users can view their own call signals" ON public.call_signals;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view their own call signals"
ON public.call_signals FOR SELECT TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert call signals"
ON public.call_signals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can delete own call signals"
ON public.call_signals FOR DELETE TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
