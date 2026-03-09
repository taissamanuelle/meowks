CREATE POLICY "Users can update own usage"
ON public.api_usage
FOR UPDATE
TO authenticated
USING ((auth.uid() = user_id) AND is_allowed_email())
WITH CHECK ((auth.uid() = user_id) AND is_allowed_email());