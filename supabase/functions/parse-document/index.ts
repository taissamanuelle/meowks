import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Use gemini-2.5-flash for better document understanding
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function getUserApiKeys(serviceClient: any, userId: string): Promise<string[]> {
  const { data } = await serviceClient.from("profiles").select("gemini_api_key").eq("user_id", userId).single();
  const raw = (data as any)?.gemini_api_key || "";
  return raw.split(/[,\n]/).map((k: string) => k.trim()).filter((k: string) => k.length > 10);
}

async function callGeminiWithKeys(apiKeys: string[], contents: any[], maxTokens = 65536): Promise<string> {
  for (const key of apiKeys) {
    try {
      const resp = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.1, // Low temperature for faithful extraction
          },
        }),
      });

      if (resp.status === 429) {
        console.warn("Key rate limited, trying next...");
        await resp.text();
        continue;
      }

      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const finishReason = data.candidates?.[0]?.finishReason;
        
        console.log(`Extraction result: ${text?.length || 0} chars, finishReason: ${finishReason}`);
        
        if (finishReason === "MAX_TOKENS" && text) {
          console.warn("Output was truncated due to token limit");
          return text + "\n\n[⚠️ Conteúdo truncado por limite de tokens]";
        }
        
        return text || "[Sem conteúdo extraído]";
      }

      const errText = await resp.text();
      console.error("Gemini error:", resp.status, errText);
    } catch (e) {
      console.error("Gemini fetch error:", e);
    }
  }
  return "[Erro: todas as API keys falharam]";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKeys = await getUserApiKeys(serviceClient, user.id);

    if (apiKeys.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma API Key configurada. Vá em Configurações e adicione suas keys do Gemini." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filePath, fileType, agentId } = await req.json();

    if (!filePath || !fileType || !agentId) {
      return new Response(JSON.stringify({ error: "Missing filePath, fileType, or agentId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine correct bucket based on context
    const isChat = agentId === "chat";
    const bucket = isChat ? "chat-images" : "agent-documents";
    console.log(`Processing ${fileType} from bucket "${bucket}", path: ${filePath}`);

    let contentText = "";
    const isImage = ["png", "jpeg", "jpg"].includes(fileType.toLowerCase());

    const PDF_EXTRACTION_PROMPT = `Você é um extrator de documentos de alta precisão. Sua tarefa é extrair FIELMENTE todo o conteúdo textual deste documento.

REGRAS OBRIGATÓRIAS:
1. Transcreva TODO o texto exatamente como aparece — não resuma, não parafraseie, não omita nada
2. Preserve a estrutura: títulos, subtítulos, parágrafos, listas numeradas/com marcadores
3. Tabelas: transcreva em formato markdown com | separadores
4. Números, datas, valores monetários: copie EXATAMENTE como aparecem, sem arredondar ou modificar
5. Se houver gráficos ou imagens com texto, descreva-os detalhadamente
6. NÃO adicione interpretações, comentários ou análises — apenas extraia o conteúdo
7. Se alguma parte estiver ilegível, indique com [ilegível] em vez de inventar

Comece a extração agora:`;

    if (isImage) {
      const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        const imgResp = await fetch(signedData.signedUrl);
        const imgBlob = await imgResp.blob();
        const arrayBuf = await imgBlob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const base64 = btoa(binary);
        const mimeType = fileType.toLowerCase() === "png" ? "image/png" : "image/jpeg";

        contentText = await callGeminiWithKeys(apiKeys, [{
          parts: [
            { text: "Descreva detalhadamente todo o conteúdo desta imagem. Se houver texto, transcreva-o completamente e fielmente. Se houver tabelas, transcreva-as em formato markdown. Se houver gráficos ou diagramas, descreva-os com todos os valores visíveis. NÃO invente dados." },
            { inlineData: { mimeType, data: base64 } },
          ],
        }]);
      }
    } else if (fileType.toLowerCase() === "csv") {
      const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(filePath);

      if (downloadError || !fileData) {
        contentText = "[Erro ao ler arquivo CSV]";
        console.error("CSV download error:", downloadError);
      } else {
        const text = await fileData.text();
        contentText = text.length > 50000 ? text.substring(0, 50000) + "\n\n[...conteúdo truncado]" : text;
      }
    } else if (fileType.toLowerCase() === "pdf" || fileType.toLowerCase() === "docx") {
      const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        const fileResp = await fetch(signedData.signedUrl);
        const fileBlob = await fileResp.blob();
        const arrayBuf = await fileBlob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuf);
        
        console.log(`File size: ${uint8.length} bytes`);
        
        let binary = "";
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const base64 = btoa(binary);
        const mimeType = fileType.toLowerCase() === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        contentText = await callGeminiWithKeys(apiKeys, [{
          parts: [
            { text: PDF_EXTRACTION_PROMPT },
            { inlineData: { mimeType, data: base64 } },
          ],
        }]);
      } else {
        contentText = "[Erro: não foi possível gerar URL para o arquivo]";
        console.error("Failed to create signed URL for", filePath, "in bucket", bucket);
      }
    } else {
      contentText = "[Formato não suportado]";
    }

    console.log(`Extracted content length: ${contentText.length} chars`);

    // Store content for agent documents
    if (agentId && agentId !== "chat") {
      await serviceClient
        .from("agent_documents")
        .update({ content_text: contentText })
        .eq("file_path", filePath)
        .eq("agent_id", agentId);
    }

    // Return full content for chat, truncated preview for agents (full is in DB)
    return new Response(JSON.stringify({ 
      success: true, 
      contentText: isChat ? contentText : contentText.substring(0, 200) + "...",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});