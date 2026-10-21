import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, RainbowKitAuthenticationProvider, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { wagmiConfig } from "./config/wagmi";
import { createAscendAuthAdapter } from "./config/authAdapter";
import { API_BASE_URL, BACKEND_CONNECTED } from "./config/env";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const rainbowKitTheme = lightTheme({
  accentColor: "#C6F135",
  accentColorForeground: "#1D2400",
  borderRadius: "medium",
  fontStack: "system",
});

function Root() {
  // Without a backend to verify against (local `vite dev`, no
  // VITE_API_BASE_URL set), skip SIWE entirely so the UI still works —
  // same BACKEND_CONNECTED convention every data-fetching page already uses.
  const [authStatus, setAuthStatus] = useState(BACKEND_CONNECTED ? "loading" : "authenticated");

  const authAdapter = useMemo(() => createAscendAuthAdapter({ setAuthStatus }), []);

  // On load, ask the backend whether we already have a valid session
  // cookie from a previous visit — avoids re-prompting a signature every
  // single page refresh.
  useEffect(() => {
    if (!BACKEND_CONNECTED) return;
    let cancelled = false;

    fetch(`${API_BASE_URL}/api/auth/session`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => {
        if (!cancelled) setAuthStatus(data.authenticated ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!cancelled) setAuthStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitAuthenticationProvider adapter={authAdapter} status={authStatus}>
        <RainbowKitProvider theme={rainbowKitTheme} locale="en-US">
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </RainbowKitProvider>
        </RainbowKitAuthenticationProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
