export const config = {
  runtime: 'edge', // A configuração de runtime fica AQUI, não no vercel.json
};

export default async function handler(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey',
  };

  // 1. Resposta para o pre-flight do CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "Chave GROQ_API_KEY ausente" }), { 
        status: 500, headers: corsHeaders 
      });
    }

    // 2. Parser do corpo da requisição
    const body = await req.json();
    const { messages, memories, userNickname } = body;

    // 3. Prompt Meowks (Firme e Direta)
    let systemPrompt = `Você é Meowks. Responda em PT-BR. Hoje: ${new Date().toLocaleDateString("pt-BR")}.\n`;
    systemPrompt += `REGRA: Seja firme, direta e SEM bajulação. O usuário odeia elogios.\n`;
    if (userNickname) systemPrompt += `\nUsuário: ${userNickname}.`;
    if (memories?.length) systemPrompt += `\n\nMEMÓRIAS:\n${memories.join("\n")}`;

    // 4. Chamada direta ao Groq (Usando Fetch nativo do Edge)
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    // 5. Repasse do Stream (O Edge Runtime faz o pipe automático)
    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
