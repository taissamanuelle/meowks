
-- 1. Add DELETE policy on messages table
CREATE POLICY "Users can delete own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Add input validation to handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  safe_name text;
  safe_avatar text;
BEGIN
  safe_name := LEFT(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    'Usuário'
  ), 100);

  safe_avatar := LEFT(COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  ), 500);

  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (NEW.id, safe_name, safe_avatar, NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create pin_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  attempted_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

-- No client access needed - only service role uses this table
