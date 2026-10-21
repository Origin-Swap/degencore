import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Trophy } from "lucide-react";
import { getLeaderboardRankFor } from "../../data/mockData";

export default function YourRankCard() {
  const { address, isConnected } = useAccount();
  const entry = isConnected ? getLeaderboardRankFor(address) : null;

  return (
    <div className="rounded-xl2 bg-ink text-canvas p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors">
      <div className="w-11 h-11 rounded-xl bg-canvas/10 flex items-center justify-center shrink-0">
        <Trophy size={20} className="text-lime" />
      </div>

      {!isConnected ? (
        <>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold">Connect wallet to see your rank</p>
            <p className="text-sm text-canvas/60 mt-0.5">
              Every buy or sell earns a point, on any token — this is what future platform-token rewards will be based on.
            </p>
          </div>
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                className="rounded-xl bg-lime hover:bg-lime-dark text-lime-ink font-semibold px-4 py-2.5 shrink-0 transition-colors"
              >
                Connect wallet
              </button>
            )}
          </ConnectButton.Custom>
        </>
      ) : entry ? (
        <div className="flex-1 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-canvas/60">Your rank</p>
            <p className="font-display text-2xl font-semibold">#{entry.rank.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-canvas/60">Points</p>
            <p className="font-mono text-2xl font-semibold tabular">{entry.points.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-canvas/60">Trades</p>
            <p className="font-mono text-2xl font-semibold tabular">{entry.tradeCount.toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold">Not ranked yet</p>
          <p className="text-sm text-canvas/60 mt-0.5">
            Make your first buy or sell on any token to start earning points.
          </p>
        </div>
      )}
    </div>
  );
}
