import { decodeAbiParameters, decodeFunctionData, getAddress, keccak256, parseAbiParameters, recoverMessageAddress, size, slice, type Abi, type Address, type Hex } from 'viem';
import { DELEGATION_MANAGER } from './chain.mjs';
import { delegationManagerAbi, permitAbi, playerData, poolId, poolTuple, routerAbi, SINGLE_DEFAULT_MODE, type PoolKey } from './protocol';
export type SessionContext={player:Address;session:Address;token:Address;hook:Address;permit2:Address;router:Address;key:PoolKey;tokenAbi:Abi;hookAbi:Abi};
const SECP256K1_N=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const same=(a:unknown,b:string)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
const sameKey=(a:PoolKey,b:PoolKey)=>same(a.currency0,b.currency0)&&same(a.currency1,b.currency1)&&same(a.hooks,b.hooks)&&Number(a.fee)===b.fee&&Number(a.tickSpacing)===b.tickSpacing;
export function sessionMessage(chainId:number,player:Address) {
 return `pepes armed with ai · session key v1\nChain: ${chainId}\nPlayer: ${getAddress(player)}\n\nSigning creates the game wallet that plays your background moves in this tab. It can only spend what you send it or allow it to pull. Only sign this on the pepes armed with ai arcade.`;
}
// The game wallet key is a hash of the player's deterministic signature: same wallet, same key, nothing stored.
export async function sessionKeyFromSignature(signature:Hex,message:string,player:Address):Promise<Hex> {
 const refused=Error('Session play needs a wallet that signs with a regular account key.');
 if(!/^0x[0-9a-fA-F]{130}$/.test(signature))throw refused;
 try{if(!same(await recoverMessageAddress({message,signature}),player))throw refused;}catch{throw refused;}
 let key=keccak256(signature);
 while(BigInt(key)===0n||BigInt(key)>=SECP256K1_N)key=keccak256(key);
 return key;
}
function allowed({to,data,value}:{to:Address;data:Hex;value:bigint},c:SessionContext) {
 if(same(to,c.player))return data==='0x';
 if(same(to,c.router)){
  const {functionName,args}=decodeFunctionData({abi:routerAbi,data});
  if(functionName!=='execute'||args[0]!=='0x10'||args[1].length!==1)return false;
  const [actions,params]=decodeAbiParameters(parseAbiParameters('bytes,bytes[]'),args[1][0]);
  if(actions!=='0x060c0f')return false;
  const [swap]=decodeAbiParameters(parseAbiParameters(`(${poolTuple} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`),params[0]);
  return sameKey(swap.poolKey,c.key)&&same(swap.hookData,playerData(c.player));
 }
 if(value!==0n)return false;
 if(same(to,c.token)){
  const {functionName,args}=decodeFunctionData({abi:c.tokenAbi,data});
  if(functionName==='approve')return same(args?.[0],c.permit2)||same(args?.[0],c.hook);
  return functionName==='transfer'&&same(args?.[0],c.player);
 }
 if(same(to,c.permit2)){
  const {functionName,args}=decodeFunctionData({abi:permitAbi,data});
  return functionName==='approve'&&same(args[0],c.token)&&same(args[1],c.router);
 }
 if(same(to,c.hook)){
  const {functionName,args}=decodeFunctionData({abi:c.hookAbi,data});
  if(functionName==='fillTank')return sameKey(args?.[0] as PoolKey,c.key);
  return functionName==='draw'&&same(args?.[0],poolId(c.key));
 }
 if(same(to,DELEGATION_MANAGER)){
  const {args}=decodeFunctionData({abi:delegationManagerAbi,data});
  if(args[0].length!==1||args[1].length!==1||args[1][0]!==SINGLE_DEFAULT_MODE||args[2].length!==1)return false;
  const execution=args[2][0];if(size(execution)<52)return false;
  const target=slice(execution,0,20);const amount=BigInt(slice(execution,20,52));const callData=size(execution)>52?slice(execution,52):'0x';
  if(same(target,c.session))return callData==='0x';
  if(!same(target,c.token)||amount!==0n)return false;
  const transfer=decodeFunctionData({abi:c.tokenAbi,data:callData});
  return transfer.functionName==='transfer'&&same(transfer.args?.[0],c.session);
 }
 return false;
}
// Last check before the game wallet signs: only the arcade's own calls, paying only the player or the game wallet.
export function checkSessionCall(call:{to:Address;data:Hex;value:bigint},c:SessionContext) {
 let ok=false;try{ok=allowed(call,c);}catch{ok=false;}
 if(!ok)throw Error('Blocked an unexpected game-wallet call.');
}
// One tab per player drives the game wallet, so two tabs never race for its nonce.
export async function acquireTabLock(player:Address,locks:LockManager|null=globalThis.navigator?.locks??null):Promise<(()=>void)|null> {
 if(!locks)return ()=>{};
 return await new Promise(resolve=>{void locks.request(`pepe-session:${player.toLowerCase()}`,{ifAvailable:true},lock=>{if(!lock){resolve(null);return;}return new Promise<void>(release=>resolve(release));});});
}
