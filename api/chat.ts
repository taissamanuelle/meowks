import type { VercelRequest, VercelResponse } from "@vercel/node";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:streamGenerateContent?alt=sse";
const GEMINI_CLASSIFY_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

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

function convertToGeminiMessages(
  systemPrompt: string,
  messages: any[]
): { systemInstruction: { parts: { text: string }[] }; contents: any[] } {
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

async function decideSearch(
  messages: any[],
  apiKey: string,
  todayStr: string
): Promise<string | null> {
  try {
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (!lastUserMsg) return null;

    const content =
      typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : lastUserMsg.content?.find?.((c: any) => c.type === "text")?.text || "";

    if (content.length < 5) return null;

    const classifyPrompt = `Você é um classificador. Analise a última mensagem do usuário e decida se uma pesquisa na web seria útil para dar uma resposta melhor.
DATA DE HOJE: ${todayStr}

Responda APENAS com um JSON no formato: {"search": true, "query": "termo de busca otimizado"} ou {"search": false}

REGRA PRINCIPAL: Na DÚVIDA, PESQUISE. É melhor pesquisar desnecessariamente do que deixar de pesquisar quando seria útil.

OTIMIZAÇÃO DE BUSCA:
- SEMPRE inclua o ANO ATUAL nas queries sobre produtos, preços, recomendações ou qualquer coisa que mude com o tempo.
- Quando o usuário pedir recomendações de produtos, busque com termos específicos que retornem links DIRETOS para lojas ou produtos
- Para produtos, inclua "comprar", "site oficial", "loja" ou nome de lojas conhecidas na query
- Para links específicos, busque pelo nome exato + "site oficial" ou "link direto"
- NUNCA retorne links de resultados do Google.
- Para preços e catálogos, adicione "disponível" à query.

SEMPRE pesquise quando:
- O usuário pergunta sobre QUALQUER coisa factual
- Pergunta "o que é", "como funciona", "quem é", "quando", "onde"
- Menciona nomes próprios, marcas, tecnologias, ferramentas
- Pergunta sobre notícias, eventos, tendências
- Pede recomendações de qualquer tipo
- Pergunta algo que PODE ter mudança ao longo do tempo
- Faz qualquer pergunta informacional
- Pergunta sobre programação, frameworks, bibliotecas, APIs

NÃO pesquise APENAS quando:
- É conversa puramente casual (oi, tudo bem, obrigado)
- É desabafo emocional ou pedido de conselho pessoal
- O usuário está falando sobre si mesmo
- É uma pergunta diretamente sobre o chat ou a IA`;

    const resp = await fetch(`${GEMINI_CLASSIFY_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: classifyPrompt }] },
        contents: [{ role: "user", parts: [{ text: content }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0 },
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

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

// ── Supabase auth helper (verify JWT via Supabase) ──────────────

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

// ── System prompt builder (ported from edge function) ───────────

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

  if (searchContext) systemPrompt += searchContext;

  if (achievements && achievements.length > 0) {
    const achievementsList = achievements
      .map((a: { title: string; year: number }) => `- ${a.title} (${a.year})`)
      .join("\n");
    systemPrompt += `\n\n🏆 CONQUISTAS do usuário (marcos importantes da vida dele — use naturalmente quando relevante):\n${achievementsList}`;
  }

  if (youtubeContext) systemPrompt += youtubeContext;

  return systemPrompt;
}

// ── Main handler ────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

    // Auth
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || "";

    if (token && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const user = await verifySupabaseToken(token, SUPABASE_URL, SUPABASE_ANON_KEY);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL || "taissamanuellefj@gmail.com";
      if (user.email !== ALLOWED_EMAIL) return res.status(403).json({ error: "Forbidden" });
    }

    const { messages, memories, achievements, conversationId, userNickname, agentId } = req.body;

    const today = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Parallel fetches
    const agentPromise = agentId && SUPABASE_URL
      ? fetchAgent(agentId, SUPABASE_URL, SUPABASE_ANON_KEY, token)
      : Promise.resolve(null);

    const docsPromise = agentId && SUPABASE_URL
      ? fetchAgentDocs(agentId, SUPABASE_URL, SUPABASE_ANON_KEY, token)
      : Promise.resolve([]);

    const searchPromise = decideSearch(messages, GOOGLE_API_KEY, today);

    const youtubeUrl = extractYouTubeUrl(messages);
    const youtubePromise = youtubeUrl && SUPABASE_URL
      ? fetchYouTubeTranscript(youtubeUrl, SUPABASE_URL, SUPABASE_ANON_KEY)
      : Promise.resolve(null);

    const [agentData, agentDocs, searchQuery, youtubeData] = await Promise.all([
      agentPromise,
      docsPromise,
      searchPromise,
      youtubePromise,
    ]);

    let searchContext = "";
    if (searchQuery && SUPABASE_URL) {
      const results = await searchWeb(searchQuery, SUPABASE_URL, SUPABASE_ANON_KEY);
      if (results) {
        searchContext = `\n\n🔍 RESULTADOS DE PESQUISA WEB para "${searchQuery}" (pesquisados em ${today}):\n${results}\n\nUse essas informações para enriquecer sua resposta. REGRAS OBRIGATÓRIAS:\n- Cite as fontes com links clicáveis em Markdown [texto](url).\n- SEMPRE inclua links diretos para as páginas dos produtos/sites oficiais (NUNCA links de busca do Google).\n- APENAS recomende produtos/serviços que apareçam nos resultados de busca atuais. Se um produto não aparece nos resultados, NÃO invente o link.\n- NÃO invente URLs. Use APENAS URLs que vieram dos resultados de pesquisa.\n- Se os resultados não contêm links diretos para compra, informe ao usuário que os links encontrados podem não estar atualizados e sugira pesquisar diretamente na loja.\n- Prefira resultados de lojas conhecidas (Amazon, Mercado Livre, Magazine Luiza, Kabum, etc.) por terem catálogos mais atualizados.`;
      }
    }

    let youtubeContext = "";
    if (youtubeData) {
      const durationMin = Math.ceil(youtubeData.durationSeconds / 60);
      youtubeContext = `\n\n🎬 TRANSCRIÇÃO DO VÍDEO DO YOUTUBE "${youtubeData.title}" (${durationMin} min):\n${youtubeData.plainText}\n\nVocê tem acesso à transcrição completa deste vídeo. O usuário pode pedir para resumir, transcrever, analisar, responder perguntas sobre o conteúdo, etc. Adapte sua resposta ao que o usuário pediu. Se ele só colou o link sem pedir nada específico, faça um resumo do vídeo. Se pediu transcrição, forneça o texto. Se pediu resumo, resuma os pontos principais.`;
    }

    const systemPrompt = buildSystemPrompt({
      agentData,
      agentDocs,
      today,
      userNickname,
      memories,
      achievements,
      searchContext,
      youtubeContext,
    });

    const geminiBody = convertToGeminiMessages(systemPrompt, messages);

    const response = await fetch(`${GEMINI_API_URL}&key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...geminiBody,
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: "Rate limit exceeded" });
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      if (response.status === 404) return res.status(500).json({ error: "Modelo Gemini não encontrado. Verifique o endpoint e o nome do modelo." });
      if (response.status === 401 || response.status === 403) return res.status(500).json({ error: "Falha na autenticação com a API Gemini. Verifique sua API key." });
      return res.status(500).json({ error: `AI error: ${response.status}` });
    }

    // Stream SSE response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body as any;

    // Node.js readable stream from fetch response
    if (response.body && typeof (response.body as any)[Symbol.asyncIterator] === "function") {
      const decoder = new TextDecoder();
      let buf = "";

      for await (const chunk of response.body as any) {
        buf += decoder.decode(chunk, { stream: true });

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
              const openaiChunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
              res.write(`data: ${openaiChunk}\n\n`);
            }
          } catch {
            // partial JSON, skip
          }
        }
      }

      // Flush remaining
      if (buf.trim()) {
        for (let raw of buf.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const json = raw.slice(6).trim();
          try {
            const parsed = JSON.parse(json);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const openaiChunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
              res.write(`data: ${openaiChunk}\n\n`);
            }
          } catch { /* ignore */ }
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      // Fallback: read entire response
      const text = await response.text();
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (e: any) {
    console.error("chat error:", e);
    res.status(500).json({ error: e.message || "Unknown error" });
  }
}
