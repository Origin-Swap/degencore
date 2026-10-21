import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useSignMessage,
  useChainId,
  useChains,
  useReadContract,
} from "wagmi";
import { parseUnits, parseEther, decodeEventLog, keccak256, toBytes } from "viem";
import { ImagePlus, ChevronDown } from "lucide-react";
import {
  LAUNCHPAD_FACTORY_ABI,
  LAUNCHPAD_FACTORY_ADDRESS,
  PAIR_TOKEN_ADDRESSES,
} from "../config/contracts";
import { BACKEND_CONNECTED } from "../config/env";
import { uploadImage, updateTokenMetadata } from "../data/api";

// Mirrors BondingCurve.sol constructor.
const VIRTUAL_TOKEN_RESERVE = 1_073_000_000;
const TOKENS_FOR_SALE = 800_000_000;
function computeGraduationThreshold(virtualPairReserve) {
  const denom = VIRTUAL_TOKEN_RESERVE - TOKENS_FOR_SALE;
  return (virtualPairReserve * TOKENS_FOR_SALE) / denom;
}

const TRADE_FEE_PCT = 2;

// Pair config — each entry describes:
//   decimals       : token decimals (USDC = 6, rest = 18)
//   isNative       : true only when pairToken === router.WETH()
//   defaultVPR     : default virtual pair reserve (human-readable units)
//   presets        : 3 quick-pick options (Low / Default / High)
const PAIR_CONFIG = {
  ETH: {
    key: "ETH",
    label: "ETH",
    decimals: 18,
    isNative: true,
    defaultVPR: "4.2",
    presets: [
      { id: "low",     label: "Low",     value: "2.2" },
      { id: "default", label: "Default", value: "4.2" },
      { id: "high",    label: "High",    value: "8.8" },
    ],
  },
  USDC: {
    key: "USDC",
    label: "USDC",
    decimals: 6,
    isNative: false,
    defaultVPR: "10000",
    presets: [
      { id: "low",     label: "Low",     value: "5000" },
      { id: "default", label: "Default", value: "10000" },
      { id: "high",    label: "High",    value: "15000" },
    ],
  },
  SUPRA: {
    key: "SUPRA",
    label: "SUPRA",
    decimals: 18,
    isNative: false,
    defaultVPR: "82000000",
    presets: [
      { id: "low",     label: "Low",     value: "41000000" },
      { id: "default", label: "Default", value: "82000000" },
      { id: "high",    label: "High",    value: "164000000" },
    ],
  },
};

const REWARD_MODES = [
  { value: 0, label: "Creator mode — 1% of every trade goes to you" },
  { value: 1, label: "Cashback mode — 1% of every trade goes to traders" },
];

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
      { name: "rewardMode", type: "uint8", indexed: false },
    ],
  },
];

// --- Metadata signature v2 (must match authService.js) ---
const CONTENT_FIELDS = ["description", "imageUrl", "websiteUrl", "xUrl", "telegramUrl"];

function buildContentHash(content) {
  const normalized = {};
  for (const key of CONTENT_FIELDS) {
    normalized[key] = content?.[key] ?? "";
  }
  return keccak256(toBytes(JSON.stringify(normalized)));
}

function buildMetadataUpdateMessage({ tokenAddress, timestamp, contentHash }) {
  return (
    `Ascend: update metadata for ${tokenAddress.toLowerCase()} at ${timestamp} ` +
    `content ${contentHash} (v2)`
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateMetadataWithRetry(tokenAddress, payload, { retries = 5, delayMs = 1500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await updateTokenMetadata(tokenAddress, payload);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw lastErr;
}

function formatAmount(n) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export default function LaunchPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();

  const chain = chains.find((c) => c.id === chainId);
  const nativeSymbol = chain?.nativeCurrency?.symbol ?? "ETH";

  const factoryAddress = LAUNCHPAD_FACTORY_ADDRESS[chainId];

  const availablePairKeys = useMemo(
    () =>
      Object.keys(PAIR_CONFIG).filter((key) =>
        Boolean(PAIR_TOKEN_ADDRESSES[key]?.[chainId])
      ),
    [chainId]
  );

  const [pairKey, setPairKey] = useState("ETH");
  const pairConfig = PAIR_CONFIG[pairKey] ?? PAIR_CONFIG.ETH;
  const pairDecimals = pairConfig.decimals;
  const isNativePair = pairConfig.isNative;
  const pairTokenAddress = PAIR_TOKEN_ADDRESSES[pairKey]?.[chainId];

  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [devBuy, setDevBuy] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Source of truth for the actual VPR value that will be submitted.
  // Populated by preset clicks OR by the manual input below.
  const [virtualPairReserve, setVirtualPairReserve] = useState(pairConfig.defaultVPR);

  // Which preset is highlighted. "custom" means the typed value doesn't
  // exactly match any preset (no button highlighted).
  const [activePresetId, setActivePresetId] = useState("default");

  const [rewardMode, setRewardMode] = useState(REWARD_MODES[0].value);
  const [metadataSyncError, setMetadataSyncError] = useState(null);

  const syncedHashRef = useRef(null);

  // Reset VPR and dev-buy whenever the pair changes.
  useEffect(() => {
    const cfg = PAIR_CONFIG[pairKey];
    if (cfg) {
      setVirtualPairReserve(cfg.defaultVPR);
      setActivePresetId("default");
      setDevBuy("");
    }
  }, [pairKey]);

  // Auto-fallback to first available pair if current one has no address on chain.
  useEffect(() => {
    if (availablePairKeys.length > 0 && !availablePairKeys.includes(pairKey)) {
      setPairKey(availablePairKeys[0]);
    }
  }, [availablePairKeys, pairKey]);

  // Launch fee (mutable on contract, default 0).
  const launchFeeRead = useReadContract({
    address: factoryAddress,
    abi: LAUNCHPAD_FACTORY_ABI,
    functionName: "launchFee",
    query: { enabled: Boolean(factoryAddress) },
  });
  const launchFeeWei = launchFeeRead.data;
  const launchFeeReady = launchFeeWei !== undefined;
  const launchFeeDisplay = launchFeeReady ? Number(launchFeeWei) / 1e18 : 0;

  const devBuyNum = Number(devBuy) || 0;

  const graduationThreshold = useMemo(() => {
    const v = Number(virtualPairReserve) || Number(pairConfig.defaultVPR);
    return computeGraduationThreshold(v);
  }, [virtualPairReserve, pairConfig.defaultVPR]);

  function selectPreset(presetId) {
    const preset = pairConfig.presets.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
    setVirtualPairReserve(preset.value);
  }

  // Manual VPR input — always visible. Typing a value that exactly matches
  // a preset auto-highlights that preset; any other value marks the
  // selection as "custom" (no preset highlighted).
  function handleManualVPRChange(rawValue) {
    const cleaned = rawValue.replace(/[^0-9.]/g, "");
    setVirtualPairReserve(cleaned);
    const matched = pairConfig.presets.find((p) => p.value === cleaned);
    setActivePresetId(matched ? matched.id : "custom");
  }

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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

    if (!chainId) return;
    if (!factoryAddress) {
      console.error(`No factory address configured for chain ${chainId}`);
      return;
    }
    if (!name.trim() || !ticker.trim()) return;
    if (!pairTokenAddress) return;

    // Dev-buy is optional. Only parse for native pairs; non-native pairs
    // send 0n — the factory rejects any msg.value above launchFee for them.
    let devBuyWei = 0n;
    if (isNativePair && devBuyNum > 0) {
      try {
        devBuyWei = parseEther(devBuy);
      } catch {
        console.warn("[launch] invalid dev-buy input, treating as 0");
        devBuyWei = 0n;
      }
    }

    const launchArgs = [
      name.trim(),
      ticker.trim().toUpperCase(),
      pairTokenAddress,
      // VPR scaled by pair's own decimals.
      parseUnits(String(virtualPairReserve || pairConfig.defaultVPR), pairDecimals),
      rewardMode,
      0n,
    ];

    const launchValue = (launchFeeReady ? launchFeeWei : 0n) + devBuyWei;

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
    }
  }

  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(ticker.trim()) &&
    Boolean(pairTokenAddress) &&
    Boolean(chainId);

  useEffect(() => {
    if (error) {
      console.error("[launch] error:", error.shortMessage || error.message);
    }
  }, [error]);

  // Metadata sync after launch tx confirms.
  useEffect(() => {
    if (!BACKEND_CONNECTED || !isSuccess || !receipt || !hash) return;
    if (syncedHashRef.current === hash) return;
    syncedHashRef.current = hash;

    const factory = LAUNCHPAD_FACTORY_ADDRESS[chainId];
    let launchedTokenAddress = null;

    for (const log of receipt.logs) {
      if (!factory || log.address?.toLowerCase() !== factory.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: LAUNCHED_EVENT_ABI, data: log.data, topics: log.topics });
        if (decoded.eventName === "Launched") {
          launchedTokenAddress = decoded.args.token;
          break;
        }
      } catch {
        // Not the Launched log.
      }
    }

    if (!launchedTokenAddress) {
      console.warn("[launch] couldn't find Launched event; skipping metadata sync");
      return;
    }

    (async () => {
      try {
        let imageUrl;
        if (imageFile) {
          const uploaded = await uploadImage(imageFile);
          imageUrl = uploaded?.uri;
        }

        if (description || imageUrl || websiteUrl || xUrl || telegramUrl) {
          const content = {
            description: description || "",
            imageUrl: imageUrl || "",
            websiteUrl: websiteUrl || "",
            xUrl: xUrl || "",
            telegramUrl: telegramUrl || "",
          };
          const contentHash = buildContentHash(content);
          const timestamp = Date.now();
          const message = buildMetadataUpdateMessage({
            tokenAddress: launchedTokenAddress,
            timestamp,
            contentHash,
          });
          const signature = await signMessageAsync({ message });

          await updateMetadataWithRetry(launchedTokenAddress, {
            description: description || undefined,
            imageUrl,
            websiteUrl: websiteUrl || undefined,
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

          <div className="grid grid-cols-3 gap-3 mb-4">
            <Field label="Website">
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://"
                className="input"
              />
            </Field>
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

          {/* ==== PAIR SELECTOR ==== */}
          <Field label="Paired asset" className="mb-1">
            {availablePairKeys.length === 0 ? (
              <div className="input text-ink-faint">
                No pair tokens configured for chain {chainId}.
              </div>
            ) : availablePairKeys.length === 1 ? (
              <div className="input flex items-center justify-between text-ink-soft">
                <span className="font-medium text-ink">{pairConfig.label}</span>
                {isNativePair && <span className="text-xs text-ink-faint">Native pair</span>}
              </div>
            ) : (
              <div className="relative">
                <select
                  value={pairKey}
                  onChange={(e) => setPairKey(e.target.value)}
                  className="input appearance-none pr-9"
                >
                  {availablePairKeys.map((key) => (
                    <option key={key} value={key}>
                      {PAIR_CONFIG[key].label}
                      {PAIR_CONFIG[key].isNative ? " (native)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
                />
              </div>
            )}
          </Field>
          {!pairTokenAddress && (
            <p className="text-xs text-down mb-4">
              No {pairConfig.label} address configured for chain {chainId}.
            </p>
          )}

          {/* ==== CURVE SIZE: presets + custom input, ALL VISIBLE ==== */}
          <Field label="Curve size (virtual pair reserve)" className="mb-4">
            {/* Preset buttons */}
            <div className="grid grid-cols-3 gap-2">
              {pairConfig.presets.map((preset) => {
                const isActive = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                      isActive
                        ? "border-lime bg-lime/10 ring-1 ring-lime"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        isActive ? "text-lime-ink" : "text-ink-faint"
                      }`}
                    >
                      {preset.label}
                    </p>
                    <p className="font-mono text-sm font-medium text-ink tabular mt-0.5 truncate">
                      {formatAmount(Number(preset.value))}{" "}
                      <span className="text-[11px] text-ink-faint">{pairConfig.label}</span>
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Custom VPR input — always visible, NOT inside Advanced.
                Typing a value that exactly matches a preset highlights
                that preset; any other value marks the selection as custom
                (no preset highlighted). */}
            <div className="mt-3">
              <div className="input flex items-center justify-between gap-2">
                <input
                  value={virtualPairReserve}
                  onChange={(e) => handleManualVPRChange(e.target.value)}
                  placeholder={pairConfig.defaultVPR}
                  inputMode="decimal"
                  className="flex-1 bg-transparent outline-none"
                />
                <span className="text-sm font-semibold text-ink-soft shrink-0">
                  {pairConfig.label}
                </span>
              </div>
              <p className="text-[11px] text-ink-faint mt-1">
                {activePresetId === "custom"
                  ? "Custom value — this exact amount will be used on-chain."
                  : `Matches "${pairConfig.presets.find((p) => p.id === activePresetId)?.label ?? "Default"}" preset. Type a different number for a fully custom curve.`}
              </p>
            </div>

            {/* Live summary — always visible so the user never has to open
                Advanced to know what will be submitted. */}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-xs text-ink-faint">
              <span>
                Current VPR:{" "}
                <span className="font-mono font-medium text-ink">
                  {formatAmount(Number(virtualPairReserve) || Number(pairConfig.defaultVPR))}{" "}
                  {pairConfig.label}
                </span>
              </span>
              <span>·</span>
              <span>
                Graduates at{" "}
                <span className="font-mono font-medium text-ink">
                  {formatAmount(graduationThreshold)} {pairConfig.label}
                </span>
              </span>
            </div>
          </Field>

          {/* ==== DEV-BUY — fully optional ==== */}
          <Field label="Developer buy (optional)" className="mb-4">
            <div className={`input flex items-center justify-between ${!isNativePair ? "opacity-40" : ""}`}>
              <input
                value={devBuy}
                onChange={(e) => setDevBuy(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                inputMode="decimal"
                disabled={!isNativePair}
                className="flex-1 bg-transparent outline-none disabled:cursor-not-allowed"
              />
              <span className="text-sm font-semibold text-ink-soft shrink-0">
                {isNativePair ? nativeSymbol : pairConfig.label}
              </span>
            </div>
            {!isNativePair ? (
              <p className="text-xs text-ink-faint mt-1">
                Not available for {pairConfig.label} pairs — dev-buy is only supported when paired with a native asset.
              </p>
            ) : (
              <p className="text-xs text-ink-faint mt-1">
                Optional — leave empty to skip.
              </p>
            )}
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
            <Field label="Reward mode (locked forever after launch)" className="mb-4">
              <div className="relative">
                <select
                  value={rewardMode}
                  onChange={(e) => setRewardMode(Number(e.target.value))}
                  className="input appearance-none pr-9"
                >
                  {REWARD_MODES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
                />
              </div>
            </Field>
          )}

          <p className="text-xs text-ink-faint mb-3">
            {pairConfig.label} pair ·{" "}
            <span className="text-up font-medium">Free launch</span>
            {isNativePair && devBuyNum > 0
              ? ` + ${devBuy} ${nativeSymbol} dev-buy = ${devBuyNum.toFixed(6)} ${nativeSymbol} due`
              : ""}
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
              Launched, but saving your metadata failed: {metadataSyncError}
            </p>
          )}
          {error && (
            <p className="text-xs text-down font-medium mt-2 text-center">
              {error.shortMessage || "Launch failed."}
            </p>
          )}
        </form>

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
          <p className="text-xs text-ink-faint mb-4">{ticker || "ticker"}</p>

          <dl className="space-y-2.5 text-sm font-sans">
            <Row label="Launch fee" value="Free" />
            <Row label="Paired with" value={pairConfig.label} />
            <Row label="Trade fee" value={`${TRADE_FEE_PCT.toFixed(0)}%`} />
            <Row
              label="Curve size"
              value={
                activePresetId === "custom"
                  ? `Custom (${formatAmount(Number(virtualPairReserve) || 0)} ${pairConfig.label})`
                  : `${formatAmount(Number(virtualPairReserve) || 0)} ${pairConfig.label}`
              }
            />
            <Row
              label="Graduation"
              value={`${formatAmount(graduationThreshold)} ${pairConfig.label}`}
            />
            <Row
              label="Reward mode"
              value={rewardMode === 0 ? "Creator (1% to you)" : "Cashback (1% to traders)"}
            />
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
      <dd className="font-mono font-medium text-ink tabular text-right max-w-[60%] truncate">{value}</dd>
    </div>
  );
}
