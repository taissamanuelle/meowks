// @ts-ignore
import type { VercelRequest, VercelResponse } from "@vercel/node";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── HELPERS (Lógica de YouTube e Extração) ───────────────────────

function extractYouTubeUrl(messages: any[]): string | null {
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
  if (!lastUserMsg) return null;
  const content = typeof lastUserMsg.content === "string" 
    ? lastUserMsg.content 
    : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "";
  const ytMatch = content.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return ytMatch ? ytMatch[0] : null;
}

// ── SYSTEM PROMPT BUILDER (Firme e Direto) ───────────────────────

function buildSystemPrompt(opts: {
  today: string;
  userNickname?: string;
  memories?: string[];
  youtubeContext?: string;
}): string {
  const { today, userNickname, memories, youtubeContext } = opts;
  
  let systemPrompt = `Você é Meowks. Responda em português brasileiro. HOJE É: ${today}.\n`;
  systemPrompt += `⚠️ REGRA DE OURO: Seja firme, direta e sem bajulação. O usuário odeia que "passem a mão na cabeça". Não use frases motivacionais baratas.\n`;
  
  if (userNickname) systemPrompt += `\nO usuário se chama: ${userNickname}.`;

  if (memories && memories.length > 0) {
    systemPrompt += `\n\n📝 MEMÓRIAS DO USUÁRIO (ORDENS DIRETAS):\n${memories.map((m: string) => `- ${m}`).join("\n")}`;
  }

  if (youtubeContext) {
    systemPrompt += `\n\n🎬 CONTEÚDO DO VÍDEO YOUTUBE:\n${youtubeContext}`;
  }

  return systemPrompt;
}

// ── MAIN HANDLER (Vercel Node.js) ────────────────────────────────

export default async function handler(req: any, res: any) {
  // Configuração Robusta de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type, x-supabase-client-platform");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY não configurada no Vercel");

    // 1. Parser do Body (Corrige o erro de 'undefined')
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { console.error("Erro no parse do body"); }
    }

    const { messages, memories, userNickname, youtubeData } = body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Mensagens inválidas ou não enviadas." });
    }

    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    // 2. Construção do Contexto
    const systemPrompt = buildSystemPrompt({
      today,
      userNickname,
      memories,
      youtubeContext: youtubeData?.plainText || ""
    });

    // 3. Chamada ao Groq (Formato OpenAI)
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }

    // 4. Configuração de Resposta em Stream SSE
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
            // Formato JSON stringificado que o frontend do Lovable precisa
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
          }
        } catch (e) {
          // Ignora falhas de parse em pedaços de JSON
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (e: any) {
    console.error("Erro Final no Chat:", e.message);
    res.status(500).json({ error: e.message });
  }
}
