import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia, mainnet, sepolia } from "wagmi/chains";
import { botChainTestnet, botChain } from "./chains";

// Get a free WalletConnect Cloud project id at https://cloud.walletconnect.com
// and put it in .env as VITE_WALLETCONNECT_PROJECT_ID (see .env.example).
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "65e900325f6440b81073eb1b10270843";

export const wagmiConfig = getDefaultConfig({
  appName: "Ascend",
  projectId,
  chains: [sepolia],
  ssr: false,
});
