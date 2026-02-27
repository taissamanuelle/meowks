import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEAK_PINS = [
  "000000", "111111", "222222", "333333", "444444",
  "555555", "666666", "777777", "888888", "999999",
  "123456", "654321", "112233", "001122", "121212",
  "123123", "111222", "789456", "456789", "159753",
];

const SEQUENTIAL_PATTERNS = /012345|123456|234567|345678|456789|987654|876543|765432|654321|543210/;

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function hashPin(pin: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + userId);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
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

    const userId = claimsData.claims.sub as string;
    const { pin, action } = await req.json();

    // Use service role for all DB operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Status check - returns whether user has a PIN set (no hash exposed)
    if (action === "status") {
      const { data } = await adminClient
        .from("profiles")
        .select("pin_hash")
        .eq("user_id", userId)
        .single();

      return new Response(JSON.stringify({ has_pin: !!data?.pin_hash }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PIN format
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "Invalid PIN format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check weak PINs (for create action)
    if (action === "create") {
      if (WEAK_PINS.includes(pin) || SEQUENTIAL_PATTERNS.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN muito fraco. Escolha um PIN mais seguro." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Rate limiting for verify action
    if (action === "verify") {
      const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
      
      // Count recent attempts
      const { data: attempts } = await adminClient
        .from("pin_attempts")
        .select("id")
        .eq("user_id", userId)
        .gte("attempted_at", cutoff);

      if (attempts && attempts.length >= MAX_ATTEMPTS) {
        return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const hashed = await hashPin(pin, userId);

    // Helper to create a pin session
    async function createPinSession(uid: string) {
      await adminClient.from("pin_sessions").delete().eq("user_id", uid);
      const { error } = await adminClient.from("pin_sessions").insert({
        user_id: uid,
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      return error;
    }

    if (action === "create") {
      const { error } = await adminClient
        .from("profiles")
        .update({ pin_hash: hashed })
        .eq("user_id", userId);

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to save PIN" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await createPinSession(userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { data } = await adminClient
        .from("profiles")
        .select("pin_hash")
        .eq("user_id", userId)
        .single();

      if (data?.pin_hash === hashed) {
        // Clear failed attempts on success
        await adminClient.from("pin_attempts").delete().eq("user_id", userId);
        await createPinSession(userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record failed attempt
      await adminClient.from("pin_attempts").insert({
        user_id: userId,
        attempted_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ error: "Incorrect PIN" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-pin error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
