import { useEffect, useMemo } from "react";
import { useChainId, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { encodeFunctionData, formatUnits, zeroAddress, maxUint256 } from "viem";
import {
  BONDING_CURVE_ABI,
  ERC20_ABI,
  REWARD_ROUTER_ABI,
  REWARD_ROUTER_ADDRESS,
  UNISWAP_V2_ROUTER_ABI,
} from "../config/contracts";

const DEADLINE_SECONDS = 600; // 10 minutes, standard router convention

/// @notice Everything needed to trade a GRADUATED token through RewardRouter
/// (which itself swaps against the DEX pool _graduate() seeded, but skims
/// the same 2%/1%/0.5%/0.5% fee BondingCurve used pre-graduation and tops up
/// the SAME pendingCreatorClaim/pendingCashback balances - see
/// RewardRouter.sol + the depositCreatorFee()/depositCashback() additions
/// on BondingCurve.sol).
///
/// IMPORTANT: this hook never sends a swap transaction to the raw DEX
/// router. Doing that would still technically execute (the pool doesn't
/// care who calls it), but skips the fee-skim entirely - creator/cashback
/// would get nothing from that trade. The DEX router is only ever read from
/// here (getAmountsOut/WETH) to build an off-chain quote; RewardRouter is
/// the sole target for both `approve` and the actual swap.
///
/// Entirely no-ops when `graduated` is false — every internal read/write is
/// gated on `enabled`, so calling this hook unconditionally in TradePanel
/// (required by the rules of hooks) costs nothing while a curve is still
/// active.
///
/// Mirrors the shape of TradePanel's own curve-trading state (estimatedOut,
/// needsApproval/approve, submit, isPending/isConfirming/isConfirmed, error)
/// on purpose, so swapping between "curve mode" and "dex mode" in the UI is
/// just picking which object's fields to read — no separate render branches
/// needed beyond that. This shape is UNCHANGED from before, so TradePanel.jsx
/// does not need any edits for this fix.
export function usePostGraduationSwap({
  token,
  side, // "buy" | "sell"
  amountWei, // BigInt already parsed by the caller (pair decimals for buy, token decimals for sell)
  address, // connected wallet address
  pairIsNative,
  graduated,
  slippage, // percent, e.g. 1 = 1%
  tokenDecimals = 18,
  pairDecimals,
}) {
  const chainId = useChainId();
  const rewardRouterAddress = REWARD_ROUTER_ADDRESS[chainId];
  const rewardRouterReady = Boolean(rewardRouterAddress) && rewardRouterAddress !== zeroAddress;

  const enabled = Boolean(graduated) && Boolean(token?.curveAddress);

  // `router` (the underlying DEX router, e.g. PancakeSwap) is public
  // immutable on the curve itself (BondingCurve.sol) — reading it from
  // there is the single source of truth instead of duplicating the router
  // address anywhere in frontend config. Only used for QUOTING here
  // (getAmountsOut/WETH); the swap itself always targets rewardRouterAddress.
  const routerRead = useReadContract({
    address: token?.curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "router",
    query: { enabled },
  });
  const routerAddress = routerRead.data;

  // Fee ratio, read live from the curve so this stays correct even if a
  // future BondingCurve deployment changes the split — RewardRouter itself
  // does the exact same live read on-chain (see _routeFee() there), this is
  // purely so the UI's off-chain quote/minOut agree with what the contract
  // will actually enforce.
  const feeBps = useReadContract({
    address: token?.curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "FEE_BPS",
    query: { enabled },
  });
  const bpsDenom = useReadContract({
    address: token?.curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "BPS_DENOM",
    query: { enabled },
  });
  const feeDataReady = feeBps.data !== undefined && bpsDenom.data !== undefined;

  const wethRead = useReadContract({
    address: routerAddress,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "WETH",
    query: { enabled: enabled && Boolean(routerAddress) && pairIsNative },
  });

  const tokenIn = useMemo(() => {
    if (side === "buy") return pairIsNative ? wethRead.data : token?.pairTokenAddress;
    return token?.address;
  }, [side, pairIsNative, wethRead.data, token?.pairTokenAddress, token?.address]);

  const tokenOut = useMemo(() => {
    if (side === "buy") return token?.address;
    return pairIsNative ? wethRead.data : token?.pairTokenAddress;
  }, [side, pairIsNative, wethRead.data, token?.pairTokenAddress, token?.address]);

  const path = useMemo(() => {
    if (!tokenIn || !tokenOut) return undefined;
    return [tokenIn, tokenOut];
  }, [tokenIn, tokenOut]);

  const pathReady = Boolean(path) && (!pairIsNative || Boolean(wethRead.data));

  // BUY: RewardRouter skims the fee from amountIn BEFORE it ever reaches the
  // DEX, so the amount that actually gets swapped is (amountIn - fee) — quote
  // with THAT, not the raw amountWei, or the estimate shown to the user would
  // overstate what they actually receive (same class of bug as quoteBuy()
  // pre-graduation needing pairInAfterFee).
  //
  // SELL: RewardRouter swaps the FULL tokensIn first, then skims the fee from
  // the DEX's gross output afterward — so quote with the raw amountWei, then
  // subtract the fee from the quoted result below.
  const swapQuoteAmount = useMemo(() => {
    if (!feeDataReady || amountWei === 0n) return 0n;
    if (side === "sell") return amountWei;
    const denom = BigInt(bpsDenom.data);
    const fee = BigInt(feeBps.data);
    return (amountWei * (denom - fee)) / denom;
  }, [side, amountWei, feeDataReady, feeBps.data, bpsDenom.data]);

  const quote = useReadContract({
    address: routerAddress,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [swapQuoteAmount, path],
    query: {
      enabled: enabled && Boolean(routerAddress) && pathReady && swapQuoteAmount > 0n && feeDataReady,
    },
  });

  const outDecimals = side === "buy" ? tokenDecimals : pairDecimals;
  const rawQuoteOut = quote.data ? quote.data[quote.data.length - 1] : undefined;

  // For sell, the DEX quote above is GROSS — apply the same fee RewardRouter
  // will actually deduct on-chain so the estimate matches what the user
  // really receives.
  const netAmountOut = useMemo(() => {
    if (!rawQuoteOut) return rawQuoteOut;
    if (side === "buy" || !feeDataReady) return rawQuoteOut;
    const denom = BigInt(bpsDenom.data);
    const fee = BigInt(feeBps.data);
    return rawQuoteOut - (rawQuoteOut * fee) / denom;
  }, [rawQuoteOut, side, feeDataReady, feeBps.data, bpsDenom.data]);

  const estimatedOut = netAmountOut ? Number(formatUnits(netAmountOut, outDecimals)) : 0;

  // Only the buy+native-pair case spends raw ETH directly (as msg.value) —
  // every other case (sell, or any ERC20-pair buy) spends an ERC20 that
  // RewardRouter needs to pull via transferFrom, so it needs an approval.
  // NOTE the approval target is RewardRouter, never the raw DEX router —
  // approving the DEX router directly would do nothing for a swap that's
  // actually sent to RewardRouter.
  const spendIsNative = side === "buy" && pairIsNative;
  const spendTokenAddress = spendIsNative ? null : tokenIn;

  const allowance = useReadContract({
    address: spendTokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address ?? zeroAddress, rewardRouterAddress ?? zeroAddress],
    query: {
      enabled:
        enabled &&
        rewardRouterReady &&
        !spendIsNative &&
        Boolean(spendTokenAddress) &&
        Boolean(address),
    },
  });

  const needsApproval =
    enabled &&
    rewardRouterReady &&
    !spendIsNative &&
    amountWei > 0n &&
    allowance.data !== undefined &&
    allowance.data < amountWei;

  const {
    sendTransaction: sendApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
  } = useSendTransaction();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveHash });

  useEffect(() => {
    if (isApproveConfirmed) allowance.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveConfirmed]);

  function approve() {
    // Approve maxUint256 (infinite allowance) once, so needsApproval only
    // trips the very first time this wallet trades this token post-
    // graduation — every swap after that skips approval entirely.
    // (Previously guarded on `maxUint256 === 0n`, which can never be true
    // since maxUint256 is a fixed nonzero constant — that check was dead
    // code and never actually blocked anything. The real guard we want
    // here is against a zero/empty amount, same as curve mode's approve.)
    if (!spendTokenAddress || !rewardRouterReady || amountWei === 0n) return;
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [rewardRouterAddress, maxUint256],
    });
    sendApprove({ to: spendTokenAddress, data });
  }

  const { sendTransaction: sendSwap, data: swapHash, isPending, error } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  function submit() {
    if (!enabled || !rewardRouterReady || !path || amountWei === 0n || !netAmountOut) return;

    // Slippage floor applies to the NET amount the trader actually receives
    // (already fee-adjusted above), matching how BondingCurve's own
    // buy()/sell() slippage checks work pre-graduation.
    const minOut = (netAmountOut * BigInt(Math.round((100 - slippage) * 100))) / 10000n;

    if (side === "buy") {
      const data = encodeFunctionData({
        abi: REWARD_ROUTER_ABI,
        functionName: "buyWithReward",
        args: [token.curveAddress, amountWei, minOut, address],
      });
      sendSwap({
        to: rewardRouterAddress,
        data,
        value: spendIsNative ? amountWei : 0n,
      });
    } else {
      const data = encodeFunctionData({
        abi: REWARD_ROUTER_ABI,
        functionName: "sellWithReward",
        args: [token.curveAddress, amountWei, minOut, address],
      });
      sendSwap({ to: rewardRouterAddress, data, value: 0n });
    }
  }

  const isQuoting = enabled && amountWei > 0n && !quote.data && !quote.error;
  const ready = enabled && rewardRouterReady && pathReady && Boolean(routerAddress) && Boolean(netAmountOut);

  return {
    enabled,
    estimatedOut,
    isQuoting,
    ready,
    quoteError: quote.error,
    needsApproval,
    approve,
    isApprovePending,
    isApproveConfirming,
    approveError,
    submit,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}
