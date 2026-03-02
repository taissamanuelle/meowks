
CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  year integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
ON public.achievements FOR SELECT
USING ((auth.uid() = user_id) AND is_allowed_email());

CREATE POLICY "Users can create achievements"
ON public.achievements FOR INSERT
WITH CHECK ((auth.uid() = user_id) AND is_allowed_email());

CREATE POLICY "Users can update own achievements"
ON public.achievements FOR UPDATE
USING ((auth.uid() = user_id) AND is_allowed_email());

CREATE POLICY "Users can delete own achievements"
ON public.achievements FOR DELETE
USING ((auth.uid() = user_id) AND is_allowed_email());

CREATE TRIGGER update_achievements_updated_at
BEFORE UPDATE ON public.achievements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
