
CREATE TABLE public.api_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.api_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Service role can upsert usage" ON public.api_usage
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
