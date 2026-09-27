import { encodeAbiParameters, encodeFunctionData, encodePacked, keccak256, parseAbi, parseAbiParameters, type Address, type Hex } from 'viem';
import type { Deployment } from './config';
import { POOL, walletAddChain } from './chain.mjs';
export const poolTuple='(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)';
export const quoterAbi=parseAbi([`function quoteExactInputSingle((${poolTuple} poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)`]);
export const routerAbi=parseAbi(['function execute(bytes commands,bytes[] inputs,uint256 deadline) payable']);
export const permitAbi=parseAbi(['function allowance(address user,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)','function approve(address token,address spender,uint160 amount,uint48 expiration)']);
export const delegationManagerAbi=parseAbi(['function redeemDelegations(bytes[] permissionContexts,bytes32[] modes,bytes[] executionCallDatas)']);
export const MAX_UINT160=(1n<<160n)-1n;export const MAX_UINT48=(1n<<48n)-1n;
export const SINGLE_DEFAULT_MODE=`0x${'00'.repeat(32)}` as Hex;
// One ERC-7715 redemption: a single execution (target, value, calldata) under the grant's permission context.
export function encodeRedeem(context:Hex,target:Address,value:bigint,callData:Hex) {
 return encodeFunctionData({abi:delegationManagerAbi,functionName:'redeemDelegations',args:[[context],[SINGLE_DEFAULT_MODE],[encodePacked(['address','uint256','bytes'],[target,value,callData])]]});
}
export const stateAbi=parseAbi(['function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)','function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)']);
export function poolKey(d:Deployment) {
 const token=d.contracts.find(c=>c.name==='PepeIce')!.address;
 const currencies=[POOL.pairedCurrency as Address,token].sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()));
 return {currency0:currencies[0],currency1:currencies[1],fee:POOL.fee,tickSpacing:POOL.tickSpacing,hooks:d.contracts.find(c=>c.name==='JackpotHook')!.address};
}
export type PoolKey=ReturnType<typeof poolKey>;
export function poolId(key:PoolKey) { return keccak256(encodeAbiParameters(parseAbiParameters(poolTuple),[key])); }
export function playerData(player:Address) { return encodeAbiParameters([{type:'address'}],[player]); }
export function swapInput(key:PoolKey,zeroForOne:boolean,amountIn:bigint,minimum:bigint,player:Address) {
 const params=[encodeAbiParameters(parseAbiParameters(`(${poolTuple} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`),[{poolKey:key,zeroForOne,amountIn,amountOutMinimum:minimum,hookData:playerData(player)}]),
 encodeAbiParameters(parseAbiParameters('address,uint256'),[zeroForOne?key.currency0:key.currency1,amountIn]),
 encodeAbiParameters(parseAbiParameters('address,uint256'),[zeroForOne?key.currency1:key.currency0,minimum])];
 return encodeAbiParameters(parseAbiParameters('bytes,bytes[]'),['0x060c0f',params]);
}
export function rollFor(hash:Hex,id:Hex,ticket:bigint) { return Number(BigInt(keccak256(encodeAbiParameters(parseAbiParameters('bytes32,bytes32,uint256'),[hash,id,ticket])))%100n)+1; }
export function isWin(roll:number) { return roll===77 || [20,40,60,80,100].includes(roll); }
export function drawWindow(ticketBlock:bigint,current:bigint) { return current<=ticketBlock+1n?'waiting':current>ticketBlock+256n?'expired':'ready'; }
export function minimumOut(quote:bigint,bps:number) { if(!Number.isInteger(bps)||bps<10||bps>500) throw Error('Choose slippage from 0.1% to 5%.'); return quote*BigInt(10000-bps)/10000n; }
export const rejected=(error:unknown)=>{const e=error as {code?:number;message?:string};return e?.code===4001 || /reject|denied/i.test(e?.message||'');};
export function errorMessage(error:unknown):string {
 const e=error as {code?:number;shortMessage?:string;message?:string;cause?:unknown};
 if(rejected(error)) return 'Wallet said no. Nothing spent; try again when ready.';
 return (e?.shortMessage||e?.message||'The chain did not answer. Try refresh.').slice(0,240);
}
export async function switchNetwork(provider:{request:(arg:{method:string;params?:unknown[]})=>Promise<unknown>},d:Deployment) {
 const chain=walletAddChain(d.network);
 const params=[{chainId:chain.chainId}];
 try { await provider.request({method:'wallet_switchEthereumChain',params}); }
 catch(e) {
  const err=e as {code?:number;message?:string;data?:{originalError?:{code?:number}}};
  if(err.code!==4902 && err.data?.originalError?.code!==4902 && !/unknown chain|unrecognized chain|chain.*not.*added/i.test(err.message||'')) throw e;
  await provider.request({method:'wallet_addEthereumChain',params:[chain]});
  await provider.request({method:'wallet_switchEthereumChain',params});
 }
}
