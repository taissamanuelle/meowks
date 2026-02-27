import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Searching for:", query);

    // Use DuckDuckGo HTML lite - free, no API key needed
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    const html = await response.text();

    // Parse results from DuckDuckGo HTML lite
    const results: { title: string; snippet: string; url: string }[] = [];
    
    // Match result blocks
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
      const url = match[1]?.replace(/.*uddg=([^&]*).*/, "$1");
      const decodedUrl = url ? decodeURIComponent(url) : "";
      const title = match[2]?.replace(/<[^>]*>/g, "").trim() || "";
      const snippet = match[3]?.replace(/<[^>]*>/g, "").trim() || "";
      
      if (title && snippet) {
        results.push({ title, url: decodedUrl, snippet });
      }
    }

    // Fallback: simpler regex if the above didn't match
    if (results.length === 0) {
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      const titleRegex = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;
      
      const titles: string[] = [];
      const snippets: string[] = [];
      
      while ((match = titleRegex.exec(html)) !== null) {
        titles.push(match[1]?.replace(/<[^>]*>/g, "").trim() || "");
      }
      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(match[1]?.replace(/<[^>]*>/g, "").trim() || "");
      }
      
      for (let i = 0; i < Math.min(titles.length, snippets.length, 5); i++) {
        if (titles[i] && snippets[i]) {
          results.push({ title: titles[i], url: "", snippet: snippets[i] });
        }
      }
    }

    console.log(`Found ${results.length} results`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Search error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Search failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
