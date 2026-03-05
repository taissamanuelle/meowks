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
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        memories,
        achievements,
        conversationId,
        userNickname,
        agentId,
      }),
    });

    if (!response.ok) throw new Error('Erro na conexão com Meowks');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let partialLine = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunk).split('\n');
      partialLine = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const data = JSON.parse(jsonStr);
          const content = data.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch (e) {
          // Ignora erros de parse em linhas malformadas
        }
      }
    }
    onDone();
  } catch (error) {
    console.error('Erro no stream:', error);
    throw error;
  }
}
