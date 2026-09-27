// imd-deployment.json follows IMD's version 1 schema, which refuses keys it does not define.
// Anything else the release needs is derived here instead of being shipped in that file.
export const MANIFEST_KEYS = ['version', 'launchId', 'chainId', 'sourceCommit', 'attestationHash', 'contracts', 'assets', 'network'];

// The launch policy's pool: native ETH against ICE, fee 3000, tick spacing 60 (see launch.json).
export const POOL = { pairedCurrency: '0x0000000000000000000000000000000000000000', fee: 3000, tickSpacing: 60 };

// ERC-7715 grants on Sepolia are redeemed through MetaMask's Delegation Framework DelegationManager.
export const DELEGATION_MANAGER = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3';

// Background play policy as decimal strings: refill chunks, gas kept back for the next move,
// daily auto-refill caps (period in seconds, grant length in days) and the panel presets.
export const SESSION = { ethChunk: '0.005', iceChunk: '1000', gasReserve: '0.002', refillEth: '0.02', refillIce: '10000',
  refillPeriod: 86400, refillDays: 7, topUps: ['0.005', '0.01', '0.05'], iceMoves: ['1000', '10000'] };

// EIP-3085 parameters for wallet_addEthereumChain, built from the deployment's network block.
export function walletAddChain(network) {
  return { chainId: `0x${network.chainId.toString(16)}`, chainName: network.name, rpcUrls: network.rpcUrls,
    nativeCurrency: network.nativeCurrency, blockExplorerUrls: [network.explorer] };
}
