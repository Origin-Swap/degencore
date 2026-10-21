import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useSignMessage,
  useChainId,
} from "wagmi";
import { parseUnits, parseEther, decodeEventLog } from "viem";
import { ImagePlus, ChevronDown } from "lucide-react";
import { LAUNCHPAD_FACTORY_ABI, LAUNCHPAD_FACTORY_ADDRESS, PAIR_TOKEN_ADDRESSES } from "../config/contracts";
import { BACKEND_CONNECTED } from "../config/env";
import { uploadImage, updateTokenMetadata } from "../data/api";
import { PAIR_TOKENS } from "../data/mockData";

// Mirrors the constant-product derivation in BondingCurve.sol's constructor:
// graduationThreshold = virtualPairReserve * tokensForSale / (virtualTokenReserve - tokensForSale)
const VIRTUAL_TOKEN_RESERVE = 1_073_000_000;
const TOKENS_FOR_SALE = 800_000_000;
function computeGraduationThreshold(virtualPairReserve) {
  const denom = VIRTUAL_TOKEN_RESERVE - TOKENS_FOR_SALE;
  return (virtualPairReserve * TOKENS_FOR_SALE) / denom;
}

const LAUNCH_FEE = 0.0005;
const TRADE_FEE_PCT = 1;
const DEFAULT_VIRTUAL_PAIR_RESERVE = 1.433; // tuned so graduation lands ~4.2 ETH by default

// BondingCurve.sol no longer takes a rewardMode choice at launch. The 0.5%
// reward cut on every trade is now always split via CREATOR_FEE_BPS /
// CASHBACK_FEE_BPS: half goes straight to the creator (claimCreatorFees())
// and half accrues per-trader as cashback (claimCashback()). There's nothing
// left to configure or pass on-chain, so this is just a display label.
const REWARD_SPLIT_LABEL = "50% creator fee / 50% trader cashback";

// Just enough of LaunchpadFactory's ABI to decode the Launched event out of
// the tx receipt below — the full LAUNCHPAD_FACTORY_ABI in config/contracts
// only carries functions, not events.
const LAUNCHED_EVENT_ABI = [
  {
    type: "event",
    name: "Launched",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "curve", type: "address", indexed: true },
      { name: "pairToken", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "virtualPairReserve", type: "uint256", indexed: false },
      { name: "graduationThreshold", type: "uint256", indexed: false },
      { name: "antiSnipeEnabled", type: "bool", indexed: false },
    ],
  },
];

export default function LaunchPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();

  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [xUrl, setXUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [pairSymbol, setPairSymbol] = useState("ETH");
  const [devBuy, setDevBuy] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [virtualPairReserve, setVirtualPairReserve] = useState(String(DEFAULT_VIRTUAL_PAIR_RESERVE));
  const [metadataSyncError, setMetadataSyncError] = useState(null);

  // Guards the metadata-sync effect below so it fires exactly once per
  // successful launch tx, even if the effect re-runs for unrelated reasons.
  const syncedHashRef = useRef(null);

  const selectedPair = useMemo(
    () => PAIR_TOKENS.find((p) => p.symbol === pairSymbol),
    [pairSymbol]
  );
  // PAIR_TOKENS (mockData.js) only supplies the symbol/label/decimals shown in
  // the dropdown; the actual on-chain address comes from contracts.js's
  // PAIR_TOKEN_ADDRESSES, keyed by symbol then chainId. For "ETH" this MUST
  // resolve to the chain's real WETH address (the same one BondingCurve's
  // isNativePair check compares against router.WETH()) — never address(0)
  // and never the native "0xEeee...EEeE" placeholder some UIs use.
  const pairTokenAddress = PAIR_TOKEN_ADDRESSES[pairSymbol]?.[chainId];

  const graduationThreshold = useMemo(() => {
    const v = Number(virtualPairReserve) || DEFAULT_VIRTUAL_PAIR_RESERVE;
    return computeGraduationThreshold(v);
  }, [virtualPairReserve]);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash });

  function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function submit(e) {
    e.preventDefault();

    // Get factory address for current chain
    const factoryAddress = LAUNCHPAD_FACTORY_ADDRESS[chainId];

    // Debug logging
    console.log("Chain ID:", chainId);
    console.log("Factory Address:", factoryAddress);
    console.log("Pair Token Address:", pairTokenAddress);
    console.log("Name:", name);
    console.log("Ticker:", ticker);
    console.log("Virtual Pair Reserve:", virtualPairReserve);
    console.log("Is Connected:", isConnected);
    console.log("User Address:", address);

    // Validate all required fields
    if (!chainId) {
      console.error("No chain ID detected. Please connect your wallet.");
      return;
    }

    if (!factoryAddress) {
      console.error(`No factory address configured for chain ${chainId}`);
      return;
    }

    if (!name || !name.trim()) {
      console.error("Token name is required");
      return;
    }

    if (!ticker || !ticker.trim()) {
      console.error("Token ticker is required");
      return;
    }

    if (!pairTokenAddress) {
      console.error(`No pair token address for ${pairSymbol} on chain ${chainId}`);
      return;
    }

    // Prepare launch parameters
    const launchArgs = [
      name.trim(),
      ticker.trim().toUpperCase(),
      pairTokenAddress,
      parseUnits(virtualPairReserve || String(DEFAULT_VIRTUAL_PAIR_RESERVE), 18),
    ];

    const launchValue = parseEther(String(LAUNCH_FEE));

    console.log("Launch parameters:", {
      address: factoryAddress,
      functionName: "launch",
      args: launchArgs,
      value: launchValue.toString(),
    });

    try {
      writeContract({
        address: factoryAddress,
        abi: LAUNCHPAD_FACTORY_ABI,
        functionName: "launch",
        args: launchArgs,
        value: launchValue,
      });
    } catch (err) {
      console.error("[launch] writeContract error:", err);
      // Error will be handled by the useEffect below
    }
  }

  const canSubmit = name.trim() && ticker.trim() && Boolean(pairTokenAddress) && Boolean(chainId);

  // Enhanced error handling
  useEffect(() => {
    if (error) {
      console.error("[launch] full error object:", error);
      console.error("[launch] error.shortMessage:", error.shortMessage);
      console.error("[launch] error.cause:", error.cause);
      console.error("[launch] error.details:", error.details);
      console.error("[launch] error.code:", error.code);
      console.error("[launch] error.message:", error.message);

      // Check if error is from contract
      if (error.cause && error.cause.data) {
        console.error("[launch] error.cause.data:", error.cause.data);
      }

      // Check for wagmi specific errors
      if (error.walk) {
        try {
          const walkError = error.walk();
          console.error("[launch] walk error:", walkError);
        } catch (walkErr) {
          console.error("[launch] could not walk error:", walkErr);
        }
      }

      // Check for common issues
      if (error.message && error.message.includes("getChainId")) {
        console.error("[launch] This is a connector issue. Please try reconnecting your wallet or using a different connector.");
      }
    }
  }, [error]);

  // Once the launch tx confirms, the token/curve/description/socials/image
  // the user filled in aren't on-chain — description, image, X and Telegram
  // links are captured off-chain via POST /api/tokens/:address/metadata (see
  // schema.sql's comment on why). Decode the token address straight out of
  // the Launched event in the receipt rather than waiting on the indexer to
  // catch up and re-deriving it some other way.
  useEffect(() => {
    if (!BACKEND_CONNECTED || !isSuccess || !receipt || !hash) return;
    if (syncedHashRef.current === hash) return;
    syncedHashRef.current = hash;

    const factoryAddress = LAUNCHPAD_FACTORY_ADDRESS[chainId];
    let launchedTokenAddress = null;

    for (const log of receipt.logs) {
      if (!factoryAddress || log.address?.toLowerCase() !== factoryAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: LAUNCHED_EVENT_ABI, data: log.data, topics: log.topics });
        if (decoded.eventName === "Launched") {
          launchedTokenAddress = decoded.args.token;
          break;
        }
      } catch {
        // Not the Launched log (factory can emit other events in the same tx) — skip it.
      }
    }

    if (!launchedTokenAddress) {
      console.warn("[launch] couldn't find Launched event in receipt logs; skipping metadata sync");
      return;
    }

    (async () => {
      try {
        let imageUrl;
        if (imageFile) {
          const uploaded = await uploadImage(imageFile);
          imageUrl = uploaded?.url || uploaded?.imageUrl;
        }
        if (description || imageUrl || xUrl || telegramUrl) {
          const timestamp = Date.now();
          // Must match authService.js's buildMetadataUpdateMessage() exactly —
          // verifyMetadataUpdateAuth() on the backend recomputes this same
          // string and rejects the request if the signed message differs.
          const message = `Ascend: update metadata for ${launchedTokenAddress.toLowerCase()} at ${timestamp}`;
          const signature = await signMessageAsync({ message });
          await updateTokenMetadata(launchedTokenAddress, {
            description: description || undefined,
            imageUrl,
            xUrl: xUrl || undefined,
            telegramUrl: telegramUrl || undefined,
            timestamp,
            signature,
          });
        }
      } catch (err) {
        console.error("[launch] metadata sync failed:", err);
        setMetadataSyncError(err.message || "Failed to save image/description");
      }
    })();
  }, [isSuccess, receipt, hash, chainId]);

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Form */}
        <form onSubmit={submit} className="rounded-xl2 bg-surface border border-border p-5 lg:p-6">
          <h1 className="font-display text-2xl font-semibold text-ink mb-6">Launch token</h1>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Token name"
                className="input"
              />
            </Field>
            <Field label="Ticker">
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="SYMBOL"
                className="input"
              />
            </Field>
          </div>

          <Field label="Description" className="mb-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of the token"
              rows={3}
              className="input resize-none"
            />
          </Field>

          <Field label="Token image" className="mb-4">
            <label className="flex items-center gap-2.5 rounded-xl border border-dashed border-border-strong px-3.5 py-3 cursor-pointer hover:border-ink-soft transition-colors w-fit">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="w-9 h-9 rounded-lg object-cover" />
              ) : (
                <span className="w-9 h-9 rounded-lg bg-surface-alt flex items-center justify-center">
                  <ImagePlus size={16} className="text-ink-faint" />
                </span>
              )}
              <span className="text-sm font-medium text-ink-soft">Choose image</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
          </Field>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="X profile">
              <input
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="x.com/handle"
                className="input"
              />
            </Field>
            <Field label="Telegram">
              <input
                value={telegramUrl}
                onChange={(e) => setTelegramUrl(e.target.value)}
                placeholder="t.me/community"
                className="input"
              />
            </Field>
          </div>

          <Field label="Paired asset" className="mb-1">
            <div className="relative">
              <select
                value={pairSymbol}
                onChange={(e) => setPairSymbol(e.target.value)}
                className="input appearance-none pr-9"
              >
                {PAIR_TOKENS.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            </div>
          </Field>
          {!pairTokenAddress && (
            <p className="text-xs text-down mb-4">
              No {pairSymbol} address configured for this chain yet — launch is disabled until it's added to PAIR_TOKENS.
            </p>
          )}
          <p className="text-xs text-ink-faint mb-4">
            Graduates once the curve raises {graduationThreshold.toFixed(2)} {pairSymbol}.
          </p>

          <Field label="Developer buy" className="mb-4">
            <div className="input flex items-center justify-between">
              <input
                value={devBuy}
                onChange={(e) => setDevBuy(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
                className="flex-1 bg-transparent outline-none"
              />
              <span className="text-sm font-semibold text-ink-soft shrink-0">{pairSymbol}</span>
            </div>
          </Field>

          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex items-center justify-between w-full py-2 text-sm font-medium text-ink border-t border-border mb-2"
          >
            Advanced
            <ChevronDown size={16} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
          {showAdvanced && (
            <Field label="Virtual pair reserve" className="mb-4">
              <input
                value={virtualPairReserve}
                onChange={(e) => setVirtualPairReserve(e.target.value.replace(/[^0-9.]/g, ""))}
                className="input"
              />
              <p className="text-xs text-ink-faint mt-1">
                Sets the curve's starting price and steepness. Lower values graduate sooner.
              </p>
            </Field>
          )}

          <p className="text-xs text-ink-faint mb-3">
            {pairSymbol} pair, {LAUNCH_FEE} ETH launch fee due
          </p>

          {!isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  type="button"
                  onClick={openConnectModal}
                  className="w-full rounded-xl bg-lime hover:bg-lime-dark text-lime-ink font-semibold py-3.5 transition-colors"
                >
                  Connect wallet
                </button>
              )}
            </ConnectButton.Custom>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit || isPending || isConfirming}
              className="w-full rounded-xl bg-lime hover:bg-lime-dark disabled:opacity-40 disabled:cursor-not-allowed text-lime-ink font-semibold py-3.5 transition-colors"
            >
              {isPending || isConfirming ? "Confirming…" : "Launch token"}
            </button>
          )}

          {isSuccess && (
            <p className="text-xs text-up font-medium mt-2 text-center">
              Token launched. It'll appear on Explore shortly.
            </p>
          )}
          {isSuccess && metadataSyncError && (
            <p className="text-xs text-down font-medium mt-1 text-center">
              Launched, but saving your image/description failed: {metadataSyncError}. You can retry
              this from the token page once it appears.
            </p>
          )}
          {error && (
            <div className="text-xs text-down font-medium mt-2 text-center">
              <p>{error.shortMessage || "Launch failed. Check the contract address for this chain."}</p>
              {error.message && error.message.includes("getChainId") && (
                <p className="text-ink-faint mt-1">
                  Please try disconnecting and reconnecting your wallet, or use a different wallet connector.
                </p>
              )}
              {chainId && (
                <p className="text-ink-faint mt-1 text-[10px]">
                  Chain: {chainId} | Factory: {LAUNCHPAD_FACTORY_ADDRESS[chainId] || "Not configured"}
                </p>
              )}
            </div>
          )}
        </form>

        {/* Live preview */}
        <div className="rounded-xl2 bg-surface border border-border p-5 lg:sticky lg:top-20">
          <div className="flex items-center gap-3 mb-4">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-11 h-11 rounded-xl object-cover" />
            ) : (
              <span className="w-11 h-11 rounded-xl bg-surface-alt flex items-center justify-center">
                <ImagePlus size={16} className="text-ink-faint" />
              </span>
            )}
          </div>
          <h2 className="font-display text-lg font-semibold text-ink truncate">
            {name || "Your token"}
          </h2>
          <p className="text-xs text-ink-faint font-mono mb-4">{ticker || "ticker"}</p>

          <dl className="space-y-2.5 text-sm">
            <Row label="Launch fee" value={`${LAUNCH_FEE} ETH`} />
            <Row label="Paired with" value={pairSymbol} />
            <Row label="Trade fee" value={`${TRADE_FEE_PCT.toFixed(2)}%`} />
            <Row label="Graduation" value={`${graduationThreshold.toFixed(2)} ${pairSymbol}`} />
            <Row label="Reward split" value={REWARD_SPLIT_LABEL} />
            <Row label="Liquidity" value="Burned" />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-ink-soft mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-mono font-medium text-ink tabular">{value}</dd>
    </div>
  );
}
