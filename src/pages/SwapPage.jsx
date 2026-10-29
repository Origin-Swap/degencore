import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useChainId, useBalance, useReadContract, useReadContracts, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isAddress, zeroAddress, parseUnits, formatUnits, encodeFunctionData } from "viem";
import { ArrowLeft, Search, Settings2, ExternalLink } from "lucide-react";
import {
  BONDING_CURVE_ABI,
  UNISWAP_V2_ROUTER_ABI,
  UNISWAP_V2_PAIR_ABI,
  REWARD_ROUTER_ADDRESS,
  REWARD_ROUTER_ABI,
  ERC20_ABI,
} from "../config/contracts";
import { fetchToken, fetchTokens } from "../data/api";
import { mapApiToken } from "../data/adapters";
import TokenAvatar from "../components/ui/TokenAvatar";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";

const REFERENCE_UNITS = "0.0001";
const GECKOTERMINAL_NETWORK_SLUG = { 8453: "base" };

// ---------------------------------------------------------------------
// Token picker — Ascend's own tokens ONLY, and only ones that have
// graduated (RewardRouter refuses anything else — see require(curve.graduated())
// in RewardRouter.sol). No arbitrary/external ERC20s here.
// ---------------------------------------------------------------------
function TokenPicker({ onPick }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notGraduatedHit, setNotGraduatedHit] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setNotGraduatedHit(false);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setIsSearching(true);

      const lookup = isAddress(query.trim())
        ? fetchToken(query.trim()).then((row) => (row ? [row] : []))
        : fetchTokens({ search: query.trim(), limit: 20 });

      lookup
        .then((rows) => {
          const all = rows || [];
          const graduated = all.filter((r) => r.graduated);
          if (all.length > 0 && graduated.length === 0) setNotGraduatedHit(true);
          setResults(graduated.map(mapApiToken));
        })
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="max-w-md mx-auto">
      <h1 className="font-display text-2xl font-semibold text-ink mb-1 text-center">Swap</h1>
      <p className="text-sm text-ink-soft mb-6 text-center">
        Trade a graduated Ascend token — rewards keep flowing post-graduation.
      </p>

      <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 h-11 mb-3">
        <Search size={16} className="text-ink-faint shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name/ticker or paste token address"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint font-mono"
        />
      </div>

      {isSearching && <p className="text-xs text-ink-soft text-center py-4">Searching…</p>}

      {!isSearching && notGraduatedHit && results.length === 0 && (
        <p className="text-xs text-ink-faint text-center py-4">
          Found a match, but it hasn't graduated yet — trade it from its own token page (bonding
          curve) instead.
        </p>
      )}

      {!isSearching && query && !notGraduatedHit && results.length === 0 && (
        <p className="text-xs text-ink-faint text-center py-4">No graduated token matches "{query}".</p>
      )}

      <div className="space-y-1">
        {results.map((t) => (
          <button
            key={t.address}
            onClick={() => onPick(t)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-alt transition-colors text-left"
          >
            <TokenAvatar token={t} size={32} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">
                {t.name} <span className="text-ink-faint">${t.symbol}</span>
              </p>
              <p className="text-xs text-ink-faint truncate font-mono">{t.address}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// The swap widget once a token is picked
// ---------------------------------------------------------------------
function RewardSwapWidget({ token, chainId }) {
  const routerAddress = REWARD_ROUTER_ADDRESS[chainId];
  const { address, isConnected } = useAccount();

  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  const pairIsNative = token.pairSymbol === "ETH";
  const pairDecimals = pairIsNative ? 18 : 6;
  const tokenDecimals = 18;
  const isBuy = side === "buy";
  const fromDecimals = isBuy ? pairDecimals : tokenDecimals;
  const toDecimals = isBuy ? tokenDecimals : pairDecimals;
  const fromSymbol = isBuy ? token.pairSymbol : token.symbol;
  const toSymbol = isBuy ? token.symbol : token.pairSymbol;

  const dexRouter = useReadContract({
    address: routerAddress,
    abi: REWARD_ROUTER_ABI,
    functionName: "dexRouter",
    query: { enabled: Boolean(routerAddress) },
  });

  const feeReads = useReadContracts({
    contracts: [
      { address: token.curveAddress, abi: BONDING_CURVE_ABI, functionName: "FEE_BPS" },
      { address: token.curveAddress, abi: BONDING_CURVE_ABI, functionName: "BPS_DENOM" },
      { address: dexRouter.data, abi: UNISWAP_V2_ROUTER_ABI, functionName: "WETH" },
    ],
    query: { enabled: Boolean(token.curveAddress) && Boolean(dexRouter.data) },
  });

  const feeBps = feeReads.data?.[0]?.result;
  const bpsDenom = feeReads.data?.[1]?.result;
  const weth = feeReads.data?.[2]?.result;
  const feeDataReady = feeBps !== undefined && bpsDenom !== undefined && Boolean(weth);

  const pairLeg = pairIsNative ? weth : token.pairTokenAddress;
  const path = isBuy ? [pairLeg, token.address] : [token.address, pairLeg];

  const fromBalance = useBalance({
    address,
    token: isBuy ? (pairIsNative ? undefined : token.pairTokenAddress) : token.address,
    query: { enabled: Boolean(address) },
  });

  const parsedAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  const rawAmountIn = useMemo(() => {
    try {
      return parsedAmount ? parseUnits(amount, fromDecimals) : 0n;
    } catch {
      return 0n;
    }
  }, [amount, parsedAmount, fromDecimals]);

  // Buy: DEX only ever sees amountIn MINUS fee (RewardRouter deducts fee
  // before forwarding — see buyWithReward). Sell: DEX sees the full
  // tokensIn; fee is deducted from the GROSS output afterward instead
  // (matches sellWithReward's order exactly).
  const dexAmountIn = useMemo(() => {
    if (!feeDataReady || rawAmountIn === 0n) return 0n;
    if (!isBuy) return rawAmountIn;
    const fee = (rawAmountIn * BigInt(feeBps)) / BigInt(bpsDenom);
    return rawAmountIn - fee;
  }, [feeDataReady, rawAmountIn, isBuy, feeBps, bpsDenom]);

  const quote = useReadContract({
    address: dexRouter.data,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [dexAmountIn, path],
    query: { enabled: feeDataReady && dexAmountIn > 0n },
  });

  const referenceIn = useMemo(() => {
    try {
      return parseUnits(REFERENCE_UNITS, fromDecimals);
    } catch {
      return 0n;
    }
  }, [fromDecimals]);

  const referenceQuote = useReadContract({
    address: dexRouter.data,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [referenceIn, path],
    query: { enabled: feeDataReady && referenceIn > 0n },
  });

  // Final amount the trader actually receives, fee already accounted for
  // in both directions.
  const netAmountOut = useMemo(() => {
    const dexOut = quote.data?.[1];
    if (!dexOut || !feeDataReady) return undefined;
    if (isBuy) return dexOut; // fee already taken out of the INPUT for buys
    const fee = (dexOut * BigInt(feeBps)) / BigInt(bpsDenom); // sells: fee taken from OUTPUT
    return dexOut - fee;
  }, [quote.data, feeDataReady, isBuy, feeBps, bpsDenom]);

  const rate = useMemo(() => {
    if (!netAmountOut || rawAmountIn === 0n) return null;
    return Number(formatUnits(netAmountOut, toDecimals)) / Number(formatUnits(rawAmountIn, fromDecimals));
  }, [netAmountOut, rawAmountIn, toDecimals, fromDecimals]);

  const priceImpactPct = useMemo(() => {
    const refOut = referenceQuote.data?.[1];
    if (!refOut || referenceIn === 0n || !rate) return null;
    const marginal = Number(formatUnits(refOut, toDecimals)) / Number(formatUnits(referenceIn, fromDecimals));
    if (marginal <= 0) return null;
    const impact = ((marginal - rate) / marginal) * 100;
    return impact > 0 ? impact : 0;
  }, [referenceQuote.data, referenceIn, rate, toDecimals, fromDecimals]);

  const minOut = useMemo(() => {
    if (!netAmountOut) return 0n;
    return (netAmountOut * BigInt(Math.round((100 - slippage) * 100))) / 10000n;
  }, [netAmountOut, slippage]);

  const { sendTransaction, data: hash, isPending, error: writeError } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Approve target is RewardRouter itself — NOT the curve, NOT dexRouter.
  // (RewardRouter.sol's own docstring on sellWithReward is explicit about
  // this: the curve is dead post-graduation, approving it does nothing.)
  const approvalTokenAddress = isBuy ? token.pairTokenAddress : token.address;
  const spenderNeedsApproval = isBuy ? !pairIsNative : true;

  const allowance = useReadContract({
    address: approvalTokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address ?? zeroAddress, routerAddress ?? zeroAddress],
    query: { enabled: Boolean(address) && Boolean(routerAddress) && spenderNeedsApproval },
  });

  const needsApproval =
    spenderNeedsApproval && rawAmountIn > 0n && allowance.data !== undefined && allowance.data < rawAmountIn;

  const {
    sendTransaction: sendApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
  } = useSendTransaction();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  useEffect(() => {
    if (isApproveConfirmed) allowance.refetch();
  }, [isApproveConfirmed]);

  function approve() {
    if (!routerAddress || rawAmountIn === 0n) return;
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [routerAddress, rawAmountIn],
    });
    sendApprove({ to: approvalTokenAddress, data });
  }

  function setPercent(pct) {
    const bal = fromBalance.data;
    if (!bal?.value) return;
    const raw = (bal.value * BigInt(pct)) / 100n;
    setAmount(raw > 0n ? formatUnits(raw, bal.decimals) : "");
  }

  function submit() {
    if (!routerAddress || rawAmountIn === 0n || !netAmountOut) return;

    if (isBuy) {
      const data = encodeFunctionData({
        abi: REWARD_ROUTER_ABI,
        functionName: "buyWithReward",
        args: [token.curveAddress, rawAmountIn, minOut, address],
      });
      sendTransaction({ to: routerAddress, data, value: pairIsNative ? rawAmountIn : 0n });
    } else {
      const data = encodeFunctionData({
        abi: REWARD_ROUTER_ABI,
        functionName: "sellWithReward",
        args: [token.curveAddress, rawAmountIn, minOut, address],
      });
      sendTransaction({ to: routerAddress, data, value: 0n });
    }
  }

  const estimatedOut = netAmountOut ? Number(formatUnits(netAmountOut, toDecimals)) : 0;
  const quotePending = parsedAmount > 0 && feeDataReady && rawAmountIn > 0n && !quote.data && !quote.error;
  const highImpact = priceImpactPct != null && priceImpactPct >= 5;

  if (!routerAddress) {
    return (
      <div className="rounded-xl2 bg-surface border border-border p-4">
        <p className="text-sm text-ink-soft">
          No RewardRouter address configured for chain {chainId} — fill in REWARD_ROUTER_ADDRESS in
          contracts.js first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 bg-surface border border-border p-4">
      <div className="grid grid-cols-2 gap-1 bg-surface-alt rounded-xl p-1 mb-4">
        <button
          onClick={() => setSide("buy")}
          className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
            isBuy ? "bg-surface text-up shadow-sm" : "text-ink-faint"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
            !isBuy ? "bg-surface text-down shadow-sm" : "text-ink-faint"
          }`}
        >
          Sell
        </button>
      </div>

      <div className="flex items-center justify-end mb-1">
        <button onClick={() => setShowSettings((s) => !s)} className="text-ink-faint hover:text-ink">
          <Settings2 size={15} />
        </button>
      </div>

      {showSettings && (
        <div className="rounded-xl bg-surface-alt/60 p-3 mb-3">
          <p className="text-xs text-ink-faint mb-1.5">Slippage tolerance</p>
          <div className="flex items-center gap-1.5">
            {[0.5, 1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  slippage === s ? "bg-ink text-white" : "bg-surface text-ink-soft"
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border p-3 mb-2">
        <div className="flex items-center justify-between text-xs text-ink-faint mb-1.5">
          <span>You pay</span>
          {address && (
            <span className="font-mono tabular">
              {fromBalance.data ? Number(fromBalance.data.formatted).toFixed(4) : "0"} {fromSymbol} available
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            inputMode="decimal"
            className="w-full bg-transparent text-2xl font-display font-medium outline-none placeholder:text-ink-faint/60"
          />
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-sm font-semibold">
            {fromSymbol}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2.5">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setPercent(pct)}
              className="rounded-lg bg-surface-alt hover:bg-border-strong/30 py-1 text-[11px] font-semibold text-ink-soft transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-surface-alt/60 p-3 mb-3">
        <p className="text-xs text-ink-faint mb-1">You receive (estimated)</p>
        <p className="font-mono text-lg font-medium text-ink tabular">
          {estimatedOut ? estimatedOut.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0"}{" "}
          <span className="text-sm text-ink-soft">{toSymbol}</span>
        </p>
        {quotePending && <p className="text-[11px] text-ink-faint mt-1">Fetching quote…</p>}
      </div>

      {rate != null && (
        <div className="rounded-xl bg-surface-alt/60 p-3 mb-3 space-y-1 text-xs">
          <div className="flex items-center justify-between text-ink-soft">
            <span>Rate</span>
            <span className="font-mono tabular text-ink">
              1 {fromSymbol} = {rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {toSymbol}
            </span>
          </div>
          {priceImpactPct != null && (
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Price impact</span>
              <span className={`font-mono tabular ${highImpact ? "text-down font-semibold" : "text-ink"}`}>
                {priceImpactPct < 0.01 ? "<0.01" : priceImpactPct.toFixed(2)}%
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-ink-soft">
            <span>Slippage tolerance</span>
            <span className="font-mono tabular text-ink">{slippage}%</span>
          </div>
        </div>
      )}

      {highImpact && (
        <p className="text-[11px] text-down font-medium mb-3">
          High price impact for this pool's current liquidity.
        </p>
      )}

      {!isConnected ? (
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              onClick={openConnectModal}
              className="w-full rounded-xl bg-lime hover:bg-lime-dark text-lime-ink font-semibold py-3 transition-colors"
            >
              Connect wallet
            </button>
          )}
        </ConnectButton.Custom>
      ) : needsApproval ? (
        <button
          onClick={approve}
          disabled={isApprovePending || isApproveConfirming}
          className="w-full rounded-xl bg-lime hover:bg-lime-dark disabled:opacity-40 disabled:cursor-not-allowed text-lime-ink font-semibold py-3 transition-colors"
        >
          {isApprovePending || isApproveConfirming ? "Approving…" : `Approve ${fromSymbol}`}
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!feeDataReady || parsedAmount === 0 || isPending || isConfirming || !netAmountOut}
          className="w-full rounded-xl bg-lime hover:bg-lime-dark disabled:opacity-40 disabled:cursor-not-allowed text-lime-ink font-semibold py-3 transition-colors"
        >
          {isPending || isConfirming ? "Confirming…" : isBuy ? `Buy ${token.symbol}` : `Sell ${token.symbol}`}
        </button>
      )}

      {isConfirmed && <p className="text-xs text-up font-medium mt-2 text-center">Swap confirmed.</p>}
      {writeError && (
        <p className="text-xs text-down font-medium mt-2 text-center">{writeError.shortMessage || "Swap failed."}</p>
      )}
      {approveError && (
        <p className="text-xs text-down font-medium mt-2 text-center">
          {approveError.shortMessage || "Approval failed."}
        </p>
      )}
    </div>
  );
}

function PoolStats({ token }) {
  const reads = useReadContracts({
    contracts: [
      { address: token.dexPairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "getReserves" },
      { address: token.dexPairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "token0" },
    ],
    query: { enabled: Boolean(token.dexPairAddress) },
  });

  const pairDecimals = token.pairSymbol === "ETH" ? 18 : 6;

  const stats = useMemo(() => {
    const reserves = reads.data?.[0]?.result;
    const token0 = reads.data?.[1]?.result;
    if (!reserves || !token0) return null;
    const [reserve0, reserve1] = reserves;
    const tokenIsToken0 = token0.toLowerCase() === token.address?.toLowerCase();
    return {
      tokenAmount: Number(formatUnits(tokenIsToken0 ? reserve0 : reserve1, 18)),
      pairAmount: Number(formatUnits(tokenIsToken0 ? reserve1 : reserve0, pairDecimals)),
    };
  }, [reads.data, token.address, pairDecimals]);

  if (!token.dexPairAddress) return null;

  return (
    <div className="grid grid-cols-2 gap-4 rounded-xl2 border border-border bg-surface p-4 mb-4">
      <div>
        <p className="text-xs text-ink-faint mb-1">{token.symbol} in pool</p>
        <p className="font-mono tabular text-sm font-medium text-ink">
          {stats ? stats.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
        </p>
      </div>
      <div>
        <p className="text-xs text-ink-faint mb-1">{token.pairSymbol} in pool</p>
        <p className="font-mono tabular text-sm font-medium text-ink">
          {stats ? stats.pairAmount.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
        </p>
      </div>
    </div>
  );
}

function DexChart({ token, chainId }) {
  const networkSlug = GECKOTERMINAL_NETWORK_SLUG[chainId];

  if (!token.dexPairAddress) {
    return (
      <div className="rounded-xl2 border border-dashed border-border bg-surface h-[420px] flex items-center justify-center">
        <p className="text-sm text-ink-soft">No DEX pair recorded for this token yet.</p>
      </div>
    );
  }
  if (!networkSlug) {
    return (
      <div className="rounded-xl2 border border-dashed border-border bg-surface h-[420px] flex flex-col items-center justify-center gap-1.5 px-6 text-center">
        <p className="text-sm text-ink-soft">Chart isn't available on this network (chain {chainId}).</p>
        <p className="text-xs text-ink-faint max-w-sm">
          GeckoTerminal only indexes mainnet liquidity, not testnets.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 border border-border overflow-hidden h-[420px]">
      <iframe
        title={`${token.symbol} chart`}
        src={`https://www.geckoterminal.com/${networkSlug}/pools/${token.dexPairAddress}?embed=1&info=0&swaps=0`}
        className="w-full h-full"
        frameBorder="0"
        allow="clipboard-write"
      />
    </div>
  );
}

export default function SwapPage() {
  const chainId = useChainId();
  const [token, setToken] = useState(null);

  if (!token) {
    return (
      <div className="px-4 lg:px-8 py-10">
        <TokenPicker onPick={setToken} />
      </div>
    );
  }

  if (!token.graduated) {
    // Shouldn't normally happen (picker already filters to graduated), but
    // guards against stale state if graduation status changes mid-session.
    return (
      <div className="px-4 lg:px-8 py-10 max-w-lg mx-auto text-center">
        <EmptyState
          icon={ExternalLink}
          title="Not on a DEX yet"
          description={`${token.symbol} hasn't graduated — trade it from its own token page instead.`}
        />
        <button onClick={() => setToken(null)} className="text-sm text-indigo font-medium mt-4">
          Pick another token
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-[1400px] mx-auto">
      <button
        onClick={() => setToken(null)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink mb-4"
      >
        <ArrowLeft size={15} /> Choose a different token
      </button>

      <div className="flex items-center gap-3 mb-6">
        <TokenAvatar token={token} size={44} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-semibold text-ink truncate">{token.name}</h1>
            <Badge variant="indigo">Graduated</Badge>
          </div>
          <Link to={`/token/${token.symbol}`} className="text-xs text-indigo font-mono truncate hover:underline">
            View bonding curve page
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="order-2 lg:order-1">
          <PoolStats token={token} />
          <DexChart token={token} chainId={chainId} />
        </div>
        <div className="order-1 lg:order-2">
          <RewardSwapWidget token={token} chainId={chainId} />
        </div>
      </div>
    </div>
  );
}
