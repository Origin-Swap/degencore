import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useSendTransaction,
} from "wagmi";
import { parseUnits, formatUnits, isAddress, zeroAddress, encodeFunctionData, maxUint256 } from "viem";
import { Settings2 } from "lucide-react";
import { BONDING_CURVE_ABI, ERC20_ABI } from "../../config/contracts";
import { usePostGraduationSwap } from "../../hooks/Usepostgraduationswap";

const SELL_FEE_ON_OUTPUT = true;

function estimateLocally(token, side, amountFloat) {
  if (!amountFloat || amountFloat <= 0) return 0;
  const lastPrice = token.priceHistory?.length
    ? token.priceHistory[token.priceHistory.length - 1].price
    : token.lastPrice || 0;
  if (!lastPrice) return 0;
  const FEE = 0.01;
  if (side === "buy") return (amountFloat / lastPrice) * (1 - FEE);
  return amountFloat * lastPrice * (1 - FEE);
}

export default function TradePanel({ token, onTradeConfirmed }) {
  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [showSlippage, setShowSlippage] = useState(false);

  const { address, isConnected } = useAccount();

  const pairIsNative = token.pairSymbol === "ETH";
  const pairDecimals = pairIsNative ? 18 : 6;
  const tokenDecimals = 18;

  const isGraduated = token.graduated === true;
  const curveIsDeployed = isAddress(token.curveAddress) && token.curveAddress !== zeroAddress;

  const spendBalance = useBalance({
    address,
    token: side === "buy"
      ? (pairIsNative ? undefined : token.pairTokenAddress)
      : token.address,
    query: { enabled: Boolean(address) },
  });

  const parsedAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  const amountWei = useMemo(() => {
    try {
      return parsedAmount
        ? parseUnits(amount, side === "buy" ? pairDecimals : tokenDecimals)
        : 0n;
    } catch {
      return 0n;
    }
  }, [amount, parsedAmount, side, pairDecimals]);

  const feeBps = useReadContract({
    address: token.curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "FEE_BPS",
    query: { enabled: curveIsDeployed && !isGraduated },
  });
  const bpsDenom = useReadContract({
    address: token.curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "BPS_DENOM",
    query: { enabled: curveIsDeployed && !isGraduated },
  });

  const feeDataReady = feeBps.data !== undefined && bpsDenom.data !== undefined;

  const pairInAfterFee = useMemo(() => {
    if (!feeDataReady || amountWei === 0n || isGraduated) return 0n;
    const denom = BigInt(bpsDenom.data);
    const fee = BigInt(feeBps.data);
    return (amountWei * (denom - fee)) / denom;
  }, [amountWei, feeDataReady, feeBps.data, bpsDenom.data, isGraduated]);

  const quoteArgAmount = side === "buy" ? pairInAfterFee : amountWei;
  const quoteReady = (side === "buy" || SELL_FEE_ON_OUTPUT) ? feeDataReady : true;

  const curveQuote = useReadContract({
    address: token.curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: side === "buy" ? "quoteBuy" : "quoteSell",
    args: [quoteArgAmount],
    query: {
      enabled: curveIsDeployed && amountWei > 0n && quoteReady && quoteArgAmount > 0n && !isGraduated
    },
  });

  const netQuoteData = useMemo(() => {
    if (!curveQuote.data) return curveQuote.data;
    if (side === "buy") return curveQuote.data;
    if (!SELL_FEE_ON_OUTPUT || !feeDataReady) return curveQuote.data;
    const denom = BigInt(bpsDenom.data);
    const fee = BigInt(feeBps.data);
    return (curveQuote.data * (denom - fee)) / denom;
  }, [curveQuote.data, side, feeDataReady, feeBps.data, bpsDenom.data]);

  const usingFallback = !curveIsDeployed || Boolean(curveQuote.error);
  const curveEstimatedOut = usingFallback
    ? estimateLocally(token, side, parsedAmount)
    : netQuoteData
    ? Number(formatUnits(netQuoteData, side === "buy" ? tokenDecimals : pairDecimals))
    : 0;

  const dexSwap = usePostGraduationSwap({
    token,
    side,
    amountWei,
    address,
    pairIsNative,
    graduated: isGraduated,
    slippage,
    tokenDecimals,
    pairDecimals,
  });

  const allowance = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address ?? zeroAddress, token.curveAddress],
    query: {
      enabled: Boolean(address) && curveIsDeployed && side === "sell" && !isGraduated
    },
  });

  const isActive = isGraduated ? dexSwap.enabled : curveIsDeployed;
  const estimatedOut = isGraduated ? dexSwap.estimatedOut : curveEstimatedOut;
  const isQuoting = isGraduated ? dexSwap.isQuoting : (parsedAmount > 0 && curveIsDeployed && !quoteReady);
  const needsApproval = isGraduated ? dexSwap.needsApproval : (
    side === "sell" &&
    amountWei > 0n &&
    allowance.data !== undefined &&
    allowance.data < amountWei
  );

  const {
    sendTransaction: sendApproveCurve,
    data: approveHashCurve,
    isPending: isApprovePendingCurve,
    error: approveErrorCurve,
  } = useSendTransaction();
  const { isLoading: isApproveConfirmingCurve, isSuccess: isApproveConfirmedCurve } =
    useWaitForTransactionReceipt({ hash: approveHashCurve });

  useEffect(() => {
    if (isApproveConfirmedCurve) allowance.refetch();
  }, [isApproveConfirmedCurve]);

  function approveCurve() {
    if (!curveIsDeployed || amountWei === 0n || isGraduated) return;
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [token.curveAddress, maxUint256],
    });
    sendApproveCurve({ to: token.address, data });
  }

  const { sendTransaction: sendCurveTx, data: curveHash, isPending: isCurvePending, error: curveError } = useSendTransaction();
  const { isLoading: isCurveConfirming, isSuccess: isCurveConfirmed } = useWaitForTransactionReceipt({
    hash: curveHash,
  });

  function submitCurve() {
    if (!curveIsDeployed || amountWei === 0n || isGraduated) return;
    if (!quoteReady || !netQuoteData) return;

    const isBuy = side === "buy";
    const minOut =
      netQuoteData && netQuoteData > 0n
        ? (netQuoteData * BigInt(Math.round((100 - slippage) * 100))) / 10000n
        : 0n;

    const data = encodeFunctionData({
      abi: BONDING_CURVE_ABI,
      functionName: isBuy ? "buy" : "sell",
      args: [amountWei, minOut],
    });

    sendCurveTx({
      to: token.curveAddress,
      data: data,
      value: isBuy ? amountWei : 0n,
    });
  }

  function submit() {
    if (isGraduated) {
      dexSwap.submit();
    } else {
      submitCurve();
    }
  }

  function approve() {
    if (isGraduated) {
      dexSwap.approve();
    } else {
      approveCurve();
    }
  }

  const isPending = isGraduated ? dexSwap.isPending : isCurvePending;
  const isConfirming = isGraduated ? dexSwap.isConfirming : isCurveConfirming;
  const isConfirmed = isGraduated ? dexSwap.isConfirmed : isCurveConfirmed;
  const error = isGraduated ? dexSwap.error : curveError;
  const approveError = isGraduated ? dexSwap.approveError : approveErrorCurve;
  const isApprovePending = isGraduated ? dexSwap.isApprovePending : isApprovePendingCurve;
  const isApproveConfirming = isGraduated ? dexSwap.isApproveConfirming : isApproveConfirmingCurve;

  useEffect(() => {
    if (isCurveConfirmed && onTradeConfirmed) {
      const t = setTimeout(() => onTradeConfirmed(), 4000);
      return () => clearTimeout(t);
    }
  }, [isCurveConfirmed, onTradeConfirmed]);

  useEffect(() => {
    if (dexSwap.isConfirmed && onTradeConfirmed) {
      const t = setTimeout(() => onTradeConfirmed(), 4000);
      return () => clearTimeout(t);
    }
  }, [dexSwap.isConfirmed, onTradeConfirmed]);

  function setPercent(pct) {
    const bal = spendBalance.data;
    if (!bal?.value) return;
    const rawAmount = (bal.value * BigInt(pct)) / 100n;
    setAmount(rawAmount > 0n ? formatUnits(rawAmount, bal.decimals) : "");
  }

  const spendSymbol = side === "buy" ? token.pairSymbol : token.symbol;
  const receiveSymbol = side === "buy" ? token.symbol : token.pairSymbol;

  return (
    <div className="rounded-xl2 bg-surface border border-border p-4 transition-colors">
      <div className="mb-3">
        {isGraduated ? (
          <div className="flex items-center justify-between text-xs bg-up/10 text-up px-3 py-1.5 rounded-lg border border-up/20">
            <span className="font-semibold">✅ Trading on DEX</span>
            {token.dexPairAddress && (
              <span className="font-mono text-[10px] opacity-80">
                Pair: {token.dexPairAddress.slice(0,6)}...{token.dexPairAddress.slice(-4)}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs bg-indigo-soft text-indigo px-3 py-1.5 rounded-lg border border-indigo/20">
            <span className="font-semibold">🔄 Bonding Curve</span>
            <span className="opacity-80">
              {token.bondingProgressPct?.toFixed(1)}% to graduation
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 bg-surface-alt rounded-xl p-1 mb-4">
        <button
          onClick={() => setSide("buy")}
          className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
            side === "buy" ? "bg-surface text-up shadow-sm" : "text-ink-faint hover:text-ink-soft"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
            side === "sell" ? "bg-surface text-down shadow-sm" : "text-ink-faint hover:text-ink-soft"
          }`}
        >
          Sell
        </button>
      </div>

      <div className="rounded-xl border border-border p-3 mb-2 bg-surface">
        <div className="flex items-center justify-between text-xs text-ink-faint mb-1.5">
          <span>You pay</span>
          {address && (
            <span className="font-mono">
              {spendBalance.data ? Number(spendBalance.data.formatted).toFixed(4) : "0"}{" "}
              {spendSymbol} available
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            inputMode="decimal"
            className="w-full bg-transparent text-2xl font-display font-medium text-ink outline-none placeholder:text-ink-faint/60"
          />
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-sm font-semibold text-ink">
            {spendSymbol}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            onClick={() => setPercent(pct)}
            className="rounded-lg bg-surface-alt hover:bg-border-strong/30 py-1.5 text-xs font-semibold text-ink-soft transition-colors"
          >
            {pct}%
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-surface-alt/60 p-3 mb-3">
        <div className="flex items-center justify-between text-xs text-ink-faint mb-1">
          <span>You receive (estimated)</span>
          {isGraduated && dexSwap.quoteError && (
            <span className="text-down">⚠️ Quote error</span>
          )}
        </div>
        <p className="font-mono text-lg font-medium text-ink tabular">
          {estimatedOut ? estimatedOut.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "0"}{" "}
          <span className="text-sm text-ink-soft">{receiveSymbol}</span>
        </p>
        {usingFallback && parsedAmount > 0 && !isQuoting && !isGraduated && (
          <p className="text-[11px] text-ink-faint mt-1">
            Demo estimate — connect a deployed curve address to quote on-chain.
          </p>
        )}
        {isQuoting && (
          <p className="text-[11px] text-ink-faint mt-1">
            {isGraduated ? "Fetching DEX quote…" : "Fetching on-chain quote…"}
          </p>
        )}
      </div>

      <button
        onClick={() => setShowSlippage((s) => !s)}
        className="flex items-center gap-1.5 text-xs font-medium text-ink-soft mb-3 hover:text-ink transition-colors"
      >
        <Settings2 size={13} />
        Slippage {slippage}% · Adjust
      </button>
      {showSlippage && (
        <div className="flex items-center gap-1.5 mb-3">
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                slippage === s ? "bg-ink text-canvas" : "bg-surface-alt text-ink-soft hover:bg-border-strong/30"
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      )}

      {!isConnected ? (
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              onClick={openConnectModal}
              className="w-full rounded-xl bg-lime hover:bg-lime-dark text-lime-ink font-semibold py-3 transition-colors shadow-sm"
            >
              Connect wallet
            </button>
          )}
        </ConnectButton.Custom>
      ) : needsApproval ? (
        <button
          onClick={approve}
          disabled={isApprovePending || isApproveConfirming}
          className="w-full rounded-xl bg-lime hover:bg-lime-dark disabled:opacity-40 disabled:cursor-not-allowed text-lime-ink font-semibold py-3 transition-colors shadow-sm"
        >
          {isApprovePending || isApproveConfirming
            ? "Approving…"
            : `Approve ${isGraduated ? token.pairSymbol : token.symbol}`}
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={
            !isActive ||
            parsedAmount === 0 ||
            isPending ||
            isConfirming ||
            (isGraduated ? !dexSwap.ready : !quoteReady)
          }
          className="w-full rounded-xl bg-lime hover:bg-lime-dark disabled:opacity-40 disabled:cursor-not-allowed text-lime-ink font-semibold py-3 transition-colors shadow-sm"
        >
          {isPending || isConfirming
            ? "Confirming…"
            : !isActive
            ? isGraduated ? "DEX not ready" : "Curve not deployed"
            : isQuoting
            ? "Fetching quote…"
            : side === "buy"
            ? `Buy ${token.symbol}${isGraduated ? " (DEX)" : ""}`
            : `Sell ${token.symbol}${isGraduated ? " (DEX)" : ""}`}
        </button>
      )}

      {isConfirmed && (
        <p className="text-xs text-up font-medium mt-2 text-center">
          Trade confirmed {isGraduated ? "on DEX" : "on curve"}.
        </p>
      )}
      {error && (
        <div className="text-xs text-down font-medium mt-2 text-center">
          <p>{error.shortMessage || error.message || "Transaction failed."}</p>
          {error.details && (
            <p className="text-ink-faint text-[10px] mt-1">{error.details}</p>
          )}
        </div>
      )}
      {approveError && (
        <div className="text-xs text-down font-medium mt-2 text-center">
          <p>{approveError.shortMessage || approveError.message || "Approval failed."}</p>
        </div>
      )}
    </div>
  );
}
