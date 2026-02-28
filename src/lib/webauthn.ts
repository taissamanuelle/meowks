import { supabase } from "@/integrations/supabase/client";

const WEBAUTHN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webauthn`;

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
}

async function callWebauthn(body: Record<string, unknown>) {
  const token = await getToken();
  const resp = await fetch(WEBAUTHN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return resp.json();
}

export function isWebAuthnSupported(): boolean {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

export async function checkBiometricStatus(): Promise<boolean> {
  const data = await callWebauthn({ action: "status" });
  return !!data.registered;
}

export async function registerBiometric(userId: string): Promise<boolean> {
  // Get challenge from server
  const { challenge } = await callWebauthn({ action: "challenge" });
  if (!challenge) return false;

  const challengeBuffer = Uint8Array.from(atob(challenge), c => c.charCodeAt(0));
  const userIdBuffer = new TextEncoder().encode(userId);

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challengeBuffer,
        rp: {
          name: "Meux",
          id: window.location.hostname,
        },
        user: {
          id: userIdBuffer,
          name: "user@meux.app",
          displayName: "Meux User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },   // ES256
          { alg: -257, type: "public-key" },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Use device biometric
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    }) as PublicKeyCredential;

    if (!credential) return false;

    // Store credential reference on server
    const credentialData = {
      id: credential.id,
      rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
      type: credential.type,
    };

    const result = await callWebauthn({ action: "register", credential: credentialData });
    return !!result.success;
  } catch (e) {
    console.error("WebAuthn registration failed:", e);
    return false;
  }
}

export async function verifyBiometric(): Promise<boolean> {
  // Get stored credential ID first
  const { challenge } = await callWebauthn({ action: "challenge" });
  if (!challenge) return false;

  const challengeBuffer = Uint8Array.from(atob(challenge), c => c.charCodeAt(0));

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challengeBuffer,
        rpId: window.location.hostname,
        userVerification: "required",
        timeout: 60000,
      },
    }) as PublicKeyCredential;

    if (!assertion) return false;

    const credentialData = {
      id: assertion.id,
      rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))),
      type: assertion.type,
    };

    const result = await callWebauthn({ action: "verify", credential: credentialData });
    return !!result.success;
  } catch (e) {
    console.error("WebAuthn verification failed:", e);
    return false;
  }
}
