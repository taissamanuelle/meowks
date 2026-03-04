import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export type MsgContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
export type Msg = { role: "user" | "assistant"; content: string; images?: string[] };

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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
  signal,
}: {
  messages: Msg[];
  memories: string[];
  achievements?: { title: string; year: number }[];
  conversationId: string;
  userNickname?: string;
  agentId?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  // Convert messages to API format (multimodal when images present)
  const apiMessages = messages.map((m) => {
    if (m.images && m.images.length > 0) {
      const content: MsgContent = [];
      if (m.content) content.push({ type: "text", text: m.content });
      m.images.forEach((url) => {
        content.push({ type: "image_url", image_url: { url } });
      });
      return { role: m.role, content };
    }
    return { role: m.role, content: m.content };
  });

  const token = await getAuthToken();

  // Create an AbortController with timeout fallback (90s max)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  
  // If external signal is provided, link it
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  let resp: Response;
  try {
    resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages: apiMessages, memories, achievements, conversationId, userNickname, agentId }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      throw new Error("A requisição demorou demais. Tente novamente.");
    }
    throw new Error("Falha ao conectar com a IA");
  }

  if (resp.status === 429) {
    clearTimeout(timeoutId);
    throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
  }
  if (resp.status === 402) {
    clearTimeout(timeoutId);
    throw new Error("Créditos insuficientes.");
  }
  if (!resp.ok || !resp.body) {
    clearTimeout(timeoutId);
    throw new Error("Falha ao conectar com a IA");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  let lastDataTime = Date.now();

  try {
    while (!done) {
      // Timeout if no data received for 30 seconds
      const timeSinceLastData = Date.now() - lastDataTime;
      if (timeSinceLastData > 30000) {
        console.warn("Stream stalled for 30s, closing");
        break;
      }

      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      
      lastDataTime = Date.now();
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buf = line + "\n" + buf;
          break;
        }
      }
    }

    // Process remaining buffer
    if (buf.trim()) {
      for (let raw of buf.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw.startsWith("data: ")) continue;
        const json = raw.slice(6).trim();
        if (json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }
  } catch (e: any) {
    console.error("Stream read error:", e);
    // Don't throw — just end gracefully so onDone fires
  } finally {
    clearTimeout(timeoutId);
    try { reader.releaseLock(); } catch {}
  }

  onDone();
}
