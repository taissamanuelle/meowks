import { supabase } from "@/integrations/supabase/client";

export interface MsgDocument {
  name: string;
  type: string; // "pdf" | "csv"
}

export interface Msg {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  documents?: MsgDocument[];
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
    // LIMPEZA: O Groq só aceita texto puro. Se houver JSON de imagem, extraímos o texto.
    const cleanedMessages = messages.map(m => {
      let cleanContent = m.content;
      try {
        const parsed = JSON.parse(m.content);
        if (parsed.text) cleanContent = parsed.text;
      } catch { /* Já é texto */ }
      
      return { 
        role: m.role === "assistant" ? "assistant" : "user", 
        content: String(cleanContent).trim() 
      };
    }).filter(m => m.content !== "");

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error('Usuário não autenticado');

    const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    
    // Add timeout for the fetch - 120 seconds max
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: cleanedMessages,
        memories,
        achievements,
        userNickname,
        agentId,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      let errorDetail = '';
      try {
        const body = await response.json();
        errorDetail = body?.error || '';
      } catch {
        errorDetail = await response.text().catch(() => '');
      }
      console.error('Chat API error:', status, errorDetail);
      if (status === 429) throw new Error('rate_limit');
      if (status === 401 || status === 403) throw new Error('auth_error');
      throw new Error(errorDetail || 'server_error');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let partial = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = (partial + chunk).split('\n');
      partial = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const data = JSON.parse(jsonStr);
          const content = data.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch (e) { }
      }
    }
    onDone();
  } catch (error: any) {
    console.error('Erro no stream:', error);
    throw error;
  }
}
