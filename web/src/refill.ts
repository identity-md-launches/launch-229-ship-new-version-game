import { encodeFunctionData, erc20Abi, parseEther, parseUnits, toHex, type Address, type Hex } from 'viem';
import { DELEGATION_MANAGER, SESSION } from './chain.mjs';
import { encodeRedeem } from './protocol';
export type Grant={eth:{context:Hex;periodAmount:bigint};ice:{context:Hex;periodAmount:bigint};expiry:number};
// Method syntax so a typed EIP-1193 provider fits without a cast.
type Requester={request(arg:{method:string;params?:unknown}):Promise<unknown>};
type GrantItem={chainId?:unknown;to?:unknown;context?:unknown;delegationManager?:unknown;dependencies?:unknown;permission?:{type?:unknown;data?:{periodAmount?:unknown;tokenAddress?:unknown}};rules?:{type?:unknown;data?:{timestamp?:unknown}}[]};
const NATIVE='native-token-periodic';const TOKEN='erc20-token-periodic';
const same=(a:unknown,b:string)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
const isHex=(v:unknown):v is Hex=>typeof v==='string'&&/^0x[0-9a-fA-F]+$/.test(v);
const grantKey=(chainId:number,player:Address,session:Address)=>`pepe:grant:${chainId}:${player.toLowerCase()}:${session.toLowerCase()}`;
// ERC-7715 support for both periodic pulls on this chain; returns the rule types both accept.
export async function refillSupport(provider:Requester,chainId:number):Promise<string[]|undefined> {
 try{
  const supported=await provider.request({method:'wallet_getSupportedExecutionPermissions'}) as Record<string,{chainIds?:unknown;ruleTypes?:unknown}>;
  const types=[supported?.[NATIVE],supported?.[TOKEN]];
  if(!types.every(t=>Array.isArray(t?.chainIds)&&t.chainIds.some(c=>(typeof c==='string'||typeof c==='number')&&Number(c)===chainId)))return undefined;
  const [native,token]=types.map(t=>Array.isArray(t?.ruleTypes)?t.ruleTypes.filter((r):r is string=>typeof r==='string'):[]);
  return native.filter(r=>token.includes(r));
 }catch{return undefined;}
}
export async function requestRefill(provider:Requester,o:{player:Address;session:Address;chainId:number;token:Address;decimals:number;ruleTypes:string[];now:number;hasCode:(a:Address)=>Promise<boolean>}):Promise<Grant> {
 const expiry=o.now+SESSION.refillDays*86400;
 const rules=[{type:'expiry',data:{timestamp:expiry}},...['redeemer','payee'].filter(type=>o.ruleTypes.includes(type)).map(type=>({type,data:{addresses:[o.session]}}))];
 const item=(type:string,data:Record<string,unknown>,justification:string)=>({chainId:toHex(o.chainId),from:o.player,to:o.session,permission:{type,isAdjustmentAllowed:true,data:{...data,periodDuration:SESSION.refillPeriod,startTime:o.now,justification}},rules});
 const response=await provider.request({method:'wallet_requestExecutionPermissions',params:[
  item(NATIVE,{periodAmount:toHex(parseEther(SESSION.refillEth))},'Refill the pepes arcade game wallet with Sepolia ETH for gas and swaps.'),
  item(TOKEN,{tokenAddress:o.token,periodAmount:toHex(parseUnits(SESSION.refillIce,o.decimals))},'Refill the pepes arcade game wallet with ICE for fridge swaps and tank fills.')]});
 const unusable=Error('The wallet returned an auto-refill grant this arcade cannot use. Use manual top-ups.');
 // Amounts come from the response: the wallet lets the player adjust them before granting.
 const part=async(type:string)=>{
  const g=(Array.isArray(response)?response as GrantItem[]:[]).find(r=>r?.permission?.type===type);
  if(!g||!isHex(g.context)||!same(g.delegationManager,DELEGATION_MANAGER)||Number(g.chainId)!==o.chainId)throw unusable;
  if(g.to!==undefined&&!same(g.to,o.session))throw unusable;
  if(type===TOKEN&&g.permission?.data?.tokenAddress!==undefined&&!same(g.permission.data.tokenAddress,o.token))throw unusable;
  const periodAmount=BigInt(g.permission?.data?.periodAmount as string);if(periodAmount<=0n)throw unusable;
  if(Array.isArray(g.dependencies)&&g.dependencies.length&&!await o.hasCode(o.player))throw unusable;
  const granted=Number(g.rules?.find(r=>r?.type==='expiry')?.data?.timestamp);
  return {context:g.context,periodAmount,expiry:Number.isFinite(granted)&&granted>0?granted:expiry};
 };
 try{
  const [eth,ice]=[await part(NATIVE),await part(TOKEN)];
  return {eth:{context:eth.context,periodAmount:eth.periodAmount},ice:{context:ice.context,periodAmount:ice.periodAmount},expiry:Math.min(eth.expiry,ice.expiry)};
 }catch{throw unusable;}
}
// Only public grant data is stored: permission contexts, amounts and expiry.
export function saveGrant(chainId:number,player:Address,session:Address,grant:Grant) {
 try{localStorage.setItem(grantKey(chainId,player,session),JSON.stringify({eth:{context:grant.eth.context,periodAmount:grant.eth.periodAmount.toString()},ice:{context:grant.ice.context,periodAmount:grant.ice.periodAmount.toString()},expiry:grant.expiry}));}catch{/* The grant then lasts for this tab only. */}
}
export function loadGrant(chainId:number,player:Address,session:Address,now:number):Grant|undefined {
 const key=grantKey(chainId,player,session);
 try{
  const raw=localStorage.getItem(key);if(!raw)return undefined;
  const g=JSON.parse(raw);
  const part=(p:{context?:unknown;periodAmount?:unknown})=>{const periodAmount=BigInt(p?.periodAmount as string);if(!isHex(p?.context)||periodAmount<=0n)throw Error('Malformed grant.');return {context:p.context,periodAmount};};
  const grant={eth:part(g.eth),ice:part(g.ice),expiry:Number(g.expiry)};
  if(!Number.isFinite(grant.expiry)||grant.expiry<=now){localStorage.removeItem(key);return undefined;}
  return grant;
 }catch{try{localStorage.removeItem(key);}catch{/* Storage unavailable. */}return undefined;}
}
export function clearGrant(chainId:number,player:Address,session:Address) {
 try{localStorage.removeItem(grantKey(chainId,player,session));}catch{/* Storage unavailable. */}
}
// A pull under the grant: ICE as a token transfer to the game wallet, ETH as a value call to it.
export function redeemCall(grant:Grant,kind:'eth'|'ice',o:{token:Address;session:Address},amount:bigint) {
 const data=kind==='ice'
  ?encodeRedeem(grant.ice.context,o.token,0n,encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[o.session,amount]}))
  :encodeRedeem(grant.eth.context,o.session,amount,'0x');
 return {to:DELEGATION_MANAGER as Address,data,value:0n};
}
