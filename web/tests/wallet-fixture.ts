import {type Page} from '@playwright/test';
import { readFileSync } from 'node:fs';
import {decodeAbiParameters,decodeFunctionData,encodeAbiParameters,encodeEventTopics,encodeFunctionResult,erc20Abi,keccak256,parseAbiParameters,parseTransaction,recoverTransactionAddress,size,slice,stringToHex,toHex,type Abi,type Address,type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {delegationManagerAbi,poolId,poolKey,poolTuple,quoterAbi,routerAbi,permitAbi,stateAbi,rollFor} from '../src/protocol';
import {sessionKeyFromSignature,sessionMessage} from '../src/session';
import {DELEGATION_MANAGER} from '../src/chain.mjs';
import type {Deployment} from '../src/config';
export const d=JSON.parse(readFileSync('../dist/imd-deployment.json','utf8')) as Deployment;
// Anvil / Hardhat test account #0: a published development key that holds nothing on real chains.
const playerAccount=privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
export const player=playerAccount.address;
const token=d.contracts.find(c=>c.name==='PepeIce')!;const hook=d.contracts.find(c=>c.name==='JackpotHook')!;
const tokenAbi=JSON.parse(readFileSync(`../dist/${token.abiPath}`,'utf8')) as Abi;const hookAbi=JSON.parse(readFileSync(`../dist/${hook.abiPath}`,'utf8')) as Abi;
const id=poolId(poolKey(d));const u=d.network.uniswapV4;
const lc=(a:unknown)=>String(a).toLowerCase();
const TOKEN=lc(token.address),HOOK=lc(hook.address),MANAGER=lc(DELEGATION_MANAGER);
const ICE_OUT=980n*10n**18n,ETH_OUT=98000000000000n;
// The game wallet the page derives from the player's signature, computed the same way Node-side.
export async function sessionWallet(){const message=sessionMessage(d.chainId,player);const key=await sessionKeyFromSignature(await playerAccount.signMessage({message}),message,player);return {key,address:privateKeyToAccount(key).address};}
type State={eth:Map<string,bigint>;ice:Map<string,bigint>;allow:Map<string,bigint>;permit:Map<string,{amount:bigint;expiration:number}>;used:Map<string,bigint>;tank:bigint;ticket?:Address;drawn:boolean};
type Event={eventName:string;args:Record<string,unknown>;data:Hex};
// Explicitly typed so TypeScript narrows after a revert.
const revertWith:(reason:string)=>never=reason=>{throw {code:3,message:`execution reverted: ${reason}`};};
export async function fixture(page:Page,{wallet=true,wrong=false,poor=false,roll=77,missingCode=false,permissions=false,badSignature=false}={}){
 const game=await sessionWallet();
 const calls:{method:string;params:unknown[]}[]=[];const sent:{address:string;functionName:string;args:readonly unknown[];value:bigint}[]=[];
 const raw:{from:string;to:string;functionName:string;args:readonly unknown[];value:bigint;hash:Hex;at:number}[]=[];
 let block=100n;let hashSeed=0n;while(rollFor(toHex(hashSeed,{size:32}),id,0n)!==roll)hashSeed++;
 const futureHash=toHex(hashSeed,{size:32});
 let st:State={eth:new Map([[lc(player),poor?0n:10n**18n]]),ice:new Map([[lc(player),poor?0n:100000n*10n**18n]]),allow:new Map(),permit:new Map(),used:new Map(),tank:0n,drawn:false};
 const grants=new Map<string,{kind:'eth'|'ice';cap:bigint;redeemer:string}>();const nonces=new Map<string,number>();
 const receipts=new Map<string,unknown>();const held=new Map<string,unknown>();const txs=new Map<string,unknown>();
 let prompts=0;let reject=false;let revert=false;let dropLogs=false;let hold=false;
 const get=(m:Map<string,bigint>,a:unknown)=>m.get(lc(a))??0n;
 const add=(m:Map<string,bigint>,a:unknown,v:bigint)=>{m.set(lc(a),get(m,a)+v);};
 const debit=(m:Map<string,bigint>,a:unknown,v:bigint,reason:string)=>{if(get(m,a)<v)revertWith(reason);add(m,a,-v);};
 const pair=(owner:unknown,spender:unknown)=>`${lc(owner)}:${lc(spender)}`;
 function log(e:Event,hash:Hex,i:number){return {address:hook.address,topics:encodeEventTopics({abi:hookAbi,eventName:e.eventName,args:e.args}),data:e.data,blockNumber:'0x64',blockHash:toHex(100,{size:32}),transactionHash:hash,transactionIndex:'0x0',logIndex:toHex(i),removed:false};}
 const issued=(owner:Address):Event=>({eventName:'TicketIssued',args:{poolId:id,ticketId:0n,player:owner},data:encodeAbiParameters(parseAbiParameters('address,uint256,uint256'),[token.address,10n**18n,100n])});
 // One call against the mock chain state; eth_call and gas estimates run it on a copy.
 function run(s:State,from:string,to:string,data:Hex,value:bigint){
  const events:Event[]=[];
  if(value>0n){if(get(s.eth,from)<value)throw {code:-32000,message:'insufficient funds for transfer'};add(s.eth,from,-value);add(s.eth,to,value);}
  if(!data||data==='0x')return {fn:'',args:[] as readonly unknown[],result:'0x' as Hex,events};
  const abi=to===TOKEN?tokenAbi:to===HOOK?hookAbi:to===lc(u.quoter)?quoterAbi:to===lc(u.stateView)?stateAbi:to===lc(u.permit2)?permitAbi:to===lc(u.universalRouter)?routerAbi:to===MANAGER?delegationManagerAbi:undefined;
  if(!abi)revertWith('call to an account without code');
  const decoded=decodeFunctionData({abi,data});const fn=decoded.functionName;const args=(decoded.args||[]) as readonly unknown[];const a=args as readonly never[];
  let result:unknown;
  if(to===TOKEN){
   if(fn==='balanceOf')result=get(s.ice,a[0]);
   else if(fn==='decimals')result=18;
   else if(fn==='allowance')result=get(s.allow,pair(a[0],a[1]));
   else if(fn==='approve'){s.allow.set(pair(from,a[0]),a[1]);result=true;}
   else if(fn==='transfer'){debit(s.ice,from,a[1],'ERC20InsufficientBalance');add(s.ice,a[0],a[1]);result=true;}
   else revertWith(`unmocked ${fn}`);
  }else if(to===HOOK){
   if(fn==='poolManager')result=u.poolManager;
   else if(fn==='ICE_PER_PEE')result=10n**19n;
   else if(fn==='pots')result=[10n**16n,(2500n+s.tank*10n)*10n**18n];
   else if(fn==='ticket')result={player:s.ticket??player,currency:token.address,fee:10n**18n,blockNumber:100n,drawn:s.drawn};
   else if(fn==='nextTicketId')result=s.ticket?1n:0n;
   else if(fn==='fillTank'){
    const pees=a[1] as bigint;const amount=pees*10n**19n;
    if(get(s.allow,pair(from,HOOK))<amount)revertWith('ERC20InsufficientAllowance');
    debit(s.ice,from,amount,'ERC20InsufficientBalance');s.tank+=pees;
    events.push({eventName:'TankFilled',args:{poolId:id,player:from},data:encodeAbiParameters(parseAbiParameters('uint256'),[pees])});
   }else if(fn==='draw'){s.drawn=true;events.push({eventName:'Drawn',args:{poolId:id,ticketId:0n,player:s.ticket??player},data:encodeAbiParameters(parseAbiParameters('uint256,uint256,uint256'),[BigInt(roll),9n*10n**15n,2250n*10n**18n])});}
   else revertWith(`unmocked ${fn}`);
  }else if(to===lc(u.quoter))result=[(a[0] as {zeroForOne:boolean}).zeroForOne?ICE_OUT:ETH_OUT,180000n];
  else if(to===lc(u.stateView))result=fn==='getSlot0'?[1000n*2n**96n,138162,0,3000]:10n**22n;
  else if(to===lc(u.permit2)){
   if(fn==='allowance'){const p=s.permit.get(lc(a[0]));result=[p?.amount??0n,p?.expiration??0,0];}
   else{s.permit.set(lc(from),{amount:a[2],expiration:Number(a[3])});}
  }else if(to===lc(u.universalRouter)){
   if(revert)revertWith('SlippageTooHigh');
   const [,params]=decodeAbiParameters(parseAbiParameters('bytes,bytes[]'),(a[1] as Hex[])[0]);
   const [swap]=decodeAbiParameters(parseAbiParameters(`(${poolTuple} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`),params[0]);
   if(swap.zeroForOne){if(value<swap.amountIn)revertWith('insufficient msg.value');add(s.ice,from,ICE_OUT);}
   else{
    const p=s.permit.get(lc(from));
    if(get(s.allow,pair(from,u.permit2))<swap.amountIn||!p||p.amount<swap.amountIn)revertWith('InsufficientAllowance');
    if(p.expiration<Date.now()/1000)revertWith('AllowanceExpired');
    debit(s.ice,from,swap.amountIn,'ERC20InsufficientBalance');add(s.eth,from,ETH_OUT);
   }
   const [owner]=decodeAbiParameters(parseAbiParameters('address'),swap.hookData);s.ticket=owner;events.push(issued(owner));
  }else{
   // ERC-7715 redemption: the grant's redeemer pulls from the player, within the granted period amount.
   const context=lc((a[0] as Hex[])[0]);const g=grants.get(context);if(!g||g.redeemer!==from)revertWith('InvalidDelegate');
   const execution=(a[2] as Hex[])[0];const target=lc(slice(execution,0,20));const amount=BigInt(slice(execution,20,52));const callData=size(execution)>52?slice(execution,52):'0x';
   let pull=amount;
   if(g.kind==='eth'){if(target!==from||callData!=='0x')revertWith('InvalidExecution');}
   else{const t=decodeFunctionData({abi:erc20Abi,data:callData});if(target!==TOKEN||t.functionName!=='transfer'||lc(t.args[0])!==from)revertWith('InvalidExecution');pull=t.args[1] as bigint;}
   const used=get(s.used,context)+pull;if(used>g.cap)revertWith('ExceededPeriodAllowance');s.used.set(context,used);
   const m=g.kind==='eth'?s.eth:s.ice;debit(m,player,pull,'PlayerBalanceTooLow');add(m,from,pull);
  }
  return {fn,args,result:encodeFunctionResult({abi,functionName:fn,result}),events};
 }
 // Mined transactions apply atomically; a revert leaves state untouched and yields a failed receipt.
 function mine(from:string,to:string,data:Hex,value:bigint,hash:Hex,nonce:number){
  let out={fn:'',args:[] as readonly unknown[],events:[] as Event[]};let status='0x1';
  try{const next=structuredClone(st);out=run(next,from,to,data,value);st=next;}catch{status='0x0';}
  const logs=dropLogs?[]:out.events.map((e,i)=>log(e,hash,i));
  txs.set(hash,{hash,from,to,nonce:toHex(nonce),value:toHex(value),input:data||'0x',gas:'0x30000',maxFeePerGas:'0x2',maxPriorityFeePerGas:'0x1',type:'0x2',chainId:toHex(d.chainId),blockHash:null,blockNumber:null,transactionIndex:null,accessList:[],v:'0x0',yParity:'0x0',r:toHex(1,{size:32}),s:toHex(1,{size:32})});
  (hold?held:receipts).set(hash,{transactionHash:hash,transactionIndex:'0x0',blockHash:toHex(100,{size:32}),blockNumber:'0x64',from,to,cumulativeGasUsed:'0x10000',gasUsed:'0x10000',contractAddress:null,logs,logsBloom:toHex(0,{size:256}),status,effectiveGasPrice:'0x2',type:'0x2'});
  return out;
 }
 const prompt=()=>{prompts++;if(reject)throw {code:4001,message:'User rejected the request'};};
 const rpc=async(method:string,params:unknown[]=[]):Promise<unknown>=>{
  calls.push({method,params});
  if(method==='eth_chainId')return toHex(d.chainId);
  if(method==='eth_blockNumber')return toHex(block);
  if(method==='eth_getCode')return missingCode?'0x':'0x60006000';
  if(method==='eth_getBalance')return toHex(get(st.eth,params[0]));
  if(method==='eth_getTransactionCount')return toHex(nonces.get(lc(params[0]))??0);
  if(method==='eth_maxPriorityFeePerGas')return '0x1';
  if(method==='eth_gasPrice')return '0x2';
  if(method==='eth_getTransactionReceipt')return receipts.get(params[0] as string)||null;
  if(method==='eth_getTransactionByHash')return txs.get(params[0] as string)||null;
  if(method==='eth_getBlockByNumber')return {number:toHex(block),hash:futureHash,parentHash:toHex(0,{size:32}),timestamp:toHex(Math.floor(Date.now()/1000)),gasLimit:'0x1c9c380',gasUsed:'0x0',baseFeePerGas:'0x1',transactions:[],miner:player,difficulty:'0x0',extraData:'0x',nonce:'0x0000000000000000',size:'0x0',transactionsRoot:toHex(0,{size:32}),stateRoot:toHex(0,{size:32}),receiptsRoot:toHex(0,{size:32}),logsBloom:toHex(0,{size:256}),sha3Uncles:toHex(0,{size:32}),uncles:[]};
  if(method==='eth_getLogs')return st.ticket?[log(issued(st.ticket),toHex(1000,{size:32}),0)]:[];
  if(method==='eth_call'||method==='eth_estimateGas'){
   const tx=params[0] as {from?:Address;to:Address;data?:Hex;input?:Hex;value?:Hex};const data=tx.data??tx.input??'0x';
   const out=run(structuredClone(st),lc(tx.from??'0x0000000000000000000000000000000000000000'),lc(tx.to),data,BigInt(tx.value||0));
   return method==='eth_call'?out.result:data==='0x'?'0x5208':'0x30000';
  }
  if(method==='eth_sendTransaction'){
   prompt();
   const tx=params[0] as {from?:Address;to:Address;data?:Hex;value?:Hex};const from=lc(tx.from??player);if(from!==lc(player))throw {code:4100,message:'Unknown account'};
   const nonce=nonces.get(from)??0;nonces.set(from,nonce+1);
   const hash=toHex(1000+sent.length+1,{size:32});const value=BigInt(tx.value||0);
   const out=mine(from,lc(tx.to),tx.data??'0x',value,hash,nonce);sent.push({address:lc(tx.to),functionName:out.fn,args:out.args,value});return hash;
  }
  if(method==='eth_sendRawTransaction'){
   const serialized=params[0] as Hex;const tx=parseTransaction(serialized);const from=lc(await recoverTransactionAddress({serializedTransaction:serialized as never}));
   const nonce=nonces.get(from)??0;if(tx.nonce!==nonce)throw {code:-32000,message:(tx.nonce??0)<nonce?'nonce too low':'nonce too high'};
   const value=tx.value??0n;const fee=('maxFeePerGas' in tx?tx.maxFeePerGas:tx.gasPrice)??0n;
   // Gas is checked, not charged, so balance assertions stay exact.
   if(get(st.eth,from)<value+(tx.gas??0n)*fee)throw {code:-32000,message:'insufficient funds for gas * price + value'};
   nonces.set(from,nonce+1);const hash=keccak256(serialized);
   const out=mine(from,lc(tx.to),tx.data??'0x',value,hash,nonce);raw.push({from,to:lc(tx.to),functionName:out.fn,args:out.args,value,hash,at:Date.now()});return hash;
  }
  if(method==='personal_sign'){
   prompt();
   const [message,account]=params as [Hex,Address];if(lc(account)!==lc(player))throw {code:4100,message:'Unknown account'};
   const signature=await playerAccount.signMessage({message:{raw:message}});return badSignature?slice(signature,0,64):signature;
  }
  if(method==='wallet_getSupportedExecutionPermissions'&&permissions){const type={chainIds:[toHex(d.chainId)],ruleTypes:['expiry','redeemer','payee']};return {'native-token-periodic':type,'erc20-token-periodic':type};}
  if(method==='wallet_requestExecutionPermissions'&&permissions){
   prompt();
   return (params as {to:Address;permission:{type:string;data:{periodAmount:Hex}}}[]).map(item=>{
    const context=keccak256(stringToHex(`grant-${grants.size}`));
    grants.set(lc(context),{kind:item.permission.type==='native-token-periodic'?'eth':'ice',cap:BigInt(item.permission.data.periodAmount),redeemer:lc(item.to)});
    return {...item,context,delegationManager:DELEGATION_MANAGER,dependencies:[]};
   });
  }
  throw {code:-32601,message:`Unmocked RPC: ${method}`};
 };
 await page.route(/https:\/\/(ethereum-sepolia-rpc\.publicnode\.com|rpc\.sepolia\.ethpandaops\.io|sepolia\.rpc\.sentio\.xyz)/,async route=>{
  const body=route.request().postDataJSON();
  const respond=async(req:{method:string;params:unknown[];id:number})=>{try{return {jsonrpc:'2.0',id:req.id,result:await rpc(req.method,req.params)};}catch(error){return {jsonrpc:'2.0',id:req.id,error};}};
  const result=Array.isArray(body)?await Promise.all(body.map(respond)):await respond(body);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 if(wallet)await page.addInitScript(({player,chain,wrong,rpcUrl})=>{
  let chainId=wrong?'0x1':chain;let added=!wrong;let connected=false;const listeners:Record<string,((value:unknown)=>void)[]>={};
  const provider={isMetaMask:true,on:(name:string,fn:(value:unknown)=>void)=>{(listeners[name]??=[]).push(fn);},removeListener:(name:string,fn:(value:unknown)=>void)=>{listeners[name]=(listeners[name]||[]).filter(f=>f!==fn);},request:async({method,params}:{method:string;params?:unknown[]})=>{
   if(method==='eth_chainId')return chainId;
   if(method==='eth_requestAccounts'){connected=true;return [player];}
   if(method==='eth_accounts')return connected?[player]:[];
   if(method==='wallet_switchEthereumChain'){if(!added)throw {code:4902,message:'Unknown chain'};chainId=chain;(listeners.chainChanged||[]).forEach(fn=>fn(chainId));return null;}
   if(method==='wallet_addEthereumChain'){(window as unknown as {addedChain:unknown}).addedChain=params?.[0];added=true;return null;}
   if(method==='wallet_watchAsset')return true;
   if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];
   // Everything else, including signing and ERC-7715, is answered Node-side by the routed RPC mock.
   const r=await fetch(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const body=await r.json();if(body.error)throw body.error;return body.result;
  }};
  Object.defineProperty(window,'ethereum',{value:provider});
 },{player,chain:toHex(d.chainId),wrong,rpcUrl:d.network.rpcUrls[0]});
 return {calls,sent,raw,session:game.address,sessionKey:game.key,get prompts(){return prompts;},get tank(){return st.tank;},
  balance:(address:string,kind:'eth'|'ice')=>get(kind==='eth'?st.eth:st.ice,address),
  fund:(address:string,{eth=0n,ice=0n}:{eth?:bigint;ice?:bigint})=>{add(st.eth,address,eth);add(st.ice,address,ice);},
  setBlock:(n:bigint)=>{block=n;},reject:(value=true)=>{reject=value;},revert:()=>{revert=true;},dropLogs:()=>{dropLogs=true;},
  // Hold keeps new receipts pending; release publishes them in the next block.
  hold:()=>{hold=true;},release:()=>{hold=false;held.forEach((r,h)=>receipts.set(h,r));held.clear();block++;}};
}
