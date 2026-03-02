
-- Create agents table
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  avatar_url TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add agent_id to conversations
ALTER TABLE public.conversations ADD COLUMN agent_id UUID DEFAULT NULL REFERENCES public.agents(id) ON DELETE SET NULL;

-- RLS for agents
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agents" ON public.agents FOR SELECT USING ((auth.uid() = user_id) AND is_allowed_email());
CREATE POLICY "Users can create agents" ON public.agents FOR INSERT WITH CHECK ((auth.uid() = user_id) AND is_allowed_email());
CREATE POLICY "Users can update own agents" ON public.agents FOR UPDATE USING ((auth.uid() = user_id) AND is_allowed_email());
CREATE POLICY "Users can delete own agents" ON public.agents FOR DELETE USING ((auth.uid() = user_id) AND is_allowed_email());

-- Trigger for updated_at
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
