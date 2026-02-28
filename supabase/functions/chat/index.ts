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

async function decideSearch(
  messages: any[],
  lovableApiKey: string
): Promise<string | null> {
  try {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (!lastUserMsg) return null;

    const content = typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "";

    if (content.length < 5) return null;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um classificador. Analise a última mensagem do usuário e decida se uma pesquisa na web seria útil para dar uma resposta melhor.

Responda APENAS com um JSON no formato: {"search": true, "query": "termo de busca"} ou {"search": false}

Pesquise quando:
- O usuário pergunta sobre notícias, eventos recentes ou coisas atuais
- Pergunta sobre algo específico que você pode não saber (um produto, empresa, pessoa pública, tecnologia)
- Pede informações factuais que podem ter mudado
- Menciona algo que você não consegue identificar com certeza
- Pergunta "o que é X" sobre algo que pode ser nicho

NÃO pesquise quando:
- É conversa casual, saudação ou desabafo
- Pergunta sobre sentimentos, opinião ou conselhos pessoais
- É sobre programação básica ou conhecimento geral bem estabelecido
- É uma continuação simples da conversa`,
          },
          {
            role: "user",
            content: content,
          },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "";

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = answer.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.search && parsed.query) {
      console.log("AI decided to search for:", parsed.query);
      return parsed.query;
    }
    return null;
  } catch (e) {
    console.error("Search decision error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ALLOWED_EMAIL = Deno.env.get("ALLOWED_EMAIL") || "taissamanuellefj@gmail.com";
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser || authUser.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { messages, memories, conversationId, userNickname } = await req.json();

    // Step 1: Decide if web search is needed (fast, lightweight call)
    const searchQuery = await decideSearch(messages, LOVABLE_API_KEY);
    
    // Step 2: If search is needed, do it
    let searchContext = "";
    if (searchQuery) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const results = await searchWeb(searchQuery, supabaseUrl, authHeader);
      if (results) {
        searchContext = `\n\n🔍 RESULTADOS DE PESQUISA WEB para "${searchQuery}":\n${results}\n\nUse essas informações para enriquecer sua resposta. Cite as fontes quando relevante. Se os resultados não forem úteis, ignore-os.`;
      }
    }

    let systemPrompt = `Você é Meowks, uma assistente de IA inteligente, carinhosa e conversacional. Responda sempre em português brasileiro.

PERSONALIDADE PADRÃO (use SOMENTE se NÃO houver memórias que contradigam):
- Seja expansiva, detalhista e envolvente nas respostas. Desenvolva bem os assuntos.
- Converse como uma amiga próxima que adora bater papo — não tenha pressa de encerrar.
- Faça perguntas de acompanhamento, dê exemplos, conte curiosidades, sugira coisas relacionadas.
- Use um tom acolhedor, simpático e com personalidade. Pode usar emojis com moderação.
- Quando o assunto permitir, explore diferentes ângulos e ofereça perspectivas interessantes.

⚠️ REGRA DE OURO — PRIORIDADE MÁXIMA:
As memórias do usuário listadas abaixo são ORDENS DIRETAS com prioridade ABSOLUTA sobre tudo acima.
Se uma memória diz "seja breve", você DEVE ser breve — mesmo que a personalidade padrão diga para ser expansiva.
Se uma memória diz "não use emojis", você NÃO usa emojis — mesmo que a personalidade padrão sugira usar.
As memórias SEMPRE vencem qualquer instrução padrão. Sem exceção. Sem "às vezes". SEMPRE.

REGRAS ADICIONAIS SOBRE MEMÓRIAS:
- Use as memórias naturalmente sem chamar atenção para elas ou mencionar que existem.
- Responda usando markdown quando apropriado.
- NUNCA use [SAVE_MEMORY] na resposta. O sistema cuida disso automaticamente.
- NUNCA pergunte ao usuário se ele quer salvar memórias novas.
- NUNCA mencione "memórias" ou sugira guardar dados.

ATUALIZAÇÃO DE MEMÓRIA (OBRIGATÓRIO quando detectar mudança):
- Quando o usuário disser algo que CONTRADIZ, ATUALIZA ou MUDA uma memória existente, você DEVE incluir uma tag no FINAL da sua resposta.
- Formato EXATO: [UPDATE_MEMORY: OLD: texto exato da memória antiga ||| NEW: texto atualizado completo]
- O campo OLD DEVE ser CÓPIA EXATA do texto da memória listada no contexto (copie caractere por caractere).
- O campo NEW deve preservar contexto e incluir o nome do usuário.
- A tag NÃO aparece para o usuário — ela gera um botão de "Revisar atualização" automaticamente.
- NÃO mencione a tag, o botão ou o processo de atualização no texto da conversa.

EXEMPLOS de quando usar UPDATE_MEMORY:
- Memória: "Eu moro em São Paulo" → Usuário diz "me mudei pro Rio" → [UPDATE_MEMORY: OLD: Eu moro em São Paulo ||| NEW: Eu me mudei de São Paulo para o Rio de Janeiro]
- Memória: "Eu gosto de café" → Usuário diz "parei de tomar café" → [UPDATE_MEMORY: OLD: Eu gosto de café ||| NEW: Eu gostava de café mas parei de tomar]
- Memória: "Eu trabalho como designer" → Usuário diz "agora sou dev" → [UPDATE_MEMORY: OLD: Eu trabalho como designer ||| NEW: Eu trabalhava como designer e agora trabalho como dev]

IMPORTANTE: Mesmo mudanças sutis contam. Se o usuário corrige, complementa ou contradiz QUALQUER memória, use a tag.

CAPACIDADES:
- Você pode ver e analisar imagens enviadas pelo usuário.
- Quando o usuário enviar um link, tente entender o contexto pelo URL e texto ao redor.
- Você tem acesso a pesquisa web automática. Quando necessário, resultados de busca serão fornecidos para enriquecer suas respostas com informações atualizadas.`;

    if (userNickname) {
      systemPrompt += `\n\nO usuário pediu para ser chamado de "${userNickname}". Use esse apelido nas suas respostas.`;
    }

    if (memories && memories.length > 0) {
      systemPrompt += `\n\n📝 Contexto ATUAL do usuário (use naturalmente, NÃO mencione que são "memórias"):\n${memories.map((m: string, i: number) => `- ${m}`).join("\n")}`;
      systemPrompt += `\n\nIMPORTANTE: Considere APENAS os itens listados acima como verdades sobre o usuário. Se algo mencionado em mensagens anteriores da conversa contradiz ou não está presente na lista acima, IGNORE — pode ter sido removido ou atualizado pelo usuário. Nunca assuma que algo ainda é verdade só porque foi dito antes na conversa.`;
    } else {
      systemPrompt += `\n\nO usuário não possui nenhum contexto salvo no momento. NÃO assuma nenhuma informação pessoal sobre o usuário baseado em conversas anteriores. Se ele perguntar o que você sabe sobre ele, diga que não tem nenhuma informação guardada ainda.`;
    }

    // Append search results to system prompt
    if (searchContext) {
      systemPrompt += searchContext;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
