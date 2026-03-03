
-- Create storage bucket for agent documents
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-documents', 'agent-documents', false);

-- Storage policies for agent documents
CREATE POLICY "Users can upload agent documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1] AND is_allowed_email());

CREATE POLICY "Users can view own agent documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1] AND is_allowed_email());

CREATE POLICY "Users can delete own agent documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1] AND is_allowed_email());

-- Create agent_documents table
CREATE TABLE public.agent_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  content_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent documents"
ON public.agent_documents FOR SELECT
USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Users can create agent documents"
ON public.agent_documents FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Users can update own agent documents"
ON public.agent_documents FOR UPDATE
USING (auth.uid() = user_id AND is_allowed_email());

CREATE POLICY "Users can delete own agent documents"
ON public.agent_documents FOR DELETE
USING (auth.uid() = user_id AND is_allowed_email());
