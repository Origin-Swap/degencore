import { createAuthenticationAdapter } from "@rainbow-me/rainbowkit";
import { createSiweMessage } from "viem/siwe";
import { API_BASE_URL } from "./env";

// Standalone helper — call this on app mount to restore an existing
// session without forcing a wallet signature.
export async function fetchAuthSession() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
      credentials: "include",
    });
    if (!res.ok) return { authenticated: false };
    const data = await res.json();
    return data;
  } catch {
    return { authenticated: false };
  }
}

export function createAscendAuthAdapter({ setAuthStatus }) {
  return createAuthenticationAdapter({
    getNonce: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/nonce`, {
          credentials: "include",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`[auth] getNonce failed: ${res.status} ${text}`);
          throw new Error(`Failed to fetch nonce (${res.status})`);
        }
        const data = await res.json();
        if (!data?.nonce) {
          console.error("[auth] getNonce: no nonce in response", data);
          throw new Error("No nonce in response");
        }
        return data.nonce;
      } catch (err) {
        console.error("[auth] getNonce threw:", err);
        throw err;
      }
    },

    createMessage: ({ nonce, address, chainId }) =>
      createSiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Ascend to verify you control this wallet.",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      }),

    getMessageBody: ({ message }) => message,

    verify: async ({ message, signature }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message, signature }),
        });
        const ok = res.ok;
        if (!ok) {
          const text = await res.text().catch(() => "");
          console.error(`[auth] verify failed: ${res.status} ${text}`);
        }
        setAuthStatus(ok ? "authenticated" : "unauthenticated");
        return ok;
      } catch (err) {
        console.error("[auth] verify threw:", err);
        setAuthStatus("unauthenticated");
        return false;
      }
    },

    signOut: async () => {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setAuthStatus("unauthenticated");
    },
  });
}
