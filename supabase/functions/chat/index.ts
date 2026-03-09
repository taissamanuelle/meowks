import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchWeb(query: string, supabaseUrl: string, authHeader: string): Promise<string | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ query }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.results || data.results.length === 0) return null;

    return data.results
      .map((r: { title: string; snippet: string; url: string }, i: number) =>
        `${i + 1}. **${r.title}**\n   ${r.snippet}${r.url ? `\n   Fonte: ${r.url}` : ""}`
      )
      .join("\n\n");
  } catch (e) {
    console.error("Search failed:", e);
    return null;
  }
}

function shouldSearchWeb(messages: any[]): string | null {
  try {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (!lastUserMsg) return null;

    const content = (typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "").toLowerCase().trim();

    if (content.length < 5) return null;

    const explicitSearchPatterns = [
      /\b(pesquis|busca|procur|google|pesquise|busque|procure)\b/,
      /\b(pesquisar|buscar|procurar)\b/,
      /\bpode pesquisar\b/,
    ];

    for (const pattern of explicitSearchPatterns) {
      if (pattern.test(content)) {
        return content.length > 100 ? content.slice(0, 100) : content;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const ALLOWED_EMAIL = Deno.env.get("ALLOWED_EMAIL") || "taissamanuellefj@gmail.com";
    
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser || authUser.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized or Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profileData } = await serviceClient.from("profiles").select("gemini_api_key").eq("user_id", authUser.id).single();
    
    const allApiKeys = ((profileData as any)?.gemini_api_key || "").split(/[,\n]/).map((k: string) => k.trim()).filter((k: string) => k.length > 10);

    if (allApiKeys.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma API Key configurada. Vá em Configurações e adicione suas keys do Gemini." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { messages, agentId } = await req.json();
    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Processamento paralelo de contexto (Youtube removido)
    const [agentData, agentDocs, relevantMemories] = await Promise.all([
      agentId ? supabase.from("agents").select("name, personality, description").eq("id", agentId).single().then(r => r.data) : Promise.resolve(null),
      agentId ? supabase.from("agent_documents").select("file_name, file_type, content_text").eq("agent_id", agentId).not("content_text", "is", null).then(r => r.data || []) : Promise.resolve([]),
      (async () => {
        // Reduzido para 5 memórias mais recentes/relevantes
        const { data } = await supabase.from("memories").select("content, category").eq("user_id", authUser.id).order("updated_at", { ascending: false }).limit(5);
        return data || [];
      })()
    ]);

    const searchQuery = shouldSearchWeb(messages);
    let searchContext = "";
    if (searchQuery) {
      const results = await searchWeb(searchQuery, supabaseUrl, authHeader);
      if (results) searchContext = `\n\n🔍 RESULTADOS WEB: ${results}`;
    }

    let systemPrompt = `Você é ${agentData?.name || 'Meowks'}. HOJE É: ${today}.
    ⚠️ PRIORIDADE ABSOLUTA: Memórias são ordens. Use português brasileiro. Emojis permitidos.`;

    if (relevantMemories.length > 0) {
      systemPrompt += `\n\n📝 MEMÓRIAS (Top 5):\n${relevantMemories.map((m: any) => `- ${m.content}`).join("\n")}`;
    }

    // Limitado a 4 mensagens de histórico para economizar tokens
    const recentMessages = messages.slice(-4);
    const geminiContents = recentMessages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    const geminiBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt + searchContext }] },
      contents: geminiContents,
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }, // Output reduzido para economizar
    });

    const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
    let finalResponse: Response | null = null;

    for (const model of models) {
      for (let i = 0; i < allApiKeys.length; i++) {
        try {
          const key = allApiKeys[i];
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;
          
          const attempt = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: geminiBody,
          });

          if (attempt.status === 200) {
            finalResponse = attempt;
            break;
          }
          
          console.warn(`Tentativa falhou. Key: ${i}, Modelo: ${model}, Status: ${attempt.status}`);
          await new Promise(r => setTimeout(r, 800)); // Delay aumentado para 800ms
        } catch (e) {
          console.error(`Erro na key ${i}:`, e);
        }
      }
      if (finalResponse) break;
    }

    if (!finalResponse) {
      return new Response(JSON.stringify({ error: "Cota esgotada. Tente reduzir o tamanho da sua pergunta ou aguarde o reset da cota (meia-noite PST)." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Transformação do Stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = finalResponse!.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const chunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
                await writer.write(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: "Erro interno." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
