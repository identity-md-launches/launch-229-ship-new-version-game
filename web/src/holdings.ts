import { createPublicClient, erc20Abi, fallback, http, type Address, type PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
// Read-only Ethereum mainnet holdings for the scene's wallet dropdown and chips; play stays on Sepolia.
export const MAINNET_RPCS=['https://ethereum-rpc.publicnode.com','https://1rpc.io/eth','https://eth.drpc.org'];
// $ICE "Initial Compute Event" and $IMD "Identity.md"; both use 18 decimals (checked on-chain 2026-09-27).
export const MAINNET_TOKENS={ice:'0x64914921E03069dA66823F84fFcfB9931F05281A',imd:'0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7'} as const satisfies Record<string,Address>;
export const MAINNET_DECIMALS=18;
export type Holdings={eth?:bigint;ice?:bigint;imd?:bigint};
type Reader=Pick<PublicClient,'getBalance'|'readContract'>;
let shared:Reader|undefined;
const mainnetClient=():Reader=>shared??=createPublicClient({chain:mainnet,transport:fallback(MAINNET_RPCS.map(url=>http(url,{timeout:10000,retryCount:1})))});
// A failed read leaves only its own field undefined; holdings never block play.
export async function readHoldings(address:Address,client:Reader=mainnetClient()):Promise<Holdings> {
 const token=(k:'ice'|'imd')=>client.readContract({address:MAINNET_TOKENS[k],abi:erc20Abi,functionName:'balanceOf',args:[address]});
 const results=await Promise.allSettled([client.getBalance({address}),token('ice'),token('imd')]);
 const holdings:Holdings={};
 (['eth','ice','imd'] as const).forEach((field,i)=>{const r=results[i];if(r.status==='fulfilled')holdings[field]=r.value;else console.warn('mainnet holdings read failed',{field,error:r.reason instanceof Error?r.reason.message.split('\n')[0]:String(r.reason)});});
 return holdings;
}
export type HoldingsView={eth:string;ice:string;imd:string};
// Scene display strings: "—" disconnected, "…" loading, "?" failed read, else up to 4 decimals (truncated, en-US) as in the scene's own wallet.
export function showHoldings(holdings:Holdings|'loading'|undefined):HoldingsView {
 if(!holdings)return {eth:'—',ice:'—',imd:'—'};
 if(holdings==='loading')return {eth:'…',ice:'…',imd:'…'};
 const base=10n**BigInt(MAINNET_DECIMALS);
 const show=(v?:bigint)=>{if(v===undefined)return '?';const frac=(v%base*10000n/base).toString().padStart(4,'0').replace(/0+$/,'');return (v/base).toLocaleString('en-US')+(frac?'.'+frac:'');};
 return {eth:show(holdings.eth),ice:show(holdings.ice),imd:show(holdings.imd)};
}
