// check-pending-rewards.mjs
// Jalankan: node check-pending-rewards.mjs <curveAddress> <walletAddress>
//
// Baca pendingCreatorClaim/pendingCashback LANGSUNG dari kontrak, tanpa
// lewat backend/DB sama sekali — buat mastiin apakah on-chain-nya beneran
// 0, atau backend/ABI kamu yang gagal baca.

import { createPublicClient, http } from "viem";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545"; // ganti sesuai .env kamu
const [, , curveAddress, walletAddress] = process.argv;

if (!curveAddress) {
  console.error("Usage: node check-pending-rewards.mjs <curveAddress> [walletAddress]");
  process.exit(1);
}

// ABI minimal — cuma dua getter ini yang kita butuh buat tes ini.
const MINI_ABI = [
  {
    type: "function",
    name: "pendingCreatorClaim",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingCashback",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "creator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
];

const client = createPublicClient({ transport: http(RPC_URL) });

async function main() {
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Curve: ${curveAddress}`);

  try {
    const creatorAddr = await client.readContract({
      address: curveAddress,
      abi: MINI_ABI,
      functionName: "creator",
    });
    console.log(`Creator on-chain : ${creatorAddr}`);
  } catch (err) {
    console.log(`(gagal baca creator() — mungkin bukan masalah, lanjut) ${err.shortMessage || err.message}`);
  }

  try {
    const pendingCreator = await client.readContract({
      address: curveAddress,
      abi: MINI_ABI,
      functionName: "pendingCreatorClaim",
    });
    console.log(`pendingCreatorClaim() = ${pendingCreator.toString()} wei`);
  } catch (err) {
    console.error(`❌ GAGAL baca pendingCreatorClaim(): ${err.shortMessage || err.message}`);
    console.error(`   -> Kemungkinan besar ABI di backend kamu juga akan gagal dengan cara yang sama.`);
  }

  if (walletAddress) {
    try {
      const pendingCashback = await client.readContract({
        address: curveAddress,
        abi: MINI_ABI,
        functionName: "pendingCashback",
        args: [walletAddress],
      });
      console.log(`pendingCashback(${walletAddress}) = ${pendingCashback.toString()} wei`);
    } catch (err) {
      console.error(`❌ GAGAL baca pendingCashback(): ${err.shortMessage || err.message}`);
    }
  }
}

main();
