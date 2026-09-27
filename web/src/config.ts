import { type Abi, type Address, createPublicClient, defineChain, fallback, http, keccak256, toBytes, isAddress } from 'viem';
import { canonical } from './canonical.mjs';
import { MANIFEST_KEYS } from './chain.mjs';
export interface Deployment {
 version:1; launchId:string; chainId:number; sourceCommit:string; attestationHash:string;
 contracts:{name:string; address:Address; abiHash:string; abiPath:string}[];
 assets:{path:string;sha256:string}[];
 network:{chainId:number; name:string; testnet:boolean; rpcUrls:string[]; explorer:string; nativeCurrency:{name:string;symbol:string;decimals:number}; faucets:string[]; uniswapV4:Record<'poolManager'|'universalRouter'|'quoter'|'stateView'|'positionManager'|'permit2',Address>};
}
export function safePath(path:string) { return /^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith('/') && !path.split('/').includes('..'); }
export async function loadDeployment() {
 const response=await fetch('./imd-deployment.json',{cache:'no-cache'});
 if(!response.ok) throw Error('Deployment file unavailable. Reload this release.');
 const d=await response.json() as Deployment;
 if(Object.keys(d).sort().join()!==[...MANIFEST_KEYS].sort().join()) throw Error('Deployment file does not match version 1.');
 if(d.version!==1 || d.chainId!==d.network?.chainId || !d.network.testnet) throw Error('Deployment network binding is invalid.');
 if(d.contracts.length!==2 || !['PepeIce','JackpotHook'].every(name=>d.contracts.some(c=>c.name===name))) throw Error('Incomplete deployment.');
 const abis:Record<string,Abi>={};
 for(const c of d.contracts) {
  if(!isAddress(c.address) || !safePath(c.abiPath)) throw Error('Invalid contract binding.');
  const r=await fetch(`./${c.abiPath}`); if(!r.ok) throw Error('ABI unavailable.');
  const abi=await r.json();
  if(!Array.isArray(abi) || keccak256(toBytes(canonical(abi))).slice(2)!==c.abiHash) throw Error(`ABI verification failed: ${c.name}`);
  abis[c.name]=abi;
 }
 const chain=defineChain({id:d.chainId,name:d.network.name,nativeCurrency:d.network.nativeCurrency,rpcUrls:{default:{http:d.network.rpcUrls}},blockExplorers:{default:{name:d.network.name,url:d.network.explorer}},testnet:d.network.testnet});
 const transport=fallback(d.network.rpcUrls.map(url=>http(url,{timeout:10000,retryCount:1})));
 const client=createPublicClient({chain,transport,batch:{multicall:false}});
 return {d,abis,chain,client,transport};
}
export type Runtime=Awaited<ReturnType<typeof loadDeployment>>;
