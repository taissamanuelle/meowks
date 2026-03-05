import type { VercelRequest, VercelResponse } from "@vercel/node";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── helpers ──────────────────────────────────────────────────────

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

// Converte para o formato OpenAI/Groq (MUITO mais simples que o Gemini)
function convertToGroqMessages(systemPrompt: string, messages: any[]): any[] {
  const groqMsgs = [{ role: "system", content: systemPrompt }];
  
  for (const msg of messages) {
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

// ── Supabase auth helper ─────────────────────────────────────────

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

// ── Supabase data helpers ───────────────────────────────────────

async function fetchAgent(agentId: string, supabaseUrl: string, anonKey: string, token: string) {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/agents?id=eq.${agentId}&select=name,personality,description`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
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
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!resp.ok) return [];
  return await resp.json();
}

// ── System prompt builder ───────────────────────────────────────

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
  let systemPrompt = "";

  if (agentData) {
    systemPrompt = `Você é ${agentData.name}.
${agentData.description ? `\nDescrição: ${agentData.description}` : ""}
${agentData.personality ? `\nInstruções de personalidade:\n${agentData.personality}` : ""}

HOJE É: ${today}.

⚠️ REGRA DE OURO — PRIORIDADE MÁXIMA:
As memórias/preferências do usuário listadas mais abaixo são ORDENS DIRETAS com prioridade ABSOLUTA. Se o usuário pediu para ser duro e direto, NÃO use palavras de carinho ou bajulação.

FORMATAÇÃO:
- Use **negrito** e *itálico*.
- Use bullet points (- item).
- Use headings ## e ###.
- Use tabelas Markdown para comparar dados.

SUGESTÃO DE MEMÓRIA:
- Final da resposta: [SUGGEST_MEMORY: texto em primeira pessoa]
- Atualização: [UPDATE_MEMORY: OLD: texto ||| NEW: texto]`;
  } else {
    systemPrompt = `Você é Meowks. Responda em português brasileiro.
HOJE É: ${today}.
PERSONALIDADE: Direta, firme e eficiente. Não bajule o usuário.`;
  }

  if (userNickname) systemPrompt += `\n\nChame o usuário de "${userNickname}".`;

  if (memories && memories.length > 0) {
    systemPrompt += `\n\n📝 MEMÓRIAS DO USUÁRIO (ORDENS DIRETAS):\n${memories.map((m: string) => `- ${m}`).join("\n")}`;
  }

  if (agentDocs && agentDocs.length > 0) {
    const docsText = agentDocs
      .map((d: { file_name: string; content_text: string }) => `--- ${d.file_name} ---\n${d.content_text}`)
      .join("\n\n");
    systemPrompt += `\n\n📚 BASE DE CONHECIMENTO:\n${docsText}`;
  }

  if (searchContext) systemPrompt += searchContext;

  if (achievements && achievements.length > 0) {
    const achievementsList = achievements
      .map((a: { title: string; year: number }) => `- ${a.title} (${a.year})`)
      .join("\n");
    systemPrompt += `\n\n🏆 CONQUISTAS:\n${achievementsList}`;
  }

  if (youtubeContext) systemPrompt += youtubeContext;

  return systemPrompt;
}

// ── Main handler ────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || "";

    if (token && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const user = await verifySupabaseToken(token, SUPABASE_URL, SUPABASE_ANON_KEY);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
    }

    const { messages, memories, achievements, userNickname, agentId } = req.body;
    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    // Paralelização de buscas (Supabase e YouTube)
    const [agentData, agentDocs, youtubeData] = await Promise.all([
      agentId ? fetchAgent(agentId, SUPABASE_URL, SUPABASE_ANON_KEY, token) : Promise.resolve(null),
      agentId ? fetchAgentDocs(agentId, SUPABASE_URL, SUPABASE_ANON_KEY, token) : Promise.resolve([]),
      extractYouTubeUrl(messages) ? fetchYouTubeTranscript(extractYouTubeUrl(messages)!, SUPABASE_URL, SUPABASE_ANON_KEY) : Promise.resolve(null),
    ]);

    // O Meux agora usa o Groq no corpo principal
    const systemPrompt = buildSystemPrompt({
      agentData, agentDocs, today, userNickname, memories, achievements,
      searchContext: "", // Pode adicionar busca aqui se necessário
      youtubeContext: youtubeData ? `\n\n🎬 VÍDEO: ${youtubeData.title}\n${youtubeData.plainText}` : "",
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
        temperature: 0.6,
      }),
    });

    if (!response.ok) return res.status(500).json({ error: `Groq error: ${response.status}` });

    // Stream SSE response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");

    const reader = response.body as any;
    const decoder = new TextDecoder();
    let buf = "";

    for await (const chunk of reader) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) {
            // Mantém o formato que seu frontend espera
            const chunkOut = JSON.stringify({ choices: [{ delta: { content: text } }] });
            res.write(`data: ${chunkOut}\n\n`);
          }
        } catch {}
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (e: any) {
    console.error("Chat error:", e);
    res.status(500).json({ error: e.message || "Unknown error" });
  }
}
