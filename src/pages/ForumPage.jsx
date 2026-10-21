import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, parseEther } from "viem";
import { ImagePlus, ChevronDown } from "lucide-react";
import { LAUNCHPAD_FACTORY_ABI, LAUNCHPAD_FACTORY_ADDRESS } from "../config/contracts";
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

// Mirrors BondingCurve.sol's RewardMode enum EXACTLY (order matters - it's
// passed on-chain as a raw uint8):
//   enum RewardMode { CREATOR_FEE, TRADER_CASHBACK }
// CREATOR_FEE  (0): the 0.5% reward cut is pushed straight to the creator every trade.
// TRADER_CASHBACK (1): that same 0.5% accrues per-trader and is claimed via claimCashback().
const REWARD_MODES = [
  { value: 0, label: "Creator fee (0.5% to you on every trade)" },
  { value: 1, label: "Trader cashback (0.5% claimable by traders)" },
];

export default function LaunchPage() {
  const { chainId, isConnected } = useAccount();

  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [xUrl, setXUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [pairSymbol, setPairSymbol] = useState("ETH");
  const [devBuy, setDevBuy] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [virtualPairReserve, setVirtualPairReserve] = useState(String(DEFAULT_VIRTUAL_PAIR_RESERVE));
  const [rewardMode, setRewardMode] = useState(REWARD_MODES[0].value);

  const selectedPair = useMemo(
    () => PAIR_TOKENS.find((p) => p.symbol === pairSymbol),
    [pairSymbol]
  );
  // NOTE: assumes each PAIR_TOKENS entry carries a per-chain address map,
  // e.g. { symbol: "ETH", label: "ETH", addressByChain: { 8453: "0x4200...0006", 84532: "0x4200...0006" } }.
  // For "ETH"/"BNB"/etc this MUST resolve to the chain's real WETH/WBNB address
  // (the same one BondingCurve's isNativePair check compares against router.WETH())
  // — never address(0) and never the native "0xEeee...EEeE" placeholder some UIs use.
  // Adjust this line to match however mockData.js actually stores addresses.
  const pairTokenAddress = selectedPair?.addressByChain?.[chainId];

  const graduationThreshold = useMemo(() => {
    const v = Number(virtualPairReserve) || DEFAULT_VIRTUAL_PAIR_RESERVE;
    return computeGraduationThreshold(v);
  }, [virtualPairReserve]);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function submit(e) {
    e.preventDefault();
    const factoryAddress = LAUNCHPAD_FACTORY_ADDRESS[chainId];
    if (!factoryAddress || !name || !ticker || !pairTokenAddress) return;

    writeContract({
      address: factoryAddress,
      abi: LAUNCHPAD_FACTORY_ABI,
      functionName: "launch",
      args: [
        name,
        ticker,
        // Real ERC20 address for the selected pair on this chain (WETH for
        // "ETH", WBNB for "BNB", etc.). launch() itself never touches native
        // coin for the pair — BondingCurve derives isNativePair on its own
        // by comparing this address to router.WETH() once deployed.
        pairTokenAddress,
        parseUnits(virtualPairReserve || "0", 18),
        rewardMode,
      ],
      // launch() is payable — LAUNCH_FEE is charged in the chain's native token
      // regardless of which ERC20 is chosen as the bonding-curve pair.
      value: parseEther(String(LAUNCH_FEE)),
    });
  }

  const canSubmit = name.trim() && ticker.trim() && Boolean(pairTokenAddress);

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
            <>
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
              <Field label="Reward mode" className="mb-4">
                <div className="relative">
                  <select
                    value={rewardMode}
                    onChange={(e) => setRewardMode(Number(e.target.value))}
                    className="input appearance-none pr-9"
                  >
                    {REWARD_MODES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                </div>
                <p className="text-xs text-ink-faint mt-1">
                  Locked forever once the token is live — passed on-chain as the curve's rewardMode.
                </p>
              </Field>
            </>
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
          {error && (
            <p className="text-xs text-down font-medium mt-2 text-center">
              {error.shortMessage || "Launch failed. Check the contract address for this chain."}
            </p>
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
            <Row label="Reward mode" value={REWARD_MODES.find((r) => r.value === rewardMode)?.label ?? "—"} />
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
