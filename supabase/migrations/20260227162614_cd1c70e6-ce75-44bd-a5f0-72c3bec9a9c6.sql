
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create memories table
CREATE TABLE public.memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'ai')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own memories" ON public.memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create memories" ON public.memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memories" ON public.memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON public.memories FOR DELETE USING (auth.uid() = user_id);

-- Create neural_nodes table (for the knowledge graph)
CREATE TABLE public.neural_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  importance SMALLINT NOT NULL DEFAULT 1 CHECK (importance >= 1 AND importance <= 5),
  x DOUBLE PRECISION,
  y DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.neural_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own nodes" ON public.neural_nodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create nodes" ON public.neural_nodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update nodes" ON public.neural_nodes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete nodes" ON public.neural_nodes FOR DELETE USING (auth.uid() = user_id);

-- Create neural_connections table
CREATE TABLE public.neural_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_node_id UUID NOT NULL REFERENCES public.neural_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.neural_nodes(id) ON DELETE CASCADE,
  strength DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.neural_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own connections" ON public.neural_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create connections" ON public.neural_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete connections" ON public.neural_connections FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON public.memories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
