import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use gemini-1.5-flash — stable free tier, same quality
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

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

// Convert OpenAI-style messages to Gemini format
function convertToGeminiMessages(systemPrompt: string, messages: any[]): { systemInstruction: { parts: { text: string }[] }; contents: any[] } {
  const contents: any[] = [];

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";

    if (typeof msg.content === "string") {
      contents.push({ role, parts: [{ text: msg.content }] });
    } else if (Array.isArray(msg.content)) {
      const parts: any[] = [];
      for (const part of msg.content) {
        if (part.type === "text") {
          parts.push({ text: part.text });
        } else if (part.type === "image_url") {
          const url = part.image_url?.url || "";
          if (url.startsWith("data:")) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            }
          } else {
            parts.push({ text: `[Image: ${url}]` });
          }
        }
      }
      contents.push({ role, parts });
    }
  }

  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
  };
}

// Keyword-based search decision (no API call needed - saves rate limit)
function decideSearchLocal(messages: any[]): string | null {
  try {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (!lastUserMsg) return null;

    const content = (typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "").toLowerCase().trim();

    if (content.length < 5) return null;

    // Skip search for casual/personal messages
    const skipPatterns = [
      /^(oi|olá|hey|e aí|tudo bem|obrigad|valeu|ok|sim|não|tchau|até|boa noite|bom dia|boa tarde)/,
      /^(como você|quem é você|seu nome|me ajud)/,
      /^(to triste|to feliz|me sinto|desabaf)/,
    ];
    for (const p of skipPatterns) {
      if (p.test(content)) return null;
    }

    // Search triggers - factual/informational questions
    const searchTriggers = [
      /\b(o que é|o que são|quem é|quem foi|quando foi|onde fica|como funciona|como fazer)\b/,
      /\b(preço|custo|valor|comprar|loja|site oficial|quanto custa)\b/,
      /\b(melhor|melhores|recomend|indicaç|sugest)\b/,
      /\b(notícia|acontec|lançamento|novo|nova|atualização)\b/,
      /\b(tutorial|como instalar|como configurar|como usar)\b/,
      /\b(diferença entre|comparar|versus|vs)\b/,
      /\?([\s]|$)/,
      /\b(pesquis|busca|procur|google)\b/,
    ];

    for (const trigger of searchTriggers) {
      if (trigger.test(content)) {
        const query = content.length > 100 ? content.slice(0, 100) : content;
        console.log("Local search decision triggered for:", query);
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

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");

    const { messages, memories, achievements, conversationId, userNickname, agentId } = await req.json();

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
    
    // Run non-Gemini tasks in parallel
    const [agentResult, agentDocs, youtubeData] = await Promise.all([
      agentPromise,
      docsPromise,
      youtubeUrl ? fetchYouTubeTranscript(youtubeUrl, supabaseUrl, authHeader) : Promise.resolve(null),
    ]);
    agentData = agentResult;

    // Local keyword-based search decision (NO Gemini API call)
    const searchQuery = decideSearchLocal(messages);

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
- Você tem acesso a pesquisa web automática. Quando necessário, resultados de busca serão fornecidos para enriquecer suas respostas com informações atualizadas.
- Você pode transcrever e resumir vídeos do YouTube. Quando o usuário enviar um link do YouTube, a transcrição do vídeo será fornecida automaticamente. Você pode resumir, transcrever, analisar ou responder perguntas sobre o conteúdo do vídeo.`;
    }

    if (userNickname) {
      systemPrompt += `\n\nO usuário pediu para ser chamado de "${userNickname}". Use esse apelido nas suas respostas.`;
    }

    if (memories && memories.length > 0) {
      systemPrompt += `\n\n📝 MEMÓRIAS E PREFERÊNCIAS DO USUÁRIO (tratam como ORDENS — obedeça cada item SEM EXCEÇÃO):\n${memories.map((m: string) => `- ${m}`).join("\n")}`;
      systemPrompt += `\n\n⚠️ CADA ITEM ACIMA É UMA ORDEM DIRETA. Se um item diz "não faça X", você NUNCA faz X. Se diz "faça Y", você SEMPRE faz Y. Isso vale para estilo de escrita, formatação, tom, conteúdo — TUDO. Considere APENAS os itens listados acima como verdades sobre o usuário. Se algo mencionado em mensagens anteriores da conversa contradiz ou não está presente na lista acima, IGNORE.`;
    } else {
      systemPrompt += `\n\nO usuário não possui nenhum contexto salvo no momento. NÃO assuma nenhuma informação pessoal sobre o usuário baseado em conversas anteriores. Se ele perguntar o que você sabe sobre ele, diga que não tem nenhuma informação guardada ainda.`;
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

    // Build Gemini request
    const geminiBody = convertToGeminiMessages(systemPrompt, messages);
    const geminiPayload = JSON.stringify({
      ...geminiBody,
      generationConfig: {
        maxOutputTokens: 8192,
      },
    });
    const geminiUrl = `${GEMINI_API_URL}&key=${GOOGLE_API_KEY}`;

    // Retry ONLY for 429 rate limits — fail fast on other errors
    let response: Response | null = null;
    const retryDelays = [15000, 30000];
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: geminiPayload,
      });
      // Only retry on 429, fail immediately on any other error
      if (response.status !== 429) break;
      if (attempt < retryDelays.length) {
        await response.text();
        console.log(`Rate limited, retrying in ${retryDelays[attempt]}ms (attempt ${attempt + 1}/${retryDelays.length})`);
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
      }
    }

    if (!response || !response.ok) {
      if (response?.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response?.text() || "No response";
      console.error("Gemini API error:", response?.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.trim() === "" || line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) continue;

            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;

            try {
              const parsed = JSON.parse(json);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const openaiChunk = JSON.stringify({
                  choices: [{ delta: { content: text } }],
                });
                await writer.write(encoder.encode(`data: ${openaiChunk}\n\n`));
              }
            } catch {
              // partial JSON, skip
            }
          }
        }

        // Flush remaining buffer
        if (buf.trim()) {
          for (let raw of buf.split("\n")) {
            if (!raw || !raw.startsWith("data: ")) continue;
            const json = raw.slice(6).trim();
            try {
              const parsed = JSON.parse(json);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const openaiChunk = JSON.stringify({
                  choices: [{ delta: { content: text } }],
                });
                await writer.write(encoder.encode(`data: ${openaiChunk}\n\n`));
              }
            } catch { /* ignore */ }
          }
        }

        await writer.write(encoder.encode("data: [DONE]\n\n"));
        await writer.close();
      } catch (e) {
        console.error("Stream transform error:", e);
        await writer.abort(e);
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
