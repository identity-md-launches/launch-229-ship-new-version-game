import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeAbiParameters, decodeFunctionData, encodeAbiParameters, encodeFunctionData, erc20Abi, getAddress, keccak256, parseAbiParameters, parseUnits, size, slice, toBytes, toHex, type Address, type Hex} from 'viem';
import {delegationManagerAbi,drawWindow,encodeRedeem,permitAbi,playerData,routerAbi,isWin,MAX_UINT160,MAX_UINT48,minimumOut,poolKey,poolId,poolTuple,rollFor,SINGLE_DEFAULT_MODE,swapInput,switchNetwork} from '../src/protocol';
import {canonical} from '../src/canonical.mjs';
import {DELEGATION_MANAGER,POOL,SESSION,walletAddChain} from '../src/chain.mjs';
import {safePath,type Deployment} from '../src/config';
import {acquireTabLock,checkSessionCall,sessionKeyFromSignature,sessionMessage,type SessionContext} from '../src/session';
import {loadGrant,redeemCall,refillSupport,requestRefill,saveGrant,clearGrant,type Grant} from '../src/refill';
import {privateKeyToAccount} from 'viem/accounts';
import {MAINNET_RPCS,MAINNET_TOKENS,readHoldings,showHoldings} from '../src/holdings';
import {createPublicClient,custom} from 'viem';
import {mainnet} from 'viem/chains';
import {type Abi} from 'viem';
const d=JSON.parse(readFileSync('public/imd-deployment.json','utf8')) as Deployment;
const player='0x0000000000000000000000000000000000001234' as Address;
test('handoff pins implementation-derived canonical ABIs',()=>{for(const c of d.contracts){const abi=JSON.parse(readFileSync(`public/${c.abiPath}`,'utf8'));assert.equal(keccak256(toBytes(canonical(abi))).slice(2),c.abiHash);}});
test('PoolId is the ABI hash of the complete attested pool key',()=>{const key=poolKey(d);assert.equal(key.currency0,POOL.pairedCurrency);assert.equal(poolId(key),keccak256(encodeAbiParameters(parseAbiParameters('address,address,uint24,int24,address'),[key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks])));});
for(const native of [true,false])test(`${native?'native':'token'} exact-input router payload, settlement and hook player`,()=>{
 const key=poolKey(d);const input=swapInput(key,native,100n,90n,player);
 const [actions,params]=decodeAbiParameters(parseAbiParameters('bytes,bytes[]'),input);assert.equal(actions,'0x060c0f');
 const [swap]=decodeAbiParameters(parseAbiParameters(`(${poolTuple} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`),params[0]);
 assert.deepEqual(swap.poolKey.hooks.toLowerCase(),key.hooks);assert.equal(swap.zeroForOne,native);assert.equal(swap.amountIn,100n);assert.equal(swap.amountOutMinimum,90n);
 assert.equal(decodeAbiParameters([{type:'address'}],swap.hookData)[0].toLowerCase(),player);
 assert.deepEqual(decodeAbiParameters(parseAbiParameters('address,uint256'),params[1]).map(x=>typeof x==='string'?x.toLowerCase():x),[native?key.currency0:key.currency1,100n]);
 assert.equal(decodeAbiParameters(parseAbiParameters('address,uint256'),params[2])[1],90n);
});
test('slippage rounds down and rejects unsafe bounds',()=>{assert.equal(minimumOut(1001n,100),990n);for(const bps of [-1,0,9,501,NaN,2.5])assert.throws(()=>minimumOut(1000n,bps));});
test('draw window matches B+2 through B+256 exactly',()=>{for(const n of [100n,101n])assert.equal(drawWindow(100n,n),'waiting');for(const n of [102n,356n])assert.equal(drawWindow(100n,n),'ready');assert.equal(drawWindow(100n,357n),'expired');});
test('roll is uint256 Keccak of abi.encode (not packed)',()=>{const hash=toHex(135n,{size:32});const id=poolId(poolKey(d));const expected=Number(BigInt(keccak256(encodeAbiParameters([{type:'bytes32'},{type:'bytes32'},{type:'uint256'}],[hash,id,0n])))%100n)+1;assert.equal(rollFor(hash,id,0n),expected);});
test('only the six specified outcomes win',()=>{assert.deepEqual(Array.from({length:100},(_,i)=>i+1).filter(isWin),[20,40,60,77,80,100]);});
test('unknown chain adds exact vetted parameters, then switches again',async()=>{const calls:unknown[]=[];let count=0;await switchNetwork({request:async arg=>{calls.push(arg);if(count++===0)throw {code:4902};}},d);assert.deepEqual(calls,[{method:'wallet_switchEthereumChain',params:[{chainId:walletAddChain(d.network).chainId}]},{method:'wallet_addEthereumChain',params:[walletAddChain(d.network)]},{method:'wallet_switchEthereumChain',params:[{chainId:walletAddChain(d.network).chainId}]}]);});
test('a rejected switch does not add a chain',async()=>{let calls=0;await assert.rejects(switchNetwork({request:async()=>{calls++;throw {code:4001};}},d));assert.equal(calls,1);});
test('export paths cannot escape static root',()=>{for(const p of ['../secret','/etc/passwd','https://x','abi/../../x'])assert.equal(safePath(p),false);assert.equal(safePath('abi/PepeIce.json'),true);});
test('redemption wraps one packed execution under one context in single default mode',()=>{
 const token=d.contracts.find(c=>c.name==='PepeIce')!.address;const session='0x00000000000000000000000000000000000000aa' as Address;
 const transfer=encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[session,10n]});
 const {functionName,args}=decodeFunctionData({abi:delegationManagerAbi,data:encodeRedeem('0xc0ffee',token,0n,transfer)});
 assert.equal(functionName,'redeemDelegations');assert.deepEqual(args[0],['0xc0ffee']);assert.deepEqual(args[1],[SINGLE_DEFAULT_MODE]);assert.equal(size(SINGLE_DEFAULT_MODE),32);assert.equal(BigInt(SINGLE_DEFAULT_MODE),0n);
 const execution=args[2][0];assert.equal(size(execution),120);assert.equal(slice(execution,0,20).toLowerCase(),token.toLowerCase());assert.equal(BigInt(slice(execution,20,52)),0n);assert.equal(slice(execution,52),transfer);
 const native=decodeFunctionData({abi:delegationManagerAbi,data:encodeRedeem('0x01',session,5n,'0x')}).args[2][0];assert.equal(size(native),52);assert.equal(BigInt(slice(native,20,52)),5n);
});
test('DelegationManager address is checksummed',()=>{assert.equal(DELEGATION_MANAGER,getAddress(DELEGATION_MANAGER));});
test('session presets parse and caps are uint160/uint48 max',()=>{
 for(const v of [SESSION.ethChunk,SESSION.gasReserve,SESSION.refillEth,...SESSION.topUps])assert.ok(parseUnits(v,18)>0n);
 for(const v of [SESSION.iceChunk,SESSION.refillIce,...SESSION.iceMoves])assert.ok(parseUnits(v,18)>0n);
 assert.equal(SESSION.refillPeriod,86400);assert.equal(SESSION.refillDays,7);
 assert.equal(MAX_UINT160,2n**160n-1n);assert.equal(MAX_UINT48,2n**48n-1n);
});
// Anvil's public test accounts #0 and #1: well-known keys, never funded outside local chains.
const anvil0=privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');const anvil1=privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const refused={message:'Session play needs a wallet that signs with a regular account key.'};
test('session message names the chain and checksummed player',()=>{
 assert.equal(sessionMessage(11155111,anvil0.address.toLowerCase() as Address),`pepes armed with ai · session key v1\nChain: 11155111\nPlayer: ${anvil0.address}\n\nSigning creates the game wallet that plays your background moves in this tab. It can only spend what you send it or allow it to pull. Only sign this on the pepes armed with ai arcade.`);
});
test('same signature derives the same game wallet; compact and foreign signatures are refused',async()=>{
 const message=sessionMessage(11155111,anvil0.address);const signature=await anvil0.signMessage({message});
 const key=await sessionKeyFromSignature(signature,message,anvil0.address);assert.equal(key,keccak256(signature));assert.equal(await sessionKeyFromSignature(signature,message,anvil0.address),key);
 assert.equal(privateKeyToAccount(key).address,privateKeyToAccount(await sessionKeyFromSignature(await anvil0.signMessage({message}),message,anvil0.address)).address);
 await assert.rejects(sessionKeyFromSignature(slice(signature,0,64),message,anvil0.address),refused);
 await assert.rejects(sessionKeyFromSignature(await anvil1.signMessage({message}),message,anvil0.address),refused);
 await assert.rejects(sessionKeyFromSignature(`0x${'00'.repeat(65)}`,message,anvil0.address),refused);
});
const abiOf=(name:string)=>JSON.parse(readFileSync(`public/${d.contracts.find(c=>c.name===name)!.abiPath}`,'utf8')) as Abi;
const key=poolKey(d);const u=d.network.uniswapV4;const stranger='0x00000000000000000000000000000000000000bb' as Address;
const ctx:SessionContext={player:anvil0.address,session:'0x00000000000000000000000000000000000000aa',token:d.contracts.find(c=>c.name==='PepeIce')!.address,hook:key.hooks,permit2:u.permit2,router:u.universalRouter,key,tokenAbi:abiOf('PepeIce'),hookAbi:abiOf('JackpotHook')};
const call=(to:Address,abi:Abi,functionName:string,args:readonly unknown[],value=0n)=>({to,data:encodeFunctionData({abi,functionName,args}),value});
const execute=(input:Hex,commands:Hex='0x10',value=0n)=>call(ctx.router,routerAbi,'execute',[commands,[input],1n],value);
const iceTransfer=(to:Address)=>encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[to,1n]});
test('game wallet allowlist accepts each arcade call',()=>{
 for(const c of [
  call(ctx.token,ctx.tokenAbi,'approve',[ctx.permit2,2n**256n-1n]),call(ctx.token,ctx.tokenAbi,'approve',[ctx.hook,1n]),call(ctx.token,ctx.tokenAbi,'transfer',[ctx.player,1n]),
  call(ctx.permit2,permitAbi,'approve',[ctx.token,ctx.router,MAX_UINT160,Number(MAX_UINT48)]),
  execute(swapInput(key,true,100n,90n,ctx.player),'0x10',100n),execute(swapInput(key,false,100n,90n,ctx.player)),
  call(ctx.hook,ctx.hookAbi,'fillTank',[key,10n]),call(ctx.hook,ctx.hookAbi,'draw',[poolId(key),3n]),
  {to:DELEGATION_MANAGER as Address,data:encodeRedeem('0x01',ctx.token,0n,iceTransfer(ctx.session)),value:0n},{to:DELEGATION_MANAGER as Address,data:encodeRedeem('0x02',ctx.session,5n,'0x'),value:0n},
  {to:ctx.player,data:'0x' as Hex,value:5n},
 ])assert.doesNotThrow(()=>checkSessionCall(c,ctx),c.data);
});
test('game wallet allowlist blocks everything else',()=>{
 const blocked={message:'Blocked an unexpected game-wallet call.'};
 const otherKey={...key,fee:500};
 for(const c of [
  call(ctx.token,ctx.tokenAbi,'transfer',[stranger,1n]),call(ctx.token,ctx.tokenAbi,'approve',[stranger,1n]),call(ctx.token,ctx.tokenAbi,'transferFrom',[ctx.player,ctx.session,1n]),call(ctx.token,ctx.tokenAbi,'approve',[ctx.permit2,1n],1n),
  call(ctx.permit2,permitAbi,'approve',[ctx.token,stranger,1n,1]),call(ctx.permit2,permitAbi,'approve',[stranger,ctx.router,1n,1]),
  {to:stranger,data:'0x' as Hex,value:5n},{to:ctx.player,data:'0x12345678' as Hex,value:5n},
  execute(swapInput(key,true,100n,90n,ctx.player),'0x11'),execute(swapInput(key,true,100n,90n,stranger)),execute(swapInput(otherKey,true,100n,90n,ctx.player)),
  call(ctx.hook,ctx.hookAbi,'fillTank',[otherKey,10n]),call(ctx.hook,ctx.hookAbi,'draw',[toHex(1,{size:32}),3n]),
  {to:DELEGATION_MANAGER as Address,data:encodeRedeem('0x01',ctx.token,0n,iceTransfer(stranger)),value:0n},{to:DELEGATION_MANAGER as Address,data:encodeRedeem('0x02',stranger,5n,'0x'),value:0n},
  {to:DELEGATION_MANAGER as Address,data:encodeRedeem('0x02',ctx.session,5n,'0x12'),value:0n},
  {to:stranger,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[stranger,1n]}),value:0n},{to:ctx.token,data:'0xdeadbeef' as Hex,value:0n},
 ])assert.throws(()=>checkSessionCall(c,ctx),blocked,c.data);
});
test('one tab holds the game wallet lock at a time',async()=>{
 const release=await acquireTabLock(anvil0.address);assert.equal(typeof release,'function');
 assert.equal(await acquireTabLock(anvil0.address.toLowerCase() as Address),null);
 release!();await new Promise(r=>setTimeout(r,10));
 const again=await acquireTabLock(anvil0.address);assert.equal(typeof again,'function');again!();
 const noop=await acquireTabLock(anvil0.address,null);assert.equal(typeof noop,'function');
});
const store=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,String(v));},removeItem:(k:string)=>{store.delete(k);}}});
const periodic={chainIds:['0xaa36a7'],ruleTypes:['expiry','redeemer','payee']};
test('auto-refill needs both periodic types on this chain',async()=>{
 const ask=(result:unknown)=>refillSupport({request:async()=>{if(result instanceof Error)throw result;return result;}},11155111);
 assert.deepEqual(await ask({'native-token-periodic':periodic,'erc20-token-periodic':{...periodic,ruleTypes:['expiry','payee']}}),['expiry','payee']);
 assert.equal(await ask({'native-token-periodic':periodic}),undefined);
 assert.equal(await ask({'native-token-periodic':{...periodic,chainIds:['0x1']},'erc20-token-periodic':periodic}),undefined);
 assert.equal(await ask(Object.assign(Error('Method not found'),{code:-32601})),undefined);
});
type RefillItem={chainId:Hex;from:Address;to:Address;permission:{type:string;isAdjustmentAllowed:boolean;data:{periodAmount:Hex;periodDuration:number;startTime:number;tokenAddress?:Address}};rules:{type:string;data:Record<string,unknown>}[]};
const now=1790000000;
function wallet(edit:(item:Record<string,unknown>,i:number)=>void=()=>{}){
 const seen:{method:string;params?:unknown}[]=[];
 return {seen,request:async(arg:{method:string;params?:unknown})=>{seen.push(arg);return (arg.params as RefillItem[]).map((r,i)=>{const item:Record<string,unknown>={...structuredClone(r),context:`0x0${i+1}`,delegationManager:DELEGATION_MANAGER,dependencies:[]};edit(item,i);return item;});}};
}
const refillArgs=(ruleTypes=['expiry','redeemer','payee'],hasCode=async()=>false)=>({player:anvil0.address,session:ctx.session,chainId:11155111,token:ctx.token,decimals:18,ruleTypes,now,hasCode});
test('auto-refill request asks for daily ETH and ICE pulls and keeps the granted amounts',async()=>{
 const w=wallet((item,i)=>{if(i===1)(item.permission as RefillItem['permission']).data.periodAmount=toHex(5000n*10n**18n);});
 const grant=await requestRefill(w,refillArgs());
 assert.equal(w.seen.length,1);assert.equal(w.seen[0].method,'wallet_requestExecutionPermissions');
 const [eth,ice]=w.seen[0].params as RefillItem[];
 assert.equal(eth.permission.type,'native-token-periodic');assert.equal(BigInt(eth.permission.data.periodAmount),2n*10n**16n);
 assert.equal(ice.permission.type,'erc20-token-periodic');assert.equal(BigInt(ice.permission.data.periodAmount),10000n*10n**18n);assert.equal(ice.permission.data.tokenAddress,ctx.token);
 for(const r of [eth,ice]){assert.equal(r.chainId,'0xaa36a7');assert.equal(r.to,ctx.session);assert.equal(r.from,anvil0.address);assert.equal(r.permission.isAdjustmentAllowed,true);assert.equal(r.permission.data.periodDuration,86400);assert.equal(r.permission.data.startTime,now);
  assert.deepEqual(r.rules,[{type:'expiry',data:{timestamp:now+7*86400}},{type:'redeemer',data:{addresses:[ctx.session]}},{type:'payee',data:{addresses:[ctx.session]}}]);}
 assert.deepEqual(grant,{eth:{context:'0x01',periodAmount:2n*10n**16n},ice:{context:'0x02',periodAmount:5000n*10n**18n},expiry:now+7*86400});
 const bare=wallet();await requestRefill(bare,refillArgs(['expiry']));assert.deepEqual((bare.seen[0].params as RefillItem[])[0].rules.map(r=>r.type),['expiry']);
});
test('auto-refill grants for another manager, wallet or chain, or with unmet dependencies are refused',async()=>{
 const unusable={message:'The wallet returned an auto-refill grant this arcade cannot use. Use manual top-ups.'};
 for(const edit of [
  (item:Record<string,unknown>)=>{item.delegationManager=stranger;},(item:Record<string,unknown>)=>{item.to=stranger;},(item:Record<string,unknown>)=>{item.context='0x';},
  (item:Record<string,unknown>)=>{item.chainId='0x1';},(item:Record<string,unknown>,i:number)=>{if(i===1)(item.permission as RefillItem['permission']).data.tokenAddress=stranger;},
  (item:Record<string,unknown>)=>{(item.permission as RefillItem['permission']).data.periodAmount='0x0';},(item:Record<string,unknown>)=>{item.dependencies=[{factory:stranger,factoryData:'0x'}];},
 ])await assert.rejects(requestRefill(wallet(edit),refillArgs()),unusable);
 await assert.rejects(requestRefill({request:async()=>({})},refillArgs()),unusable);
 await assert.rejects(requestRefill({request:async()=>{throw {code:4001,message:'User rejected the request'};}},refillArgs()),{code:4001});
 const deployed=await requestRefill(wallet(item=>{item.dependencies=[{factory:stranger,factoryData:'0x'}];}),refillArgs(['expiry'],async()=>true));assert.equal(deployed.eth.context,'0x01');
});
test('auto-refill grant storage keeps public data only and drops expired grants',()=>{
 store.clear();const grant:Grant={eth:{context:'0x01',periodAmount:5n},ice:{context:'0x02',periodAmount:7n},expiry:now+60};
 saveGrant(11155111,anvil0.address,ctx.session,grant);
 const key=`pepe:grant:11155111:${anvil0.address.toLowerCase()}:${ctx.session.toLowerCase()}`;assert.deepEqual([...store.keys()],[key]);
 assert.deepEqual(loadGrant(11155111,anvil0.address,ctx.session,now),grant);
 assert.equal(loadGrant(11155111,anvil0.address,stranger,now),undefined);
 assert.equal(loadGrant(11155111,anvil0.address,ctx.session,now+60),undefined);assert.equal(store.size,0);
 store.set(key,'{"eth":{"context":"nothex","periodAmount":"1"}}');assert.equal(loadGrant(11155111,anvil0.address,ctx.session,now),undefined);assert.equal(store.size,0);
 saveGrant(11155111,anvil0.address,ctx.session,grant);clearGrant(11155111,anvil0.address,ctx.session);assert.equal(store.size,0);
});
test('auto-refill pulls pass the game wallet allowlist',()=>{
 const grant:Grant={eth:{context:'0x01',periodAmount:5n},ice:{context:'0x02',periodAmount:7n},expiry:now+60};
 for(const kind of ['eth','ice'] as const){const c=redeemCall(grant,kind,{token:ctx.token,session:ctx.session},3n);assert.equal(c.to,DELEGATION_MANAGER);assert.equal(c.value,0n);assert.doesNotThrow(()=>checkSessionCall(c,ctx));}
 const [ctxIce]=decodeFunctionData({abi:delegationManagerAbi,data:redeemCall(grant,'ice',{token:ctx.token,session:ctx.session},3n).data}).args[0];assert.equal(ctxIce,'0x02');
});
test('mainnet holdings pin checksummed tokens and HTTPS RPCs',()=>{
 for(const a of Object.values(MAINNET_TOKENS))assert.equal(getAddress(a),a);
 assert.ok(MAINNET_RPCS.length>=2&&MAINNET_RPCS.every(u=>u.startsWith('https://')));
});
test('mainnet holdings read ETH, ICE and IMD; a failed read leaves only that field empty',async t=>{
 const warn=t.mock.method(console,'warn',()=>{});
 const word=(v:bigint)=>encodeAbiParameters([{type:'uint256'}],[v]);
 const client=(failImd:boolean)=>createPublicClient({chain:mainnet,transport:custom({async request({method,params}:{method:string;params?:unknown}){
  if(method==='eth_getBalance'){assert.equal((params as [string])[0].toLowerCase(),player.toLowerCase());return toHex(15n*10n**17n);}
  if(method==='eth_call'){const {to,data}=(params as [{to:string;data:Hex}])[0];assert.equal(decodeFunctionData({abi:erc20Abi,data}).args[0],getAddress(player));
   if(to.toLowerCase()===MAINNET_TOKENS.ice.toLowerCase())return word(12345n*10n**17n);
   if(failImd)throw Error('rpc down');return word(42n*10n**18n);}
  throw Error(`unexpected ${method}`);
 }})});
 assert.deepEqual(await readHoldings(player,client(false)),{eth:15n*10n**17n,ice:12345n*10n**17n,imd:42n*10n**18n});
 assert.equal(warn.mock.callCount(),0);
 assert.deepEqual(await readHoldings(player,client(true)),{eth:15n*10n**17n,ice:12345n*10n**17n});
 assert.equal(warn.mock.callCount(),1);assert.equal(warn.mock.calls[0].arguments[0],'mainnet holdings read failed');assert.equal((warn.mock.calls[0].arguments[1] as {field:string}).field,'imd');
});
test('mainnet holdings display: dash when disconnected, ellipsis while loading, ? on a failed read, 4 decimals truncated',()=>{
 assert.deepEqual(showHoldings(undefined),{eth:'—',ice:'—',imd:'—'});
 assert.deepEqual(showHoldings('loading'),{eth:'…',ice:'…',imd:'…'});
 assert.deepEqual(showHoldings({eth:15n*10n**17n,ice:12345n*10n**17n}),{eth:'1.5',ice:'1,234.5',imd:'?'});
 assert.deepEqual(showHoldings({eth:0n,ice:1234567n*10n**18n+123456789n*10n**9n,imd:42n*10n**18n}),{eth:'0',ice:'1,234,567.1234',imd:'42'});
});
