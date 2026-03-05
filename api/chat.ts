// @ts-ignore
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("Chave GROQ_API_KEY não encontrada no Vercel");

    const { messages } = req.body;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: "Seja direta e firme." }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) throw new Error(`Status: ${response.status}`);

    res.setHeader("Content-Type", "text/event-stream");
    const reader = response.body as any;
    const decoder = new TextDecoder();

    for await (const chunk of reader) {
      const text = decoder.decode(chunk);
      res.write(text); // Repassa o stream bruto do Groq (padrão OpenAI)
    }
    res.end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
