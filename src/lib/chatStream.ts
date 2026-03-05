import { supabase } from "@/integrations/supabase/client";

export interface Msg {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

interface StreamChatOptions {
  messages: Msg[];
  memories?: string[];
  achievements?: { title: string; year: number }[];
  conversationId?: string;
  userNickname?: string;
  agentId?: string;
  onDelta: (chunk: string) => void;
  onDone: () => void;
}

export async function streamChat({
  messages,
  memories,
  achievements,
  conversationId,
  userNickname,
  agentId,
  onDelta,
  onDone,
}: StreamChatOptions) {
  try {
    // Chamada direta para o seu Vercel, ignorando o Supabase do Lovable
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        memories,
        achievements,
        conversationId,
        userNickname,
        agentId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao conectar com a Meowks no Vercel');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('Falha ao iniciar leitura do stream');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices[0]?.delta?.content;
            if (content) {
              onDelta(content);
            }
          } catch (e) {
            // Ignora chunks incompletos
          }
        }
      }
    }

    onDone();
  } catch (error: any) {
    console.error('Erro no streamChat:', error);
    throw error;
  }
}
