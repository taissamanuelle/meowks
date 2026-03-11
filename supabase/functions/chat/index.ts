import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CONFIG ──────────────────────────────────────────────
// Modelo: gemini-2.5-flash (v1beta)
// Free Tier: 10 RPM | 250k TPM | 500 RPD
// maxOutputTokens: 8192 (máx modelo: 65.536)
// Memórias: até 100 (todas, sem filtro)
// Histórico: últimas 5 mensagens
// Pesquisa web: só quando explícito
// Streaming: SSE
// Auth: JWT via Supabase Auth
// API Keys: exclusivamente da tabela profiles (ZERO Lovable gateway)
// ─────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_OUTPUT_TOKENS = 8192;
const HISTORY_LIMIT = 5;
const MEMORY_LIMIT = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── WEB SEARCH (só quando pedido explicitamente) ────────
async function searchWeb(query: string, supabaseUrl: string, authHeader: string): Promise<string | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) { await resp.text(); return null; }
    const data = await resp.json();
    if (!data.results?.length) return null;
    return data.results
      .map((r: { title: string; snippet: string; url: string }, i: number) =>
        `${i + 1}. **${r.title}**\n   ${r.snippet}${r.url ? `\n   Fonte: ${r.url}` : ""}`)
      .join("\n\n");
  } catch { return null; }
}

function detectSearchIntent(messages: any[]): string | null {
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
  if (!lastUserMsg) return null;
  const content = (typeof lastUserMsg.content === "string"
    ? lastUserMsg.content
    : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "").toLowerCase().trim();
  if (content.length < 5) return null;
  const patterns = [
    /\b(pesquis|busca|procur|google|pesquise|busque|procure)\b/,
    /\b(pesquisar|buscar|procurar)\b/,
    /\bpode pesquisar\b/,
  ];
  for (const p of patterns) {
    if (p.test(content)) return content.length > 100 ? content.slice(0, 100) : content;
  }
  return null;
}

// ─── MAIN ────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Auth JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const ALLOWED_EMAIL = Deno.env.get("ALLOWED_EMAIL") || "taissamanuellefj@gmail.com";

    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser || authUser.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. API Keys — EXCLUSIVAMENTE da tabela profiles
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profileData } = await serviceClient
      .from("profiles")
      .select("gemini_api_key, nickname")
      .eq("user_id", authUser.id)
      .single();

    const allApiKeys = ((profileData as any)?.gemini_api_key || "")
      .split(/[,\n]/)
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 10);

    if (allApiKeys.length === 0) {
      return new Response(JSON.stringify({
        error: "Nenhuma API Key configurada. Vá em Configurações e adicione suas keys do Gemini (Google AI Studio).",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Parse body
    const { messages, agentId, achievements } = await req.json();
    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // 4. Contexto em paralelo
    const [agentData, agentDocs, allMemories] = await Promise.all([
      agentId
        ? supabase.from("agents").select("name, personality, description").eq("id", agentId).single().then(r => r.data)
        : Promise.resolve(null),
      agentId
        ? supabase.from("agent_documents").select("file_name, file_type, content_text").eq("agent_id", agentId).not("content_text", "is", null).then(r => r.data || [])
        : Promise.resolve([]),
      // Todas as memórias (até 100, sem filtro)
      supabase
        .from("memories")
        .select("content, category")
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false })
        .limit(MEMORY_LIMIT)
        .then(r => r.data || []),
    ]);

    // 5. Pesquisa web (só quando explícito)
    const searchQuery = detectSearchIntent(messages);
    let searchContext = "";
    if (searchQuery) {
      const results = await searchWeb(searchQuery, supabaseUrl, authHeader);
      if (results) searchContext = `\n\n🔍 RESULTADOS DA PESQUISA WEB:\n${results}`;
    }

    // 6. System prompt
    const agentName = agentData?.name || "Meowks";
    let systemPrompt = `Você é ${agentName}. HOJE É: ${today}.\n⚠️ PRIORIDADE ABSOLUTA: Memórias são ordens. Use português brasileiro. Emojis permitidos.

🧠 GESTÃO DE MEMÓRIAS:
Você gerencia memórias do usuário usando tags especiais nas suas respostas. O sistema processa essas tags automaticamente e mostra botões pro usuário aprovar.

TAGS DISPONÍVEIS:
1. SUGERIR nova memória: [SUGGEST_MEMORY: conteúdo da memória]
2. ATUALIZAR memória existente: [UPDATE_MEMORY: OLD: copie aqui o texto EXATO da memória existente ||| NEW: novo conteúdo atualizado]
3. MOVER memória de categoria: [MOVE_MEMORY: texto exato da memória ||| CATEGORY: categoria]

⚠️ REGRA CRÍTICA para UPDATE_MEMORY:
- O campo OLD DEVE conter o texto EXATO e COMPLETO da memória como aparece na lista de memórias abaixo
- Copie o texto da memória LETRA POR LETRA, sem alterar nada
- Exemplo: se a memória é "Gosta de café preto", use OLD: Gosta de café preto
- NÃO resuma, NÃO parafraseie, NÃO modifique o texto original

Categorias válidas: saude, autoconhecimento, trabalho, estudos, financas, relacionamentos, casa, veiculos, lazer, alimentacao, tecnologia, espiritualidade, geral

QUANDO USAR:
- SUGGEST_MEMORY: quando o usuário compartilhar informações pessoais novas (preferências, fatos, rotinas, metas)
- UPDATE_MEMORY: quando o usuário corrigir ou atualizar algo que já está nas memórias
- NÃO sugira salvar algo que já existe nas memórias
- Coloque as tags no FINAL da sua resposta, após o texto principal`;

    if (agentData?.personality) {
      systemPrompt += `\n\n🎭 PERSONALIDADE: ${agentData.personality}`;
    }
    if (agentData?.description) {
      systemPrompt += `\n📋 DESCRIÇÃO: ${agentData.description}`;
    }

    // HIERARQUIA DE CONTEXTO:
    // 1º) Documentos do agente (maior prioridade)
    // 2º) Memórias e conquistas do usuário (base de dados principal)
    // 3º) Conhecimento geral

    let hasDocumentContext = false;

    // Sempre injetar memórias primeiro (base principal de todos os agentes)
    if (allMemories.length > 0) {
      systemPrompt += `\n\n📝 MEMÓRIAS DO USUÁRIO (${allMemories.length}) — USE COMO BASE PRINCIPAL:
Estas são informações pessoais do usuário. Considere-as sempre nas suas respostas.
${allMemories.map((m: any) => `- [${m.category || "geral"}] ${m.content}`).join("\n")}`;
    }

    // Conquistas do usuário
    if (achievements && achievements.length > 0) {
      systemPrompt += `\n\n🏆 CONQUISTAS DO USUÁRIO:\n${achievements.map((a: any) => `- ${a.title} (${a.year})`).join("\n")}`;
    }

    // Check agent knowledge base docs (prioridade acima das memórias quando presentes)
    if ((agentDocs as any[]).length > 0) {
      hasDocumentContext = true;
      const docsContext = (agentDocs as any[])
        .map((d: any) => `📄 ${d.file_name}:\n${(d.content_text || "[Sem conteúdo extraído — o documento pode não ter sido processado corretamente]").substring(0, 30000)}`)
        .join("\n\n---\n\n");
      systemPrompt += `\n\n📚 BASE DE CONHECIMENTO DO AGENTE (PRIORIDADE MÁXIMA):
⚠️ Quando a pergunta do usuário se relacionar ao conteúdo dos documentos abaixo, priorize as informações dos documentos. Use as memórias do usuário como contexto complementar. Se a informação não estiver nos documentos NEM nas memórias, diga que não encontrou. NÃO invente dados.

${docsContext}`;
    }

    if (searchContext) {
      systemPrompt += searchContext;
    }

    // Also detect document content embedded in user messages (chat-attached docs)
    if (!hasDocumentContext) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
      if (lastUserMsg) {
        const content = typeof lastUserMsg.content === "string" ? lastUserMsg.content : "";
        if (content.includes("📎 Arquivo") || content.includes("INSTRUÇÃO: Responda APENAS com base no conteúdo")) {
          hasDocumentContext = true;
        }
      }
    }

    // 7. Histórico — últimas 5 mensagens
    const recentMessages = messages.slice(-HISTORY_LIMIT);
    const geminiContents = recentMessages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    // Use stronger model when documents are involved for better comprehension
    const model = hasDocumentContext ? "gemini-2.5-flash" : GEMINI_MODEL;
    console.log(`🤖 Model: ${model}, hasDocumentContext: ${hasDocumentContext}, messages: ${recentMessages.length}`);

    const geminiBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: hasDocumentContext ? 0.3 : 0.7, // Lower temperature for document Q&A
      },
    });

    // 8. Rotação de keys — modelo único: gemini-2.5-flash
    let finalResponse: Response | null = null;

    for (let i = 0; i < allApiKeys.length; i++) {
      try {
        const key = allApiKeys[i];
        const url = `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`;

        const attempt = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: geminiBody,
        });

        if (attempt.status === 200) {
          finalResponse = attempt;
          console.log(`✅ Key ${i + 1}/${allApiKeys.length} funcionou`);
          break;
        }

        // Consumir body pra evitar leak
        const errBody = await attempt.text();
        console.warn(`⚠️ Key ${i + 1} falhou (status ${attempt.status}): ${errBody.substring(0, 200)}`);
      } catch (e) {
        console.error(`❌ Key ${i + 1} erro:`, e);
      }
    }

    if (!finalResponse) {
      return new Response(JSON.stringify({
        error: "Todas as API keys falharam. Possíveis causas:\n• Cota diária esgotada (500 req/dia por key)\n• RPM excedido (10 req/min)\n• Key inválida\n\nAdicione mais keys de contas Google diferentes nas Configurações, ou aguarde o reset (meia-noite PST).",
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 9. SSE Stream transform + usage tracking
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Estimate input tokens (rough: 1 token ≈ 4 chars)
    const inputChars = geminiBody.length;
    const estimatedInputTokens = Math.ceil(inputChars / 4);

    (async () => {
      const reader = finalResponse!.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalOutputText = "";

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
                totalOutputText += text;
                const chunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
                await writer.write(encoder.encode(`data: ${chunk}\n\n`));
              }
              // Check for usageMetadata from Gemini
              const usage = data.usageMetadata;
              if (usage) {
                // Will be used after stream ends
                (globalThis as any).__lastUsage = usage;
              }
            } catch { /* skip malformed chunk */ }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));

        // Track usage in api_usage table
        try {
          const geminiUsage = (globalThis as any).__lastUsage;
          const finalInputTokens = geminiUsage?.promptTokenCount || estimatedInputTokens;
          const finalOutputTokens = geminiUsage?.candidatesTokenCount || Math.ceil(totalOutputText.length / 4);
          const today = new Date().toISOString().slice(0, 10);

          await serviceClient.rpc("upsert_api_usage" as any, {
            p_user_id: authUser!.id,
            p_date: today,
            p_requests: 1,
            p_input_tokens: finalInputTokens,
            p_output_tokens: finalOutputTokens,
          }).then(() => {
            console.log(`📊 Usage tracked: +1 req, +${finalInputTokens} in, +${finalOutputTokens} out`);
          }).catch(async () => {
            // Fallback: direct upsert if RPC doesn't exist
            const { data: existing } = await serviceClient
              .from("api_usage")
              .select("id, request_count, input_tokens, output_tokens")
              .eq("user_id", authUser!.id)
              .eq("usage_date", today)
              .maybeSingle();

            if (existing) {
              await serviceClient.from("api_usage").update({
                request_count: existing.request_count + 1,
                input_tokens: Number(existing.input_tokens) + finalInputTokens,
                output_tokens: Number(existing.output_tokens) + finalOutputTokens,
              }).eq("id", existing.id);
            } else {
              await serviceClient.from("api_usage").insert({
                user_id: authUser!.id,
                usage_date: today,
                request_count: 1,
                input_tokens: finalInputTokens,
                output_tokens: finalOutputTokens,
              });
            }
            console.log(`📊 Usage tracked (fallback): +1 req, +${finalInputTokens} in, +${finalOutputTokens} out`);
          });
        } catch (e) {
          console.error("Usage tracking error:", e);
        }
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });

  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: "Erro interno do servidor." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
