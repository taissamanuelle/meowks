// @ts-ignore
import type { VercelRequest, VercelResponse } from "@vercel/node";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── AUXILIAR DE PESQUISA WEB (Conecta com sua Edge Function) ─────

async function searchWeb(query: string, supabaseUrl: string, anonKey: string): Promise<string | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.results || data.results.length === 0) return null;

    return data.results
      .map((r: any, i: number) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   Fonte: ${r.url}`)
      .join("\n\n");
  } catch (e) {
    console.error("Erro na busca:", e);
    return null;
  }
}

// ── DECISÃO DE BUSCA (Lógica Local para Velocidade) ──────────────

function getSearchQuery(messages: any[]): string | null {
  const lastMsg = [...messages].reverse().find(m => m.role === "user")?.content;
  if (!lastMsg || typeof lastMsg !== "string" || lastMsg.length < 5) return null;

  const triggers = [/\b(o que|quem|onde|como|quando|preço|site|oficial|notícia|atualização|melhor|comprar)\b/i, /\?/];
  const isCasual = /^(oi|olá|tudo bem|valeu|obrigad|tchau|ok|sim|não)/i.test(lastMsg);

  if (!isCasual && triggers.some(t => t.test(lastMsg))) {
    return lastMsg.slice(0, 100);
  }
  return null;
}

// ── HANDLER PRINCIPAL ──────────────────────────────────────────

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { GROQ_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY ausente");

    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    const { messages, memories, userNickname } = body;

    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    // 1. Executa Pesquisa se necessário
    let searchContext = "";
    const query = getSearchQuery(messages);
    if (query && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const results = await searchWeb(query, SUPABASE_URL, SUPABASE_ANON_KEY);
      if (results) {
        searchContext = `\n\n🔍 RESULTADOS DA WEB (Hoje: ${today}):\n${results}\n\nUse isso para responder com precisão e citar fontes.`;
      }
    }

    // 2. Build do Prompt (Firme e Direto)
    let systemPrompt = `Você é Meowks. Responda em PT-BR. HOJE: ${today}.\n`;
    systemPrompt += `⚠️ REGRA: Seja firme, direta e sem bajulação. O usuário odeia que "passem a mão na cabeça".\n`;
    if (userNickname) systemPrompt += `\nUsuário: ${userNickname}.`;
    if (memories?.length) systemPrompt += `\n\n📝 MEMÓRIAS:\n${memories.join("\n")}`;
    systemPrompt += searchContext;

    // 3. Chamada Groq
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    // 4. Fluxo de Stream SSE
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
          if (text) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
        } catch {}
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
