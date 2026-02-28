import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a random challenge
function generateChallenge(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr));
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
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side email restriction
    const ALLOWED_EMAIL = Deno.env.get("ALLOWED_EMAIL") || "taissamanuellefj@gmail.com";
    if (authUser.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUser.id;
    const { action, credential } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user has biometric registered
    if (action === "status") {
      const { data } = await adminClient
        .from("profiles")
        .select("webauthn_credential")
        .eq("user_id", userId)
        .single();

      return new Response(JSON.stringify({ registered: !!data?.webauthn_credential }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate challenge for registration or verification
    if (action === "challenge") {
      const challenge = generateChallenge();
      return new Response(JSON.stringify({ challenge }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Register biometric credential
    if (action === "register") {
      if (!credential || !credential.id || !credential.rawId) {
        return new Response(JSON.stringify({ error: "Invalid credential" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store credential data in profile
      await adminClient
        .from("profiles")
        .update({ webauthn_credential: credential })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify biometric - create pin session
    if (action === "verify") {
      if (!credential || !credential.id) {
        return new Response(JSON.stringify({ error: "Invalid credential" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check stored credential matches
      const { data } = await adminClient
        .from("profiles")
        .select("webauthn_credential")
        .eq("user_id", userId)
        .single();

      if (!data?.webauthn_credential || data.webauthn_credential.id !== credential.id) {
        return new Response(JSON.stringify({ error: "Credential mismatch" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create pin session (same as PIN verify)
      await adminClient.from("pin_sessions").delete().eq("user_id", userId);
      await adminClient.from("pin_sessions").insert({
        user_id: userId,
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webauthn error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
