
CREATE TABLE public.pin_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.pin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pin sessions"
  ON public.pin_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pin sessions"
  ON public.pin_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
