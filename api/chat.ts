// @ts-ignore
import type { VercelRequest, VercelResponse } from "@vercel/node";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── Helpers de Extração e Busca ──────────────────────────────────

function extractYouTubeUrl(messages: any[]): string | null {
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
  if (!lastUserMsg) return null;
  const content =
    typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "";
  const ytMatch = content.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return ytMatch ? ytMatch[0] : null;
}

async function searchWeb(
  query: string,
  supabaseUrl: string,
  anonKey: string
): Promise<string | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.results || data.results.length === 0) return null;

    return data.results
      .map(
        (r: { title: string; snippet: string; url: string }, i: number) =>
          `${i + 1}. **${r.title}**\n   ${r.snippet}${r.url ? `\n   Fonte: ${r.url}` : ""}`
      )
      .join("\n\n");
  } catch (e) {
    console.error("Search failed:", e);
    return null;
  }
}

async function fetchYouTubeTranscript(
  url: string,
  supabaseUrl: string,
  anonKey: string
): Promise<{ title: string; plainText: string; fullText: string; durationSeconds: number } | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/youtube-transcript`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.error) return null;
    return {
      title: data.title,
      plainText: data.plainText,
      fullText: data.fullText,
      durationSeconds: data.durationSeconds,
    };
  } catch (e) {
    console.error("YouTube transcript fetch failed:", e);
    return null;
  }
}

// ── Formatação de Mensagens ──────────────────────────────────────

function convertToGroqMessages(systemPrompt: string, messages: any[]): any[] {
  const groqMsgs = [{ role: "system", content: systemPrompt }];
  
  for (const msg of messages) {
    // Groq usa 'assistant', o Gemini usava 'model'
    const role = msg.role === "model" ? "assistant" : msg.role;
    let content = "";

    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
    }
    
    groqMsgs.push({ role, content });
  }
  return groqMsgs;
}

// ── Supabase Helpers ─────────────────────────────────────────────

async function verifySupabaseToken(
  token: string,
  supabaseUrl: string,
  anonKey: string
): Promise<{ id: string; email: string } | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}

async function fetchAgent(agentId: string, supabaseUrl: string, anonKey: string, token: string) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/agents?id=eq.${agentId}&select=name,personality,description`,
    {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.[0] || null;
}

async function fetchAgentDocs(agentId: string, supabaseUrl: string, anonKey: string, token: string) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/agent_documents?agent_id=eq.${agentId}&content_text=not.is.null&select=file_name,file_type,content_text`,
    {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    }
  );
  if (!resp.ok) return [];
  return await resp.json();
}

// ── System Prompt Builder ────────────────────────────────────────

function buildSystemPrompt(opts: {
  agentData: any;
  agentDocs: any[];
  today: string;
  userNickname?: string;
  memories?: string[];
  achievements?: { title: string; year: number }[];
  searchContext: string;
  youtubeContext: string;
}): string {
  const { agentData, agentDocs, today, userNickname, memories, achievements, searchContext, youtubeContext } = opts;
  
  let systemPrompt = `Você é Meowks, uma IA direta, firme e sem bajulação. Responda sempre em português brasileiro.\n`;
  systemPrompt += `HOJE É: ${today}.\n\n`;

  if (agentData) {
    systemPrompt += `IDENTIDADE ATUAL: ${agentData.name}\n${agentData.description ? `DESCRIÇÃO: ${agentData.description}` : ""}\n${agentData.personality ? `PERSONALIDADE: ${agentData.personality}` : ""}`;
  }

  systemPrompt += `\n\n⚠️ REGRA DE OURO: O usuário não gosta de bajulação ou elogios excessivos. Seja dura quando necessário e sempre direta.`;

  if (userNickname) systemPrompt += `\n\nChame o usuário de "${userNickname}".`;

  if (memories && memories.length > 0) {
    systemPrompt += `\n\n📝 MEMÓRIAS SALVAS (ORDENS DIRETAS - OBEDEÇA): \n${memories.map((m: string) => `- ${m}`).join("\n")}`;
  }

  if (agentDocs && agentDocs.length > 0) {
    const docsText = agentDocs.map((d: any) => `[Documento: ${d.file_name}]: ${d.content_text}`).join("\n\n");
    systemPrompt += `\n\n📚 BASE DE CONHECIMENTO:\n${docsText}`;
  }

  if (searchContext) systemPrompt += `\n\n🔍 CONTEXTO WEB:\n${searchContext}`;
  if (youtubeContext) systemPrompt += `\n\n🎬 CONTEXTO YOUTUBE:\n${youtubeContext}`;

  return systemPrompt;
}

// ── Handler Principal (Export) ───────────────────────────────────

export default async function handler(req: any, res: any) {
  // Configuração de CORS para Vercel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY não configurada no Vercel");

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || "";

    if (token && SUPABASE_URL && SUPABASE_ANON_KEY) {
      await verifySupabaseToken(token, SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    const { messages, memories, achievements, userNickname, agentId } = req.body;
    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    // Coleta de dados paralela
    const [agentData, agentDocs, youtubeData] = await Promise.all([
      agentId ? fetchAgent(agentId, SUPABASE_URL, SUPABASE_ANON_KEY, token) : Promise.resolve(null),
      agentId ? fetchAgentDocs(agentId, SUPABASE_URL, SUPABASE_ANON_KEY, token) : Promise.resolve([]),
      extractYouTubeUrl(messages) ? fetchYouTubeTranscript(extractYouTubeUrl(messages)!, SUPABASE_URL, SUPABASE_ANON_KEY) : Promise.resolve(null),
    ]);

    const systemPrompt = buildSystemPrompt({
      agentData, agentDocs, today, userNickname, memories, achievements,
      searchContext: "",
      youtubeContext: youtubeData ? `\nTranscrição do vídeo "${youtubeData.title}":\n${youtubeData.plainText}` : "",
    });

    const groqBody = convertToGroqMessages(systemPrompt, messages);

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqBody,
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `Erro no Groq: ${response.status} - ${errorText}` });
    }

    // Preparação do Stream SSE para o Frontend
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body as any;
    const decoder = new TextDecoder();
    let buf = "";

    for await (const chunk of reader) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) {
            // Envia o chunk no formato que o frontend espera
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
          }
        } catch (e) {
          // Ignora falhas de parse em chunks incompletos
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (e: any) {
    console.error("Erro na função de chat:", e);
    res.status(500).json({ error: e.message });
  }
}
