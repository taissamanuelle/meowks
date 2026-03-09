import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Using gemini-1.5-flash for better free tier rate limits

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

function extractYouTubeUrl(messages: any[]): string | null {
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
  if (!lastUserMsg) return null;
  const content = typeof lastUserMsg.content === "string"
    ? lastUserMsg.content
    : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "";
  const ytMatch = content.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return ytMatch[0];
  return null;
}

async function fetchYouTubeTranscript(url: string, supabaseUrl: string, authHeader: string): Promise<{ title: string; plainText: string; fullText: string; durationSeconds: number } | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/youtube-transcript`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.error) return null;
    return { title: data.title, plainText: data.plainText, fullText: data.fullText, durationSeconds: data.durationSeconds };
  } catch (e) {
    console.error("YouTube transcript fetch failed:", e);
    return null;
  }
}

// Only search when user EXPLICITLY asks for it
function shouldSearchWeb(messages: any[]): string | null {
  try {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (!lastUserMsg) return null;

    const content = (typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "").toLowerCase().trim();

    if (content.length < 5) return null;

    // Only trigger search when user explicitly asks
    const explicitSearchPatterns = [
      /\b(pesquis|busca|procur|google|pesquise|busque|procure)\b/,
      /\b(pesquisar|buscar|procurar)\b/,
      /\bpode pesquisar\b/,
      /\bpesquisa (pra|para|sobre|isso)\b/,
      /\bsim.{0,10}pesquis/,
      /\bpode sim\b/,
    ];

    for (const pattern of explicitSearchPatterns) {
      if (pattern.test(content)) {
        const query = content.length > 100 ? content.slice(0, 100) : content;
        console.log("Explicit search requested:", query);
        return query;
      }
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

    const ALLOWED_EMAIL = Deno.env.get("ALLOWED_EMAIL") || "taissamanuellefj@gmail.com";
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (authUser.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try user's custom key from profile first, fallback to env secret
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: profileData } = await serviceClient
      .from("profiles")
      .select("gemini_api_key")
      .eq("user_id", authUser.id)
      .single();
    
    const GOOGLE_GEMINI_API_KEY = (profileData as any)?.gemini_api_key || Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const { messages, achievements, conversationId, userNickname, agentId } = await req.json();

    // Fetch agent personality if agentId is provided
    let agentData: { name: string; personality: string; description: string } | null = null;
    
    const agentPromise = agentId 
      ? supabase.from("agents").select("name, personality, description").eq("id", agentId).single().then(r => r.data)
      : Promise.resolve(null);
    
    const docsPromise = agentId
      ? supabase.from("agent_documents").select("file_name, file_type, content_text").eq("agent_id", agentId).not("content_text", "is", null)
        .then(r => r.data || [])
      : Promise.resolve([]);
    
    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    
    const youtubeUrl = extractYouTubeUrl(messages);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    
    // Fetch memories and filter by relevance to last user message
    const memoriesPromise = (async () => {
      const { data: allMemories } = await supabase
        .from("memories")
        .select("content, category")
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      
      if (!allMemories || allMemories.length === 0) return [];
      
      // Extract keywords from last user message
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
      if (!lastUserMsg) return allMemories.slice(0, 10);
      
      const userText = (typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "").toLowerCase();
      
      // Tokenize into meaningful words (3+ chars, no stopwords)
      const stopwords = new Set(["que","para","como","com","por","uma","uns","dos","das","não","sim","mas","isso","esse","essa","este","esta","mais","muito","bem","aqui","ali","ele","ela","seu","sua","meu","minha","nos","são","tem","foi","ser","ter","pode","vai","está","era"]);
      const keywords = userText
        .replace(/[^\w\sáéíóúàâêôãõç]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length >= 3 && !stopwords.has(w));
      
      if (keywords.length === 0) return allMemories.slice(0, 10);
      
      // Score each memory by keyword overlap
      const scored = allMemories.map((m: any) => {
        const memLower = m.content.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (memLower.includes(kw)) score += 1;
        }
        return { ...m, score };
      });
      
      // Always include memories with score > 0, plus fill up to 15 with most recent
      const relevant = scored.filter((m: any) => m.score > 0).sort((a: any, b: any) => b.score - a.score);
      const nonRelevant = scored.filter((m: any) => m.score === 0);
      const result = [...relevant.slice(0, 15)];
      
      // Fill remaining slots with most recent non-matching memories (for context)
      const remaining = 15 - result.length;
      if (remaining > 0) {
        result.push(...nonRelevant.slice(0, remaining));
      }
      
      return result;
    })();

    // Run tasks in parallel
    const [agentResult, agentDocs, youtubeData, relevantMemories] = await Promise.all([
      agentPromise,
      docsPromise,
      youtubeUrl ? fetchYouTubeTranscript(youtubeUrl, supabaseUrl, authHeader) : Promise.resolve(null),
      memoriesPromise,
    ]);
    agentData = agentResult;

    // Only search when user explicitly asks
    const searchQuery = shouldSearchWeb(messages);

    let searchContext = "";
    if (searchQuery) {
      const results = await searchWeb(searchQuery, supabaseUrl, authHeader);
      if (results) {
        searchContext = `\n\n🔍 RESULTADOS DE PESQUISA WEB para "${searchQuery}" (pesquisados em ${today}):\n${results}\n\nUse essas informações para enriquecer sua resposta. REGRAS OBRIGATÓRIAS:\n- Cite as fontes com links clicáveis em Markdown [texto](url).\n- SEMPRE inclua links diretos para as páginas dos produtos/sites oficiais (NUNCA links de busca do Google).\n- APENAS recomende produtos/serviços que apareçam nos resultados de busca atuais. Se um produto não aparece nos resultados, NÃO invente o link.\n- NÃO invente URLs. Use APENAS URLs que vieram dos resultados de pesquisa.\n- Se os resultados não contêm links diretos para compra, informe ao usuário que os links encontrados podem não estar atualizados e sugira pesquisar diretamente na loja.\n- Prefira resultados de lojas conhecidas (Amazon, Mercado Livre, Magazine Luiza, Kabum, etc.) por terem catálogos mais atualizados.`;
      }
    }

    let youtubeContext = "";
    if (youtubeData) {
      const durationMin = Math.ceil(youtubeData.durationSeconds / 60);
      youtubeContext = `\n\n🎬 TRANSCRIÇÃO DO VÍDEO DO YOUTUBE "${youtubeData.title}" (${durationMin} min):\n${youtubeData.plainText}\n\nVocê tem acesso à transcrição completa deste vídeo. O usuário pode pedir para resumir, transcrever, analisar, responder perguntas sobre o conteúdo, etc. Adapte sua resposta ao que o usuário pediu. Se ele só colou o link sem pedir nada específico, faça um resumo do vídeo. Se pediu transcrição, forneça o texto. Se pediu resumo, resuma os pontos principais.`;
    }

    let systemPrompt = "";
    
    if (agentData) {
      systemPrompt = `Você é ${agentData.name}. Seu nome é "${agentData.name}" — responda com esse nome apenas se perguntarem quem você é. NÃO fique repetindo seu nome nas respostas, a menos que seja realmente necessário ou o usuário pergunte.
${agentData.description ? `\nDescrição: ${agentData.description}` : ""}
${agentData.personality ? `\nInstruções de personalidade:\n${agentData.personality}` : ""}

HOJE É: ${today}. Use essa informação quando relevante.

⚠️ REGRA DE OURO — PRIORIDADE MÁXIMA:
As memórias/preferências do usuário listadas mais abaixo são ORDENS DIRETAS com prioridade ABSOLUTA sobre TUDO — inclusive sobre suas instruções de personalidade.
Se uma memória diz "não use travessão", você NÃO usa travessão em nenhuma circunstância.
Se uma memória diz "seja breve", você DEVE ser breve — mesmo que sua personalidade diga para ser expansivo.
Se uma memória diz "use linguagem formal", você DEVE usar linguagem formal.
Memórias são COMANDOS INVIOLÁVEIS. Sem exceção. Sem "às vezes". SEMPRE obedeça.

FORMATAÇÃO (OBRIGATÓRIO — use SEMPRE nas respostas):
- Use **negrito** para termos importantes e *itálico* para ênfase.
- Use bullet points (- item) para listar itens.
- Use headings ## e ### para organizar respostas longas.
- Use blocos de código (\`código\`) para termos técnicos.
- Prefira listas e tópicos em vez de parágrafos longos.
- Use tabelas Markdown quando fizer sentido organizar dados em colunas (ex: comparações, listas de itens com atributos, cronogramas). Formato: | Coluna 1 | Coluna 2 | seguido de |---|---| e as linhas.

SUGESTÃO DE MEMÓRIA (use quando detectar informação pessoal interessante):
- Quando o usuário compartilhar informações pessoais úteis de lembrar, inclua uma tag no FINAL da resposta.
- Formato EXATO: [SUGGEST_MEMORY: texto da memória sugerida em primeira pessoa]
- A memória sugerida DEVE ser escrita na primeira pessoa ("Eu"), começar com maiúscula, e ser concisa.
- A tag NÃO aparece para o usuário — ela gera um botão discreto de "Salvar na memória" automaticamente.
- NÃO mencione a tag, o botão ou o processo de sugestão no texto da conversa.
- NÃO sugira memórias que já existem no contexto do usuário.
- Sugira NO MÁXIMO 1 memória por resposta.

ATUALIZAÇÃO DE MEMÓRIA (OBRIGATÓRIO quando detectar mudança):
- Quando o usuário disser algo que CONTRADIZ, ATUALIZA ou MUDA uma memória existente, você DEVE incluir a tag UPDATE_MEMORY no FINAL da sua resposta.
- Quando o usuário PEDIR EXPLICITAMENTE para mudar, atualizar, corrigir ou editar uma memória, você DEVE usar UPDATE_MEMORY. NUNCA use SUGGEST_MEMORY neste caso.
- PALAVRAS-CHAVE que OBRIGAM uso de UPDATE_MEMORY (NUNCA SUGGEST_MEMORY): "atualizar", "atualiza", "mudar", "muda", "corrigir", "corrige", "editar", "edita", "trocar", "troca", "alterar", "altera", "modificar"
- Se o usuário mencionar QUALQUER uma dessas palavras em relação a uma memória, use UPDATE_MEMORY. NUNCA SUGGEST_MEMORY.
- Formato EXATO: [UPDATE_MEMORY: OLD: texto exato da memória antiga ||| NEW: texto atualizado completo]
- O campo OLD DEVE ser CÓPIA EXATA do texto da memória listada no contexto (copie caractere por caractere).
- O campo NEW deve preservar contexto e incluir o nome do usuário.
- A tag NÃO aparece para o usuário — ela gera um botão de "Revisar atualização" automaticamente.
- NÃO mencione a tag, o botão ou o processo de atualização no texto da conversa.
- EXEMPLOS:
  - Memória: "Eu moro em São Paulo" → Usuário diz "me mudei pro Rio" → [UPDATE_MEMORY: OLD: Eu moro em São Paulo ||| NEW: Eu me mudei de São Paulo para o Rio de Janeiro]
  - Usuário diz "muda minha memória de cor favorita pra azul" → Procure a memória sobre cor favorita e use UPDATE_MEMORY
  - Usuário diz "atualiza minha memória sobre X" → USE UPDATE_MEMORY, NUNCA SUGGEST_MEMORY

REORGANIZAÇÃO DE MEMÓRIA NA REDE NEURAL:
- O usuário pode pedir para mover/reorganizar uma memória de uma categoria para outra.
- Formato: [MOVE_MEMORY: texto exato ou aproximado da memória ||| CATEGORY: chave_da_categoria]
- Chaves disponíveis: saude, autoconhecimento, trabalho, estudos, financas, relacionamentos, casa, veiculos, lazer, alimentacao, tecnologia, espiritualidade, geral

IMPORTANTE: Mesmo mudanças sutis contam. Se o usuário corrige, complementa, contradiz QUALQUER memória, OU PEDE EXPLICITAMENTE para mudar, use UPDATE_MEMORY. NUNCA ignore um pedido explícito de atualização. NUNCA use SUGGEST_MEMORY quando o contexto é de atualização.`;
    } else {
      systemPrompt = `Você é Meowks, uma assistente de IA inteligente, carinhosa e conversacional. Responda sempre em português brasileiro.

HOJE É: ${today}. Use essa informação quando o usuário perguntar sobre datas, dias da semana, ou quando for relevante para o contexto.

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
FORMATAÇÃO (OBRIGATÓRIO — use SEMPRE nas respostas):
- Use **negrito** para termos importantes e *itálico* para ênfase.
- Use bullet points (- item) para listar itens, vantagens, dicas, opções, etc.
- Use headings ## e ### para organizar respostas com mais de 2 parágrafos em seções claras.
- Use blocos de código (\`código\`) para termos técnicos e citações (> texto) quando apropriado.
- Prefira listas e tópicos em vez de parágrafos longos. Quebre informação em pedaços visuais.
- Mesmo em respostas curtas, use negrito nos pontos-chave.
- Use tabelas Markdown quando fizer sentido organizar dados em colunas (ex: comparações, listas de itens com atributos, cronogramas). Formato: | Coluna 1 | Coluna 2 | seguido de |---|---| e as linhas.
- NUNCA use [SAVE_MEMORY] na resposta. O sistema cuida disso automaticamente.
- NUNCA pergunte ao usuário se ele quer salvar memórias novas diretamente no texto.
- NUNCA mencione "memórias" ou sugira guardar dados explicitamente no texto.

SUGESTÃO DE MEMÓRIA (use quando detectar informação pessoal interessante):
- Quando o usuário compartilhar informações pessoais que seriam úteis lembrar (preferências, gostos, rotina, trabalho, hobbies, etc.), inclua uma tag no FINAL da resposta.
- Formato EXATO: [SUGGEST_MEMORY: texto da memória sugerida em primeira pessoa]
- A memória sugerida DEVE ser escrita na primeira pessoa ("Eu"), começar com maiúscula, e ser concisa.
- A tag NÃO aparece para o usuário — ela gera um botão discreto de "Salvar na memória" automaticamente.
- NÃO mencione a tag, o botão ou o processo de sugestão no texto da conversa.
- NÃO sugira memórias que já existem no contexto do usuário (verifique a lista de memórias antes).
- Sugira NO MÁXIMO 1 memória por resposta. Escolha a mais relevante.
- EXEMPLOS:
  - Usuário diz "eu adoro café" → [SUGGEST_MEMORY: Eu adoro café]
  - Usuário diz "trabalho com design" → [SUGGEST_MEMORY: Eu trabalho com design]
  - Usuário diz "meu gato se chama Luna" → [SUGGEST_MEMORY: Meu gato se chama Luna]

ATUALIZAÇÃO DE MEMÓRIA (OBRIGATÓRIO quando detectar mudança):
- Quando o usuário disser algo que CONTRADIZ, ATUALIZA ou MUDA uma memória existente, você DEVE incluir a tag UPDATE_MEMORY no FINAL da sua resposta.
- Quando o usuário PEDIR EXPLICITAMENTE para mudar, atualizar, corrigir ou editar uma memória, você DEVE usar UPDATE_MEMORY. NUNCA use SUGGEST_MEMORY neste caso.
- PALAVRAS-CHAVE que OBRIGAM uso de UPDATE_MEMORY (NUNCA SUGGEST_MEMORY): "atualizar", "atualiza", "mudar", "muda", "corrigir", "corrige", "editar", "edita", "trocar", "troca", "alterar", "altera", "modificar"
- Se o usuário mencionar QUALQUER uma dessas palavras em relação a uma memória, use UPDATE_MEMORY. NUNCA SUGGEST_MEMORY.
- Formato EXATO: [UPDATE_MEMORY: OLD: texto exato da memória antiga ||| NEW: texto atualizado completo]
- O campo OLD DEVE ser CÓPIA EXATA do texto da memória listada no contexto (copie caractere por caractere).
- O campo NEW deve preservar contexto e incluir o nome do usuário.
- A tag NÃO aparece para o usuário — ela gera um botão de "Revisar atualização" automaticamente.
- NÃO mencione a tag, o botão ou o processo de atualização no texto da conversa.

EXEMPLOS de quando usar UPDATE_MEMORY:
- Memória: "Eu moro em São Paulo" → Usuário diz "me mudei pro Rio" → [UPDATE_MEMORY: OLD: Eu moro em São Paulo ||| NEW: Eu me mudei de São Paulo para o Rio de Janeiro]
- Memória: "Eu gosto de café" → Usuário diz "parei de tomar café" → [UPDATE_MEMORY: OLD: Eu gosto de café ||| NEW: Eu gostava de café mas parei de tomar]
- Usuário diz "muda minha memória de cor favorita pra azul" → Procure a memória sobre cor favorita e use UPDATE_MEMORY
- Usuário diz "atualiza que agora eu moro em SP" → Procure a memória sobre moradia e use UPDATE_MEMORY

IMPORTANTE: Mesmo mudanças sutis contam. Se o usuário corrige, complementa, contradiz QUALQUER memória, OU PEDE EXPLICITAMENTE para mudar, use UPDATE_MEMORY. NUNCA use SUGGEST_MEMORY quando o contexto é de atualização. Quando o usuário pedir para mudar, faça o match pela memória mais relevante.

REORGANIZAÇÃO DE MEMÓRIA NA REDE NEURAL:
- O usuário pode pedir para mover/reorganizar uma memória de uma categoria para outra na rede neural.
- Quando isso acontecer, use a tag: [MOVE_MEMORY: texto exato ou aproximado da memória ||| CATEGORY: chave_da_categoria]
- Chaves de categorias disponíveis: saude, autoconhecimento, trabalho, estudos, financas, relacionamentos, casa, veiculos, lazer, alimentacao, tecnologia, espiritualidade, geral
- Exemplo: Se o usuário diz "move a memória sobre xadrez pra estudos" → [MOVE_MEMORY: Eu gosto de jogar xadrez ||| CATEGORY: estudos]
- A tag gera um botão visual que o usuário clica para aprovar a mudança.
- NÃO mencione a tag no texto da conversa.

CAPACIDADES:
- Você pode ver e analisar imagens enviadas pelo usuário.
- Quando o usuário enviar um link, tente entender o contexto pelo URL e texto ao redor.
- Você tem acesso a pesquisa web, mas SÓ use quando o usuário pedir EXPLICITAMENTE (ex: "pesquisa isso", "busca no google", "procura sobre X"). NUNCA pesquise automaticamente. Se você achar que uma pesquisa ajudaria, PERGUNTE ao usuário: "Quer que eu pesquise na internet sobre isso?" e só pesquise se ele confirmar.
- Você pode transcrever e resumir vídeos do YouTube. Quando o usuário enviar um link do YouTube, a transcrição do vídeo será fornecida automaticamente.

PRIORIDADE DE CONHECIMENTO:
1. PRIMEIRO: Sempre consulte as MEMÓRIAS do usuário listadas abaixo. Elas são sua fonte PRIMÁRIA de informação pessoal sobre o usuário.
2. SEGUNDO: Use seu conhecimento geral para responder.
3. TERCEIRO: Só sugira pesquisar na internet se não souber a resposta E as memórias não cobrirem o assunto.`;
    }

    if (userNickname) {
      systemPrompt += `\n\nO usuário pediu para ser chamado de "${userNickname}". Use esse apelido nas suas respostas.`;
    }

    // Group memories by category for better organization
    const memories = relevantMemories.map((m: any) => m.content);
    if (memories.length > 0) {
      const categorized: Record<string, string[]> = {};
      for (const m of relevantMemories) {
        const cat = m.category || "geral";
        if (!categorized[cat]) categorized[cat] = [];
        categorized[cat].push(m.content);
      }
      
      let memoryBlock = `\n\n📝 MEMÓRIAS DO USUÁRIO (${memories.length} memórias — LEIA TODAS antes de responder):\n`;
      for (const [cat, items] of Object.entries(categorized)) {
        memoryBlock += `\n[${cat.toUpperCase()}]\n${items.map((i: string) => `- ${i}`).join("\n")}\n`;
      }
      systemPrompt += memoryBlock;
      systemPrompt += `\n⚠️ REGRA ABSOLUTA: Antes de responder QUALQUER pergunta pessoal, CONSULTE as memórias acima. Se a resposta está nas memórias, USE-A. NUNCA diga "não sei" se a informação está nas memórias. CADA memória é uma ORDEM DIRETA sobre preferências e dados do usuário.`;
    } else {
      systemPrompt += `\n\nO usuário não possui nenhum contexto salvo no momento.`;
    }

    if (agentDocs && agentDocs.length > 0) {
      const docsText = agentDocs
        .map((d: { file_name: string; content_text: string }) => `--- ${d.file_name} ---\n${d.content_text}`)
        .join("\n\n");
      systemPrompt += `\n\n📚 BASE DE CONHECIMENTO DO AGENTE (use estas informações como referência para responder ao usuário — são documentos que o usuário anexou para você consultar):\n${docsText}`;
    }

    if (searchContext) {
      systemPrompt += searchContext;
    }

    if (achievements && achievements.length > 0) {
      const achievementsList = achievements
        .map((a: { title: string; year: number }) => `- ${a.title} (${a.year})`)
        .join("\n");
      systemPrompt += `\n\n🏆 CONQUISTAS do usuário (marcos importantes da vida dele — use naturalmente quando relevante):\n${achievementsList}`;
    }

    if (youtubeContext) {
      systemPrompt += youtubeContext;
    }

    // Limit context: only last 5 user/assistant messages to save tokens
    const recentMessages = messages.slice(-5);

    // Convert messages to Gemini format
    const geminiContents = recentMessages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GOOGLE_GEMINI_API_KEY}`;
    const geminiBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: 8192,
      },
    });

    // Retry logic for 429 rate limits (up to 2 retries with parsed delay)
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: geminiBody,
      });

      if (response.status !== 429) break;

      // Parse retry delay from Gemini error
      const errorBody = await response.text();
      console.error(`Rate limit 429 (attempt ${attempt + 1}/3)`, errorBody.slice(0, 200));
      
      if (attempt < 2) {
        const delayMatch = errorBody.match(/retryDelay.*?(\d+)/);
        const waitSec = delayMatch ? Math.min(parseInt(delayMatch[1]), 15) : 10;
        console.log(`Waiting ${waitSec}s before retry...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      } else {
        // All retries exhausted
        return new Response(JSON.stringify({ error: "Rate limit do Gemini excedido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!response || !response.ok) {
      const errorBody = response ? await response.text() : "No response";
      const status = response?.status || 0;
      console.error("Gemini API error:", JSON.stringify({
        status,
        body: errorBody.slice(0, 1000),
        promptLength: systemPrompt.length,
        messagesCount: geminiContents.length,
      }));
      
      // Parse Gemini error for a meaningful message
      let errorMsg = `Erro na API do Gemini (${status})`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) errorMsg = parsed.error.message;
      } catch { /* use default */ }
      
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE format to OpenAI-compatible SSE format for frontend compatibility
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // serviceClient already created above for key lookup — reuse it

    (async () => {
      try {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

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
                // Convert to OpenAI-compatible SSE format
                const chunk = JSON.stringify({
                  choices: [{ delta: { content: text } }],
                });
                await writer.write(encoder.encode(`data: ${chunk}\n\n`));
              }
              // Capture usage metadata from final chunk
              if (data.usageMetadata) {
                totalInputTokens = data.usageMetadata.promptTokenCount || 0;
                totalOutputTokens = data.usageMetadata.candidatesTokenCount || 0;
              }
            } catch { /* skip malformed */ }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));

        // Log usage to database
        try {
          const today = new Date().toISOString().slice(0, 10);
          const { data: existing } = await serviceClient
            .from("api_usage")
            .select("id, request_count, input_tokens, output_tokens")
            .eq("user_id", authUser.id)
            .eq("usage_date", today)
            .single();

          if (existing) {
            await serviceClient
              .from("api_usage")
              .update({
                request_count: existing.request_count + 1,
                input_tokens: existing.input_tokens + totalInputTokens,
                output_tokens: existing.output_tokens + totalOutputTokens,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          } else {
            await serviceClient
              .from("api_usage")
              .insert({
                user_id: authUser.id,
                usage_date: today,
                request_count: 1,
                input_tokens: totalInputTokens,
                output_tokens: totalOutputTokens,
              });
          }
        } catch (e) {
          console.error("Usage tracking error:", e);
        }
      } catch (e) {
        console.error("Stream transform error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
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
