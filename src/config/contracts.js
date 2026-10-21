// Deployed addresses per chain id.
export const LAUNCHPAD_FACTORY_ADDRESS = {
  677: "0xF746c8a165d6E96070bDe2A0353a5040700907df",
  968: "0xC6Ca0604aa13f08478435801010cC8bbBF417aF2",
  11155111: "0x73C98555cEd0d331D7B94f7B1eCd2cbF617D068d",
};

export const REWARD_ROUTER_ADDRESS = {
  677: "0xc4fFE53C82028C2Bb775AC3EEC48a10D79143f9C",
  968: "0xA447a62FF52D22D3D496532C9CB2c30a6d9155AA",
  11155111: "0xF746c8a165d6E96070bDe2A0353a5040700907df",
};

// config/contracts.js
export const PAIR_TOKEN_ADDRESSES = {
  // Native wrapped pair — MUST equal router.WETH() for the chain.
  ETH: {
    1:        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // Ethereum mainnet WETH
    11155111: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",  // Sepolia WETH
  },
  USDC: {
    1:        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  // Ethereum mainnet USDC
    11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",  // Sepolia USDC
  },
  SUPRA: {
    // Deploy a dummy ERC20 on Sepolia for testing, or use real SUPRA on
    // mainnet once you've verified the address from an official source.
    11155111: "<alamat-token-dummy-SUPRA-di-Sepolia>",
  },
  // Legacy BOT chain entries — keep if you still support that chain.
  BOT: {
    677: "0xD5452816194a3784dBa983426cCe7c122F4abd30",
    968: "0xD5452816194a3784dBa983426cCe7c122F4abd30",
  },
};

export const LAUNCHPAD_FACTORY_ABI = [
  // Launch fee is now a mutable state var (uint256 public launchFee),
  // default 0 — was previously a `LAUNCH_FEE` constant of 0.1 ether.
  // Read dynamically: `factory.launchFee()`.
  {
    type: "function",
    name: "launchFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MAX_LAUNCH_FEE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setLaunchFee",
    stateMutability: "nonpayable",
    inputs: [{ name: "newFee", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "LaunchFeeUpdated",
    inputs: [
      { name: "oldFee", type: "uint256", indexed: false },
      { name: "newFee", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    // rewardMode added as 5th param (before devBuyMinTokensOut).
    // Pass 0 = Creator mode (1% reward → creator) or 1 = Cashback mode (1% reward → traders).
    type: "function",
    name: "launch",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "pairToken", type: "address" },
      { name: "virtualPairReserve", type: "uint256" },
      { name: "rewardMode", type: "uint8" },
      { name: "devBuyMinTokensOut", type: "uint256" },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
    ],
  },
  {
    type: "function",
    name: "TOKENS_FOR_LIQUIDITY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "TOKENS_FOR_SALE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "TOTAL_SUPPLY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "VIRTUAL_TOKEN_RESERVE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "antiSnipeEnabled",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "claimPlatformFees",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "curveOfToken",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "feeRecipient",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "launches",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
      { name: "pairToken", type: "address" },
      { name: "creator", type: "address" },
      { name: "antiSnipeEnabled", type: "bool" },
      { name: "rewardMode", type: "uint8" },     // NEW
      { name: "createdAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "launchesCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "renounceOwnership",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "router",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setAntiSnipeEnabled",
    stateMutability: "nonpayable",
    inputs: [{ name: "enabled", type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    name: "transferOwnership",
    stateMutability: "nonpayable",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
  },
  // Launched event (with rewardMode as last field) — needed for
  // LaunchPage.jsx's receipt decoding.
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
      { name: "rewardMode", type: "uint8", indexed: false },      // NEW
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AntiSnipeToggled",
    inputs: [{ name: "enabled", type: "bool", indexed: false }],
    anonymous: false,
  },
  {
    type: "event",
    name: "PlatformFeesClaimed",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
];

export const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

export const BONDING_CURVE_ABI = [
  {
    type: "function",
    name: "ANTI_SNIPE_MAX_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "ANTI_SNIPE_WINDOW",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "BPS_DENOM",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  // CREATOR_FEE_BPS and CASHBACK_FEE_BPS were REMOVED — replaced by a
  // single REWARD_FEE_BPS that goes 100% to the destination chosen by
  // rewardMode (creator OR cashback, never split).
  {
    type: "function",
    name: "REWARD_FEE_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "FEE_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "PLATFORM_FEE_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  // 0 = Creator mode, 1 = Cashback mode. Immutable per curve.
  {
    type: "function",
    name: "rewardMode",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "antiSnipeEnabled",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [
      { name: "pairAmountIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
    ],
    outputs: [{ name: "tokensOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "buyFor",
    stateMutability: "payable",
    inputs: [
      { name: "pairAmountIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
      { name: "buyer", type: "address" },
    ],
    outputs: [{ name: "tokensOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimCashback",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimCreatorFees",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "creator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "graduateIfEligible",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "graduated",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "graduationThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "initialize",
    stateMutability: "nonpayable",
    inputs: [{ name: "_launchedToken", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "initialized",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isNativePair",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "launchedAt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "launchedToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "pairToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "pendingCashback",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingCreatorClaim",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteBuy",
    stateMutability: "view",
    inputs: [{ name: "pairInAfterFee", type: "uint256" }],
    outputs: [{ name: "tokensOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteSell",
    stateMutability: "view",
    inputs: [{ name: "tokensIn", type: "uint256" }],
    outputs: [{ name: "pairOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "realPairReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "router",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokensIn", type: "uint256" },
      { name: "minPairOut", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "tokensForLiquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokensForSale",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokensSold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "virtualPairReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "virtualTokenReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
];

export const REWARD_ROUTER_ABI = [
  {
    type: "function",
    name: "dexRouter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "trustedFactory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "buyWithReward",
    stateMutability: "payable",
    inputs: [
      { name: "curveAddress", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "sellWithReward",
    stateMutability: "nonpayable",
    inputs: [
      { name: "curveAddress", type: "address" },
      { name: "tokensIn", type: "uint256" },
      { name: "minPairOut", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "netOut", type: "uint256" }],
  },
];

export const UNISWAP_V2_ROUTER_ABI = [
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "WETH",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactETHForTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
];

export const UNISWAP_V2_FACTORY_ABI = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
];

export const UNISWAP_V2_PAIR_ABI = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
];
