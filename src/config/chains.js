// src/config/chains.js
import { defineChain } from 'viem';

// ============================================================
// BOT CHAIN MAINNET
// ============================================================
export const botChain = defineChain({
  id: 677,
  name: 'BOT Chain Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'BOT',
    symbol: 'BOT',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.botchain.ai'],
      webSocket: ['wss://rpc.botchain.ai'],
    },
    public: {
      http: ['https://rpc.botchain.ai'],
      webSocket: ['wss://rpc.botchain.ai'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BOT Chain Explorer',
      url: 'https://scan.botchain.ai',
    },
  },
  testnet: false,
});

// ============================================================
// BOT CHAIN TESTNET
// ============================================================
export const botChainTestnet = defineChain({
  id: 968,
  name: 'BOT Chain Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'BOT',
    symbol: 'BOT',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.bohr.life'],
      webSocket: ['wss://rpc.bohr.life'],
    },
    public: {
      http: ['https://rpc.bohr.life'],
      webSocket: ['wss://rpc.bohr.life'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BOT Chain Testnet Explorer',
      url: 'https://scan.bohr.life',
    },
  },
  testnet: true,
});

// ============================================================
// EXPORT SEMUA CHAIN
// ============================================================
export const supportedChains = [botChain];

// Helper untuk mendapatkan chain berdasarkan ID
export const getChainById = (id) => {
  return supportedChains.find(chain => chain.id === id);
};

// Helper untuk cek apakah chain didukung
export const isChainSupported = (id) => {
  return supportedChains.some(chain => chain.id === id);
};
