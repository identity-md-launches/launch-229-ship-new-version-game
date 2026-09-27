import { createWalletClient, custom, encodeFunctionData, formatUnits, maxUint256, parseEther, parseUnits, parseEventLogs, toHex, type Abi, type Address, type EIP1193Provider, type Hex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Runtime } from './config';
import { SESSION } from './chain.mjs';
import { drawWindow, errorMessage, isWin, MAX_UINT160, MAX_UINT48, minimumOut, permitAbi, playerData, poolId, poolKey, quoterAbi, rollFor, routerAbi, stateAbi, swapInput } from './protocol';
import { acquireTabLock, checkSessionCall, sessionKeyFromSignature, sessionMessage, type SessionContext } from './session';
import { loadGrant, redeemCall, refillSupport, requestRefill, saveGrant, type Grant } from './refill';
export type TicketView={id:string;block:string;roll?:number;status:string;win:boolean};
export type SessionView={address:Address;eth?:bigint;ice?:bigint;refill:'checking'|'available'|'unavailable'|'granted';grant?:{eth:bigint;ice:bigint;expiry:number}};
export type Snapshot={account?:Address;chainId?:number;verified:boolean;ready:boolean;busy:boolean;loading:boolean;message:string;ice?:bigint;eth?:bigint;potIce?:bigint;potEth?:bigint;decimals:number;price?:number;liquidity?:bigint;block?:bigint;updated?:number;tank:number;free:number;points:number;tickets:TicketView[];session?:SessionView;tx?:Hex;slippage:number};
type Call={to:Address;data:Hex;value:bigint;abi?:Abi;functionName?:string;args?:readonly unknown[]};
type Credit={kind:string;pees:number};
const BUSY='Still confirming the last move. Try again in a moment.';
const NO_SESSION='Start background play in panel 03 first.';
const NEED_ETH='The game wallet needs more Sepolia ETH. Use Top Up in panel 03.';
const now=()=>Math.floor(Date.now()/1000);
export const format=(value:bigint|undefined,decimals=18)=>value===undefined?'—':new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(Number(formatUnits(value,decimals)));
export class GameEngine {
 readonly key; readonly id; readonly token; readonly hook;
 private listeners=new Set<()=>void>(); private provider?:EIP1193Provider; private refreshing=-1; private epoch=0; private autoDraw=new Set<string>(); private attempted=new Set<string>();
 // Game wallet for this tab: the key lives only in `game` and is dropped on end, disconnect or account change.
 private game?:PrivateKeyAccount; private release?:()=>void; private grant?:Grant; private ruleTypes:string[]=[]; private nonce=0;
 state:Snapshot={verified:false,ready:false,busy:false,loading:true,message:'Checking deployment and pool…',decimals:18,tank:0,free:0,points:0,tickets:[],slippage:100};
 constructor(readonly runtime:Runtime){this.key=poolKey(runtime.d);this.id=poolId(this.key);this.token=runtime.d.contracts.find(c=>c.name==='PepeIce')!.address;this.hook=runtime.d.contracts.find(c=>c.name==='JackpotHook')!.address;}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 snapshot=()=>this.state;
 set(p:Partial<Snapshot>){this.state={...this.state,...p};this.listeners.forEach(fn=>fn());}
 message=(message:string)=>this.set({message});
 private localKey(account=this.state.account){return `pepe:${this.runtime.d.launchId}:${account?.toLowerCase()}`;}
 private saved(){try{return JSON.parse(localStorage.getItem(this.localKey())||'{}');}catch{return {};}}
 private save(extra:Record<string,unknown>={}) {try{localStorage.setItem(this.localKey(),JSON.stringify({...this.saved(),tank:this.state.tank,free:this.state.free,points:this.state.points,...extra}));}catch{this.message('Browser storage unavailable. Local tank and points last for this session.');}}
 async connect(account:Address|undefined,chainId:number|undefined,provider?:EIP1193Provider){
  const changed=account?.toLowerCase()!==this.state.account?.toLowerCase() || chainId!==this.state.chainId;
  this.provider=provider;if(!changed)return;
  this.dropSession();
  this.epoch++;this.autoDraw.clear();this.attempted.clear();
  this.set({account,chainId,ice:undefined,eth:undefined,tickets:[],ready:false,tank:0,free:0,points:0});
  if(account){const local=this.saved();this.set({tank:Math.max(0,Number(local.tank)||0),free:Math.max(0,Number(local.free)||0),points:Math.max(0,Number(local.points)||0),tx:local.pending?.hash});}
  await this.refresh();
  if(account && chainId===this.runtime.d.chainId){await this.recover();}
 }
 async read<T>(name:string,fn:string,args:readonly unknown[]=[]):Promise<T>{return await this.runtime.client.readContract({address:name==='PepeIce'?this.token:this.hook,abi:this.runtime.abis[name],functionName:fn,args}) as T;}
 async verify(){
  try {
   const {client,d}=this.runtime;
   if(await client.getChainId()!==d.chainId)throw Error('RPC is on the wrong chain. Transactions locked.');
   const addresses=[...d.contracts.map(c=>c.address),...Object.values(d.network.uniswapV4)];
   const codes=await Promise.all(addresses.map(address=>client.getCode({address})));
   if(codes.some(code=>!code||code==='0x'))throw Error('Deployment or Uniswap code is missing. Transactions locked.');
   if((await this.read<Address>('JackpotHook','poolManager')).toLowerCase()!==d.network.uniswapV4.poolManager.toLowerCase())throw Error('Hook PoolManager mismatch.');
   const decimals=Number(await this.read<number>('PepeIce','decimals'));
   this.set({verified:true,decimals});await this.refresh();
  }catch(e){this.set({verified:false,ready:false,loading:false,message:errorMessage(e)});}
 }
 async refresh(){
  // One refresh per connect epoch: a newer epoch never waits on (or is overwritten by) an older read.
  if(this.refreshing===this.epoch)return;
  const epoch=this.epoch;this.refreshing=epoch;const account=this.state.account;const game=this.game;
  try {
   const {client,d}=this.runtime;
   const block=await client.getBlockNumber({cacheTime:0});
   const [pots,slot,liquidity,eth,ice,gameEth,gameIce]=await Promise.all([
    this.read<[bigint,bigint]>('JackpotHook','pots',[this.id]),
    client.readContract({address:d.network.uniswapV4.stateView,abi:stateAbi,functionName:'getSlot0',args:[this.id]}),
    client.readContract({address:d.network.uniswapV4.stateView,abi:stateAbi,functionName:'getLiquidity',args:[this.id]}),
    account?client.getBalance({address:account}):undefined,
    account?this.read<bigint>('PepeIce','balanceOf',[account]):undefined,
    game?client.getBalance({address:game.address}):undefined,
    game?this.read<bigint>('PepeIce','balanceOf',[game.address]):undefined
   ]);
   if(epoch!==this.epoch)return;
   const active=slot[0]>0n; // A one-sided position may be crossed from zero current liquidity.
   this.set({block,potEth:pots[0],potIce:pots[1],eth,ice,liquidity,price:slot[0]===0n?undefined:(Number(slot[0])/2**96)**2*10**(18-this.state.decimals),ready:this.state.verified&&active,loading:false,updated:Date.now()});
   if(game&&this.game===game&&this.state.session)this.set({session:{...this.state.session,eth:gameEth,ice:gameIce}});
   if(!active)this.message('The pool is not initialized. Transactions are locked; try refresh later.');
   else if(this.state.message==='Checking deployment and pool…')this.message('');
   if(account)await this.updateTickets(block,account,epoch);
  }catch(e){if(epoch===this.epoch)this.set({ready:false,loading:false,message:`Live reads unavailable. ${errorMessage(e)}`});}
  finally{if(this.refreshing===epoch)this.refreshing=-1;}
 }
 private async updateTickets(block:bigint,account:Address,epoch:number){
  const {client,abis}=this.runtime;
  const logs=await client.getContractEvents({address:this.hook,abi:abis.JackpotHook,eventName:'TicketIssued',args:{poolId:this.id,player:account},fromBlock:block>256n?block-256n:0n,toBlock:block});
  const ids=logs.map(log=>(log.args as unknown as {ticketId:bigint}).ticketId).reverse().slice(0,20);
  const tickets=await Promise.all(ids.map(async id=>{
   const t=await this.read<{player:Address;currency:Address;fee:bigint;blockNumber:bigint;drawn:boolean}>('JackpotHook','ticket',[this.id,id]);
   const result:TicketView={id:id.toString(),block:t.blockNumber.toString(),status:'Waiting for block '+(t.blockNumber+2n),win:false};
   if(t.player.toLowerCase()!==account.toLowerCase())throw Error('Ticket player mismatch.');
   const window=drawWindow(t.blockNumber,block);
   if(window==='expired'){result.status='Expired';return result;}
   if(window==='ready'){
    const next=await client.getBlock({blockNumber:t.blockNumber+1n});
    result.roll=rollFor(next.hash,this.id,id);result.win=!t.drawn&&isWin(result.roll);
    result.status=t.drawn?'Draw confirmed':result.win?'Winner · claim before block '+(t.blockNumber+257n):'No win · no draw transaction';
   }
   return result;
  }));
  if(epoch!==this.epoch)return;this.set({tickets});
  const win=tickets.find(t=>t.win&&this.autoDraw.has(t.id)&&!this.attempted.has(t.id));
  if(win&&!this.state.busy&&this.game){this.attempted.add(win.id);void this.draw(win.id);}
 }
 private guard(session=true){
  if(!this.state.account||!this.provider)throw Error('Connect a browser wallet to play.');
  if(this.state.chainId!==this.runtime.d.chainId)throw Error(`Wrong network. Switch to ${this.runtime.d.network.name}.`);
  if(!this.state.verified||!this.state.ready||!this.state.updated||Date.now()-this.state.updated>45000)throw Error('Live pool verification is needed. Press Refresh.');
  if(this.state.busy)throw Error(BUSY);
  if(this.saved().pending)throw Error('A previous transaction is pending. Reconnect after it confirms to restore it.');
  if(session&&!this.game)throw Error(NO_SESSION);
 }
 private async walletGuard(account:Address){
  if(!this.provider)throw Error('Connect your wallet.');
  const [chain,accounts]=await Promise.all([this.provider.request({method:'eth_chainId'}),this.provider.request({method:'eth_accounts'})]);
  if(Number(chain)!==this.runtime.d.chainId || (accounts as Address[])[0]?.toLowerCase()!==account.toLowerCase() || this.state.account?.toLowerCase()!==account.toLowerCase())throw Error('Wallet changed. Reconnect and try again.');
 }
 // Player transactions: only funding the game wallet (one wallet prompt each).
 private async sendPlayer(to:Address,data:Hex,value:bigint,prompt:string){
  const account=this.state.account!;
  await this.walletGuard(account);
  this.message('Checking the move on chain…');
  await this.runtime.client.call({account,to,data,value});
  await this.walletGuard(account);
  this.message(prompt);
  const wallet=createWalletClient({chain:this.runtime.chain,transport:custom(this.provider!)});
  const hash=await wallet.sendTransaction({account,chain:this.runtime.chain,to,data:data==='0x'?undefined:data,value});
  this.set({tx:hash,message:'Transaction sent. Waiting for confirmation…'});
  const receipt=await this.runtime.client.waitForTransactionReceipt({hash,timeout:120000});
  if(receipt.status!=='success')throw Error('Transaction reverted. Nothing was moved.');
 }
 private active(){if(!this.game)throw Error(NO_SESSION);return this.game;}
 private call(to:Address,abi:Abi,functionName:string,args:readonly unknown[],value=0n):Call{return {to,abi,functionName,args,value,data:encodeFunctionData({abi,functionName,args})};}
 private context():SessionContext{
  const u=this.runtime.d.network.uniswapV4;
  return {player:this.state.account!,session:this.active().address,token:this.token,hook:this.hook,permit2:u.permit2,router:u.universalRouter,key:this.key,tokenAbi:this.runtime.abis.PepeIce,hookAbi:this.runtime.abis.JackpotHook};
 }
 // Game-wallet transactions: allowlist, simulate, sign locally, broadcast. No wallet prompt.
 private async broadcast(c:Call){
  const game=this.active();
  checkSessionCall(c,this.context());
  const client=this.runtime.client;
  if(c.abi&&c.functionName)await client.simulateContract({address:c.to,abi:c.abi,functionName:c.functionName,args:c.args,account:game.address,value:c.value});
  else if(c.data!=='0x')await client.call({account:game.address,to:c.to,data:c.data,value:c.value});
  const nonce=Math.max(await client.getTransactionCount({address:game.address,blockTag:'pending'}),this.nonce);
  const hash=await createWalletClient({account:game,chain:this.runtime.chain,transport:this.runtime.transport}).sendTransaction({to:c.to,data:c.data==='0x'?undefined:c.data,value:c.value,nonce});
  if(this.game===game)this.nonce=nonce+1;
  this.set({tx:hash});
  return hash;
 }
 private async settle(hash:Hex,credit?:Credit,payer?:Address){
  const account=this.state.account;
  const receipt=await this.runtime.client.waitForTransactionReceipt({hash,timeout:120000});
  if(receipt.status!=='success'){if(credit&&this.state.account===account)this.save({pending:null});throw Error('Transaction reverted. No game credit added.');}
  if(this.state.account!==account)throw Error('Confirmed for the previous wallet. Reconnect it to restore the result.');
  if(credit)this.applyReceipt(receipt,credit.kind,credit.pees,payer!);
  return receipt;
 }
 private async sendSession(c:Call,credit?:Credit,sent='Sent from the game wallet. Waiting for confirmation…'){
  const payer=this.active().address;
  const hash=await this.broadcast(c);
  if(credit)this.save({pending:{hash,kind:credit.kind,pees:credit.pees,from:payer}});
  this.message(sent);
  return await this.settle(hash,credit,payer);
 }
 private applyReceipt(receipt:{transactionHash:Hex;logs:readonly unknown[]},kind:string,pees:number,payer:Address){
  const saved=this.saved();const credited:string[]=saved.credited||[];
  const logs=receipt.logs as Parameters<typeof parseEventLogs>[0]['logs'];
  const issued=parseEventLogs({abi:this.runtime.abis.JackpotHook,eventName:'TicketIssued',logs,strict:true}).filter(log=>{
   const args=log.args as unknown as {poolId:Hex;player:Address};
   return log.address.toLowerCase()===this.hook.toLowerCase()&&args.poolId===this.id&&args.player.toLowerCase()===this.state.account?.toLowerCase();
  });
  if(!credited.includes(receipt.transactionHash)){
   if(kind==='tank'){
    // fillTank credits msg.sender, which is the game wallet for background fills.
    const filled=parseEventLogs({abi:this.runtime.abis.JackpotHook,eventName:'TankFilled',logs,strict:true}).some(log=>{
     const args=log.args as unknown as {poolId:Hex;player:Address;pees:bigint};
     return log.address.toLowerCase()===this.hook.toLowerCase()&&args.poolId===this.id&&args.player.toLowerCase()===payer.toLowerCase()&&args.pees===BigInt(pees);
    });
    if(!filled){this.save({pending:null});throw Error('No matching TankFilled event. No local credit added; check the transaction.');}
    this.set({tank:this.state.tank+pees});
   }
   if(kind==='throne'){
    if(!issued.length){this.save({pending:null});throw Error('No matching swap ticket. No free bursts added; check the transaction.');}
    this.set({free:this.state.free+5});
   }
   credited.push(receipt.transactionHash);
  }
  for(const log of issued){const args=log.args as unknown as {ticketId:bigint};this.autoDraw.add(args.ticketId.toString());}
  this.save({pending:null,credited:credited.slice(-100)});
 }
 private async recover(){
  const pending=this.saved().pending;if(!pending?.hash)return;
  this.set({busy:true,message:'Restoring the pending transaction…'});
  try{const receipt=await this.runtime.client.waitForTransactionReceipt({hash:pending.hash,timeout:15000});if(receipt.status==='success'){this.applyReceipt(receipt,pending.kind,pending.pees,pending.from??this.state.account);this.message('Confirmed move restored.');}else{this.save({pending:null});this.message('Previous transaction reverted.');}}
  catch{this.message('A previous transaction is still pending. Refresh after it confirms.');}
  finally{this.set({busy:false});}
 }
 private failure(e:unknown){const text=errorMessage(e);return /insufficient funds|exceeds the balance/i.test(text)?NEED_ETH:text;}
 private grantView(){return this.grant&&{eth:this.grant.eth.periodAmount,ice:this.grant.ice.periodAmount,expiry:this.grant.expiry};}
 private async gameBalances(){
  const game=this.active();
  const [eth,ice]=await Promise.all([this.runtime.client.getBalance({address:game.address}),this.read<bigint>('PepeIce','balanceOf',[game.address])]);
  if(this.game===game&&this.state.session)this.set({session:{...this.state.session,eth,ice}});
  return {eth,ice};
 }
 private dropSession(){
  this.game=undefined;this.grant=undefined;this.ruleTypes=[];this.nonce=0;
  this.release?.();this.release=undefined;
  if(this.state.session)this.set({session:undefined});
 }
 async startSession(){
  if(this.state.busy){this.message(BUSY);return;}
  let release:(()=>void)|null=null;let funded=false;
  try{
   this.guard(false);if(this.game)return;
   const account=this.state.account!;const epoch=this.epoch;const chainId=this.runtime.d.chainId;
   this.set({busy:true});
   release=await acquireTabLock(account);
   if(!release)throw Error('Background play is open in another tab. End it there first.');
   this.message('Sign the session message in your wallet.');
   const message=sessionMessage(chainId,account);
   const signature=await this.provider!.request({method:'personal_sign',params:[toHex(message),account]}) as Hex;
   const key=await sessionKeyFromSignature(signature,message,account);
   if(epoch!==this.epoch)throw Error('Wallet changed. Start background play again.');
   const game=privateKeyToAccount(key);
   // Only the public address is remembered, to spot wallets whose signatures change between visits.
   let warning='';const last=`pepe:session:${chainId}:${account.toLowerCase()}`;
   try{const before=localStorage.getItem(last);if(before&&before.toLowerCase()!==game.address.toLowerCase())warning='This wallet signed differently than last visit, so this is a new game wallet. Withdraw to Wallet before you leave.';localStorage.setItem(last,game.address);}catch{/* Storage unavailable: skip the check. */}
   this.game=game;this.release=release;release=null;this.nonce=0;
   this.grant=loadGrant(chainId,account,game.address,now());
   this.set({session:{address:game.address,refill:this.grant?'granted':'checking',grant:this.grantView()}});
   if(!this.grant){const rules=await refillSupport(this.provider!,chainId);this.ruleTypes=rules??[];if(this.game===game)this.set({session:{...this.state.session!,refill:rules?'available':'unavailable'}});}
   const {eth}=await this.gameBalances();funded=eth>0n;
   this.message(warning||(funded?'Background play is on.':'Background play is on. Top up the game wallet with a little Sepolia ETH to start.'));
  }catch(e){release?.();this.message(errorMessage(e));}
  finally{this.set({busy:false});}
  if(funded)await this.warmUp();
 }
 endSession(message='Background play ended. Funds stay in the game wallet until you withdraw.'){
  if(this.state.busy){this.message(BUSY);return;}
  this.dropSession();this.message(message);
 }
 async allowRefill(){
  if(this.state.busy){this.message(BUSY);return;}
  try{
   this.guard();const game=this.game!;const account=this.state.account!;const chainId=this.runtime.d.chainId;
   this.set({busy:true,message:'Confirm auto-refill in your wallet.'});
   const grant=await requestRefill(this.provider!,{player:account,session:game.address,chainId,token:this.token,decimals:this.state.decimals,ruleTypes:this.ruleTypes,now:now(),hasCode:async address=>{const code=await this.runtime.client.getCode({address});return !!code&&code!=='0x';}});
   if(this.game!==game)throw Error('Background play ended. Start it again to allow auto-refill.');
   this.grant=grant;saveGrant(chainId,account,game.address,grant);
   this.set({session:{...this.state.session!,refill:'granted',grant:this.grantView()},message:'Auto-refill is on.'});
  }catch(e){this.message(errorMessage(e));}finally{this.set({busy:false});}
 }
 // Pull from the player's grant: a full chunk first, the exact shortfall if the period has less left.
 private async refill(kind:'eth'|'ice',short:bigint,chunk:bigint){
  this.message('Refilling the game wallet…');
  const game=this.active();
  for(const amount of short<chunk?[chunk,short]:[short]){
   const c=redeemCall(this.grant!,kind,{token:this.token,session:game.address},amount);
   try{await this.runtime.client.call({account:game.address,to:c.to,data:c.data});}catch{continue;}
   await this.sendSession(c);return;
  }
  throw Error('Auto-refill is used up for today or your wallet is short. Top up by hand or wait for the next period.');
 }
 // The move's own value, plus a gas reserve when auto-refill can keep it topped up.
 private async ensureFunds(need:{eth?:bigint;ice?:bigint}){
  let {eth,ice}=await this.gameBalances();
  const ethShort=(need.eth??0n)+(this.grant?parseEther(SESSION.gasReserve):0n)-eth;
  if(ethShort>0n){
   if(!this.grant)throw Error(NEED_ETH);
   await this.refill('eth',ethShort,parseEther(SESSION.ethChunk));({eth,ice}=await this.gameBalances());
  }
  const iceShort=(need.ice??0n)-ice;
  if(iceShort>0n){
   if(!this.grant)throw Error('The game wallet needs more ICE. Use Move ICE in panel 03.');
   await this.refill('ice',iceShort,parseUnits(SESSION.iceChunk,this.state.decimals));
  }
 }
 private async missingApprovals(kind:'swap'|'tank'|'all',amount:bigint){
  const game=this.active().address;const {permit2,universalRouter}=this.runtime.d.network.uniswapV4;const ice=this.runtime.abis.PepeIce;const calls:Call[]=[];
  if(kind!=='tank'){
   const [allowance,permit]=await Promise.all([this.read<bigint>('PepeIce','allowance',[game,permit2]),this.runtime.client.readContract({address:permit2,abi:permitAbi,functionName:'allowance',args:[game,this.token,universalRouter]})]);
   if(allowance<amount)calls.push(this.call(this.token,ice,'approve',[permit2,maxUint256]));
   if(permit[0]<amount||permit[1]<now()+300)calls.push(this.call(permit2,permitAbi,'approve',[this.token,universalRouter,MAX_UINT160,Number(MAX_UINT48)]));
  }
  if(kind!=='swap'&&await this.read<bigint>('PepeIce','allowance',[game,this.hook])<amount)calls.push(this.call(this.token,ice,'approve',[this.hook,maxUint256]));
  return calls;
 }
 // One-time max approvals, broadcast back to back with consecutive nonces, then confirmed together.
 private async approve(calls:Call[]){
  if(!calls.length)return;
  this.message('Setting up the game wallet (one-time approvals)…');
  const hashes:Hex[]=[];for(const c of calls)hashes.push(await this.broadcast(c));
  for(const hash of hashes)await this.settle(hash);
 }
 private async ensureApprovals(kind:'swap'|'tank',amount:bigint){await this.approve(await this.missingApprovals(kind,amount));}
 private async warmUp(){
  if(this.state.busy||!this.game)return;
  try{
   this.set({busy:true});
   const calls=await this.missingApprovals('all',1n);
   if(calls.length){await this.approve(calls);this.message('Game wallet ready.');}
  }catch(e){this.message(this.failure(e));}finally{this.set({busy:false});}
 }
 async topUp(eth:string){
  if(this.state.busy){this.message(BUSY);return;}
  let done=false;
  try{
   this.guard();const value=parseEther(eth);if(value<=0n)throw Error('Choose a top-up amount.');
   this.set({busy:true});
   await this.sendPlayer(this.game!.address,'0x',value,`Confirm the ${eth} ETH top-up in your wallet.`);
   done=true;this.message('Top-up confirmed.');
  }catch(e){this.message(errorMessage(e));}finally{this.set({busy:false});}
  if(done)await this.warmUp();
  await this.refresh();
 }
 async moveIce(ice:string){
  if(this.state.busy){this.message(BUSY);return;}
  try{
   this.guard();const amount=parseUnits(ice,this.state.decimals);if(amount<=0n)throw Error('Choose an ICE amount.');
   this.set({busy:true});
   await this.sendPlayer(this.token,encodeFunctionData({abi:this.runtime.abis.PepeIce,functionName:'transfer',args:[this.game!.address,amount]}),0n,`Confirm moving ${format(amount,this.state.decimals)} ICE in your wallet.`);
   this.message('ICE moved to the game wallet.');
  }catch(e){this.message(errorMessage(e));}finally{this.set({busy:false});await this.refresh();}
 }
 async withdraw(){
  if(this.state.busy){this.message(BUSY);return;}
  try{
   this.guard();const account=this.state.account!;
   this.set({busy:true,message:'Withdrawing to your wallet…'});
   let {eth,ice}=await this.gameBalances();
   if(ice>0n){await this.sendSession(this.call(this.token,this.runtime.abis.PepeIce,'transfer',[account,ice]));({eth}=await this.gameBalances());}
   // Keep twice the cost of the plain transfer itself; the rest goes back to the player.
   const {maxFeePerGas}=await this.runtime.client.estimateFeesPerGas();
   const keep=21000n*maxFeePerGas*2n;const value=eth>keep?eth-keep:0n;
   if(value>0n)await this.sendSession({to:account,data:'0x',value});
   this.message(ice>0n||value>0n?'Withdrawn to your wallet.':'Nothing to withdraw.');
  }catch(e){this.message(this.failure(e));}finally{this.set({busy:false});await this.refresh();}
 }
 async swap(ethIn:boolean,amount:string,throne=false){
  if(this.state.busy){this.message(BUSY);return;}
  try{
   this.guard();const account=this.state.account!;
   this.set({busy:true,message:throne?'Buying ICE in the background…':'Swapping in the background…'});
   const input=parseUnits(amount,ethIn?18:this.state.decimals);
   if(input<=0n||input>=(1n<<128n))throw Error('Enter a valid swap amount.');
   await this.ensureFunds(ethIn?{eth:input}:{ice:input});
   if(!ethIn)await this.ensureApprovals('swap',input);
   const u=this.runtime.d.network.uniswapV4;
   const {result}=await this.runtime.client.simulateContract({address:u.quoter,abi:quoterAbi,functionName:'quoteExactInputSingle',args:[{poolKey:this.key,zeroForOne:ethIn,exactAmount:input,hookData:playerData(account)}],account:this.active().address});
   const minimum=minimumOut(result[0],this.state.slippage);if(minimum<=0n)throw Error('The pool returned no output. Try a different amount.');
   await this.sendSession(this.call(u.universalRouter,routerAbi,'execute',['0x10',[swapInput(this.key,ethIn,input,minimum,account)],BigInt(now()+300)],ethIn?input:0n),{kind:throne?'throne':'swap',pees:0},'Swap sent. Waiting for confirmation…');
   this.message(throne?'Throne buy confirmed. Five free climb bursts added.':'Swap confirmed. Waiting for the ticket’s future block…');
  }catch(e){this.message(this.failure(e));}finally{this.set({busy:false});await this.refresh();}
 }
 async fillTank(pees:number){
  if(this.state.busy){this.message(BUSY);return;}
  try{
   this.guard();if(!Number.isInteger(pees)||pees<1||pees>1000)throw Error('Choose 1–1000 pees.');
   this.set({busy:true,message:'Filling the tank in the background…'});
   const amount=BigInt(pees)*await this.read<bigint>('JackpotHook','ICE_PER_PEE');
   await this.ensureFunds({ice:amount});
   await this.ensureApprovals('tank',amount);
   await this.sendSession(this.call(this.hook,this.runtime.abis.JackpotHook,'fillTank',[this.key,BigInt(pees)]),{kind:'tank',pees},'Tank fill sent. Waiting for confirmation…');
   this.message('Tank filled. Each pee uses one local charge.');
  }catch(e){this.message(this.failure(e));}finally{this.set({busy:false});await this.refresh();}
 }
 async draw(id:string){
  if(this.state.busy){this.message(BUSY);return;}
  try {
   this.guard();this.set({busy:true});
   const t=await this.read<{blockNumber:bigint;drawn:boolean;player:Address}>('JackpotHook','ticket',[this.id,BigInt(id)]);
   const block=await this.runtime.client.getBlockNumber({cacheTime:0});
   if(t.drawn||t.player.toLowerCase()!==this.state.account!.toLowerCase()||drawWindow(t.blockNumber,block)!=='ready')throw Error('Ticket is not claimable. Refresh the board.');
   const next=await this.runtime.client.getBlock({blockNumber:t.blockNumber+1n});const roll=rollFor(next.hash,this.id,BigInt(id));
   if(!isWin(roll))throw Error(`Roll ${roll}: no win. No draw transaction needed.`);
   this.message(`Roll ${roll}! Claiming the payout in the background…`);
   if(this.grant)await this.ensureFunds({});
   const receipt=await this.sendSession(this.call(this.hook,this.runtime.abis.JackpotHook,'draw',[this.id,BigInt(id)]),undefined,'Claim sent. Waiting for confirmation…');
   const drawn=parseEventLogs({abi:this.runtime.abis.JackpotHook,eventName:'Drawn',logs:receipt.logs,strict:true}).some(log=>{const args=log.args as unknown as {poolId:Hex;ticketId:bigint};return log.address.toLowerCase()===this.hook.toLowerCase()&&args.poolId===this.id&&args.ticketId===BigInt(id);});
   if(!drawn)throw Error('No matching Drawn event. Refresh and check the transaction.');
   this.message(`Roll ${roll} payout confirmed. The pots and balances are refreshed.`);
  }catch(e){this.message(this.failure(e));}finally{this.set({busy:false});await this.refresh();}
 }
 consumePee(){if(!this.state.account||this.state.tank<1){this.message('Tank empty. Fill it with ICE first.');return false;}this.set({tank:this.state.tank-1});this.save();return true;}
 consumeBurst(){if(this.state.free>0){this.set({free:this.state.free-1});this.save();return true;}return this.consumePee();}
 addPoints(n:number){this.set({points:this.state.points+n});this.save();}
 setSlippage(bps:number){try{minimumOut(10000n,bps);this.set({slippage:bps});}catch(e){this.message(errorMessage(e));}}
}
