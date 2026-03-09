import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

async function hashPassword(password: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + userId + "master_salt_v1");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
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
    
    const ALLOWED_EMAIL = Deno.env.get("ALLOWED_EMAIL") || "taissamanuellefj@gmail.com";
    if (userError || !authUser || authUser.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUser.id;
    const { password, action, device_fingerprint } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Status check
    if (action === "status") {
      const { data } = await adminClient
        .from("profiles")
        .select("master_password_hash")
        .eq("user_id", userId)
        .single();

      // Check if this device already has an active session
      let device_verified = false;
      if (device_fingerprint) {
        const { data: session } = await adminClient
          .from("user_sessions")
          .select("id")
          .eq("user_id", userId)
          .eq("device_fingerprint", device_fingerprint)
          .eq("is_active", true)
          .limit(1);
        device_verified = !!(session && session.length > 0);
      }

      return new Response(JSON.stringify({
        has_password: !!data?.master_password_hash,
        device_verified,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate password
    if (!password || password.length < 12) {
      return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 12 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting for verify
    if (action === "verify") {
      const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
      const { data: attempts } = await adminClient
        .from("pin_attempts")
        .select("id")
        .eq("user_id", userId)
        .gte("attempted_at", cutoff);

      if (attempts && attempts.length >= MAX_ATTEMPTS) {
        return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em 30 minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const hashed = await hashPassword(password, userId);

    if (action === "create") {
      // Check password strength
      if (password.length < 12) {
        return new Response(JSON.stringify({ error: "Senha muito curta. Mínimo 12 caracteres." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient
        .from("profiles")
        .update({ master_password_hash: hashed })
        .eq("user_id", userId);

      if (error) {
        return new Response(JSON.stringify({ error: "Falha ao salvar senha." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Register device session
      if (device_fingerprint) {
        await adminClient.from("user_sessions").insert({
          user_id: userId,
          device_fingerprint,
          user_agent: req.headers.get("user-agent") || "unknown",
          ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { data } = await adminClient
        .from("profiles")
        .select("master_password_hash")
        .eq("user_id", userId)
        .single();

      if (data?.master_password_hash === hashed) {
        // Clear failed attempts
        await adminClient.from("pin_attempts").delete().eq("user_id", userId);

        // Register device session
        if (device_fingerprint) {
          // Check if device already exists
          const { data: existing } = await adminClient
            .from("user_sessions")
            .select("id")
            .eq("user_id", userId)
            .eq("device_fingerprint", device_fingerprint)
            .limit(1);

          if (existing && existing.length > 0) {
            await adminClient
              .from("user_sessions")
              .update({ last_active_at: new Date().toISOString(), is_active: true })
              .eq("id", existing[0].id);
          } else {
            const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
            const ua = req.headers.get("user-agent") || "unknown";

            await adminClient.from("user_sessions").insert({
              user_id: userId,
              device_fingerprint,
              user_agent: ua,
              ip_address: ip,
            });

            // Geo-check for suspicious login
            try {
              const geoResp = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country`);
              if (geoResp.ok) {
                const geo = await geoResp.json();
                if (geo.status === "success") {
                  const isMG = geo.regionName === "Minas Gerais" && geo.country === "Brazil";
                  if (!isMG) {
                    // Store alert
                    await adminClient.from("login_alerts").insert({
                      user_id: userId,
                      ip_address: ip,
                      city: geo.city,
                      region: geo.regionName,
                      country: geo.country,
                      user_agent: ua,
                    });
                    console.warn(`SUSPICIOUS LOGIN from ${geo.city}, ${geo.regionName}, ${geo.country} - IP: ${ip}`);
                  }
                }
              }
            } catch (e) {
              console.error("Geo lookup failed:", e);
            }
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record failed attempt
      await adminClient.from("pin_attempts").insert({
        user_id: userId,
        attempted_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ error: "Senha incorreta." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-master-password error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
