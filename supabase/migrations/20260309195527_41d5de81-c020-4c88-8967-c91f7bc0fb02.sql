
-- Add master_password_hash to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS master_password_hash text;

-- Create user_sessions table for session tracking
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_fingerprint text NOT NULL,
  user_agent text,
  ip_address text,
  city text,
  region text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT TO public USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Users can delete own sessions" ON public.user_sessions
  FOR DELETE TO public USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Users can update own sessions" ON public.user_sessions
  FOR UPDATE TO public USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Service role can manage sessions" ON public.user_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create login_alerts table for suspicious login attempts
CREATE TABLE public.login_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text,
  city text,
  region text,
  country text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);

ALTER TABLE public.login_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON public.login_alerts
  FOR SELECT TO public USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Users can update own alerts" ON public.login_alerts
  FOR UPDATE TO public USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Users can delete own alerts" ON public.login_alerts
  FOR DELETE TO public USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Service role can manage alerts" ON public.login_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
