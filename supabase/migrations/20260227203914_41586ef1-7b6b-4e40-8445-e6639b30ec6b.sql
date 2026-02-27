
-- Create a helper function to check allowed email (avoids repetition in policies)
CREATE OR REPLACE FUNCTION public.is_allowed_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.email() = 'taissamanuellefj@gmail.com'
$$;

-- Re-create all RLS policies with email restriction

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_allowed_email());

-- CONVERSATIONS
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations" ON public.conversations FOR DELETE
  USING (auth.uid() = user_id AND public.is_allowed_email());

-- MESSAGES
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can create messages" ON public.messages;
CREATE POLICY "Users can create messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE
  USING (auth.uid() = user_id AND public.is_allowed_email());

-- MEMORIES
DROP POLICY IF EXISTS "Users can view own memories" ON public.memories;
CREATE POLICY "Users can view own memories" ON public.memories FOR SELECT
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can create memories" ON public.memories;
CREATE POLICY "Users can create memories" ON public.memories FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can update own memories" ON public.memories;
CREATE POLICY "Users can update own memories" ON public.memories FOR UPDATE
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can delete own memories" ON public.memories;
CREATE POLICY "Users can delete own memories" ON public.memories FOR DELETE
  USING (auth.uid() = user_id AND public.is_allowed_email());

-- NEURAL_NODES
DROP POLICY IF EXISTS "Users can view own nodes" ON public.neural_nodes;
CREATE POLICY "Users can view own nodes" ON public.neural_nodes FOR SELECT
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can create nodes" ON public.neural_nodes;
CREATE POLICY "Users can create nodes" ON public.neural_nodes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can update nodes" ON public.neural_nodes;
CREATE POLICY "Users can update nodes" ON public.neural_nodes FOR UPDATE
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can delete nodes" ON public.neural_nodes;
CREATE POLICY "Users can delete nodes" ON public.neural_nodes FOR DELETE
  USING (auth.uid() = user_id AND public.is_allowed_email());

-- NEURAL_CONNECTIONS
DROP POLICY IF EXISTS "Users can view own connections" ON public.neural_connections;
CREATE POLICY "Users can view own connections" ON public.neural_connections FOR SELECT
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can create connections" ON public.neural_connections;
CREATE POLICY "Users can create connections" ON public.neural_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can delete connections" ON public.neural_connections;
CREATE POLICY "Users can delete connections" ON public.neural_connections FOR DELETE
  USING (auth.uid() = user_id AND public.is_allowed_email());

-- PIN_SESSIONS
DROP POLICY IF EXISTS "Users can view own pin sessions" ON public.pin_sessions;
CREATE POLICY "Users can view own pin sessions" ON public.pin_sessions FOR SELECT
  USING (auth.uid() = user_id AND public.is_allowed_email());

DROP POLICY IF EXISTS "Users can delete own pin sessions" ON public.pin_sessions;
CREATE POLICY "Users can delete own pin sessions" ON public.pin_sessions FOR DELETE
  USING (auth.uid() = user_id AND public.is_allowed_email());
