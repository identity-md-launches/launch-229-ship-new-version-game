import { createWalletClient, custom, encodeFunctionData, formatUnits, parseUnits, parseEventLogs, type Abi, type Address, type EIP1193Provider, type Hex } from 'viem';
import type { Runtime } from './config';
import { drawWindow, errorMessage, isWin, minimumOut, permitAbi, playerData, poolId, poolKey, quoterAbi, rollFor, routerAbi, stateAbi, swapInput } from './protocol';
export type TicketView={id:string;block:string;roll?:number;status:string;win:boolean};
export type Intent={kind:'swap';ethIn:boolean;amount:bigint;throne:boolean;out:bigint;minimum:bigint;created:number;step:'token'|'permit'|'swap'}|{kind:'tank';pees:number;amount:bigint;step:'approve'|'fill'};
export type Snapshot={account?:Address;chainId?:number;verified:boolean;ready:boolean;busy:boolean;loading:boolean;message:string;ice?:bigint;eth?:bigint;potIce?:bigint;potEth?:bigint;decimals:number;price?:number;liquidity?:bigint;block?:bigint;updated?:number;tank:number;free:number;points:number;tickets:TicketView[];intent?:Intent;tx?:Hex;slippage:number};
export const format=(value:bigint|undefined,decimals=18)=>value===undefined?'—':new Intl.NumberFormat(undefined,{maximumFractionDigits:6}).format(Number(formatUnits(value,decimals)));
export class GameEngine {
 readonly key; readonly id; readonly token; readonly hook;
 private listeners=new Set<()=>void>(); private provider?:EIP1193Provider; private refreshing=false; private session=0; private autoDraw=new Set<string>(); private attempted=new Set<string>();
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
  this.session++;this.autoDraw.clear();this.attempted.clear();
  this.set({account,chainId,ice:undefined,eth:undefined,tickets:[],intent:undefined,ready:false,tank:0,free:0,points:0});
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
  if(this.refreshing)return;this.refreshing=true;
  const session=this.session;const account=this.state.account;
  try {
   const {client,d}=this.runtime;
   const block=await client.getBlockNumber({cacheTime:0});
   const [pots,slot,liquidity,eth,ice]=await Promise.all([
    this.read<[bigint,bigint]>('JackpotHook','pots',[this.id]),
    client.readContract({address:d.network.uniswapV4.stateView,abi:stateAbi,functionName:'getSlot0',args:[this.id]}),
    client.readContract({address:d.network.uniswapV4.stateView,abi:stateAbi,functionName:'getLiquidity',args:[this.id]}),
    account?client.getBalance({address:account}):undefined,
    account?this.read<bigint>('PepeIce','balanceOf',[account]):undefined
   ]);
   if(session!==this.session)return;
   const active=slot[0]>0n; // A one-sided position may be crossed from zero current liquidity.
   this.set({block,potEth:pots[0],potIce:pots[1],eth,ice,liquidity,price:slot[0]===0n?undefined:(Number(slot[0])/2**96)**2*10**(18-this.state.decimals),ready:this.state.verified&&active,loading:false,updated:Date.now()});
   if(!active)this.message('The pool is not initialized. Transactions are locked; try refresh later.');
   else if(this.state.message==='Checking deployment and pool…')this.message('');
   if(account)await this.updateTickets(block,account,session);
  }catch(e){if(session===this.session)this.set({ready:false,loading:false,message:`Live reads unavailable. ${errorMessage(e)}`});}
  finally{this.refreshing=false;}
 }
 private async updateTickets(block:bigint,account:Address,session:number){
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
  if(session!==this.session)return;this.set({tickets});
  const win=tickets.find(t=>t.win&&this.autoDraw.has(t.id)&&!this.attempted.has(t.id));
  if(win&&!this.state.busy){this.attempted.add(win.id);void this.draw(win.id);}
 }
 private guard(){
  if(!this.state.account||!this.provider)throw Error('Connect a browser wallet to play.');
  if(this.state.chainId!==this.runtime.d.chainId)throw Error(`Wrong network. Switch to ${this.runtime.d.network.name}.`);
  if(!this.state.verified||!this.state.ready||!this.state.updated||Date.now()-this.state.updated>45000)throw Error('Live pool verification is needed. Press Refresh.');
  if(this.state.busy)throw Error('One wallet move at a time. Wait for confirmation.');
  if(this.saved().pending)throw Error('A previous transaction is pending. Reconnect after it confirms to restore it.');
 }
 private async walletGuard(account:Address){
  if(!this.provider)throw Error('Connect your wallet.');
  const [chain,accounts]=await Promise.all([this.provider.request({method:'eth_chainId'}),this.provider.request({method:'eth_accounts'})]);
  if(Number(chain)!==this.runtime.d.chainId || (accounts as Address[])[0]?.toLowerCase()!==account.toLowerCase() || this.state.account?.toLowerCase()!==account.toLowerCase())throw Error('Wallet changed. Reconnect and review the move again.');
 }
 private async send(address:Address,abi:Abi,functionName:string,args:readonly unknown[],value=0n,kind='other',pees=0){
  const account=this.state.account!;
  await this.walletGuard(account);
  this.message('Checking the move on chain…');
  await this.runtime.client.simulateContract({address,abi,functionName,args,account,value});
  await this.walletGuard(account);
  this.message(`Confirm ${functionName} in your wallet.`);
  const wallet=createWalletClient({chain:this.runtime.chain,transport:custom(this.provider!)});
  const hash=await wallet.sendTransaction({account,chain:this.runtime.chain,to:address,data:encodeFunctionData({abi,functionName,args}),value});
  const key=this.localKey(account);
  try{const saved=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...saved,pending:{hash,kind,pees}}));}catch{/* Session still usable. */}
  this.set({tx:hash,message:'Transaction sent. Waiting for confirmation…'});
  const receipt=await this.runtime.client.waitForTransactionReceipt({hash,timeout:120000});
  if(receipt.status!=='success'){if(this.state.account===account)this.save({pending:null});throw Error('Transaction reverted. No game credit added.');}
  if(this.state.account!==account)throw Error('Confirmed for the previous wallet. Reconnect it to restore the result.');
  this.applyReceipt(receipt,kind,pees);
  return receipt;
 }
 private applyReceipt(receipt:{transactionHash:Hex;logs:readonly unknown[]},kind:string,pees:number){
  const saved=this.saved();const credited:string[]=saved.credited||[];
  const logs=receipt.logs as Parameters<typeof parseEventLogs>[0]['logs'];
  const issued=parseEventLogs({abi:this.runtime.abis.JackpotHook,eventName:'TicketIssued',logs,strict:true}).filter(log=>{
   const args=log.args as unknown as {poolId:Hex;player:Address};
   return log.address.toLowerCase()===this.hook.toLowerCase()&&args.poolId===this.id&&args.player.toLowerCase()===this.state.account?.toLowerCase();
  });
  if(!credited.includes(receipt.transactionHash)){
   if(kind==='tank'){
    const filled=parseEventLogs({abi:this.runtime.abis.JackpotHook,eventName:'TankFilled',logs,strict:true}).some(log=>{
     const args=log.args as unknown as {poolId:Hex;player:Address;pees:bigint};
     return log.address.toLowerCase()===this.hook.toLowerCase()&&args.poolId===this.id&&args.player.toLowerCase()===this.state.account?.toLowerCase()&&args.pees===BigInt(pees);
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
  this.save({pending:null,credited});
 }
 private async recover(){
  const pending=this.saved().pending;if(!pending?.hash)return;
  this.set({busy:true,message:'Restoring the pending transaction…'});
  try{const receipt=await this.runtime.client.waitForTransactionReceipt({hash:pending.hash,timeout:15000});if(receipt.status==='success'){this.applyReceipt(receipt,pending.kind,pending.pees);this.message('Confirmed move restored.');}else{this.save({pending:null});this.message('Previous transaction reverted.');}}
  catch{this.message('A previous transaction is still pending. Refresh after it confirms.');}
  finally{this.set({busy:false});}
 }
 async prepareSwap(ethIn:boolean,amount:string,throne=false){
  if(this.state.busy){this.message('One wallet move at a time. Wait for confirmation.');return;}
  try {
   this.guard();const session=this.session;this.set({busy:true,intent:undefined,message:'Asking the pool for a quote…'});
   const input=parseUnits(amount,ethIn?18:this.state.decimals);
   if(input<=0n||input>=(1n<<128n))throw Error('Enter a valid swap amount.');
   if(input>(ethIn?this.state.eth??0n:this.state.ice??0n))throw Error(`Not enough ${ethIn?'Sepolia ETH':'ICE'}. ${ethIn?'Get test ETH from a faucet.':'Try the golden throne first.'}`);
   const zeroForOne=ethIn;
   const {result}=await this.runtime.client.simulateContract({address:this.runtime.d.network.uniswapV4.quoter,abi:quoterAbi,functionName:'quoteExactInputSingle',args:[{poolKey:this.key,zeroForOne,exactAmount:input,hookData:playerData(this.state.account!)}],account:this.state.account!});
   const out=result[0];const minimum=minimumOut(out,this.state.slippage);if(minimum<=0n)throw Error('The pool returned no output. Try a different amount.');
   let step:'token'|'permit'|'swap'='swap';
   if(!ethIn){
    const uni=this.runtime.d.network.uniswapV4;
    const [allowance,permit]=await Promise.all([this.read<bigint>('PepeIce','allowance',[this.state.account!,uni.permit2]),this.runtime.client.readContract({address:uni.permit2,abi:permitAbi,functionName:'allowance',args:[this.state.account!,this.token,uni.universalRouter]})]);
    step=allowance<input?'token':permit[0]<input||permit[1]<Date.now()/1000+300?'permit':'swap';
   }
   if(session!==this.session)throw Error('Wallet changed. Quote again.');
   this.set({intent:{kind:'swap',ethIn,amount:input,throne,out,minimum,created:Date.now(),step},message:'Quote ready. Review the amount and each wallet step.'});
  }catch(e){this.message(errorMessage(e));}finally{this.set({busy:false});}
 }
 async prepareTank(pees:number){
  if(this.state.busy){this.message('One wallet move at a time. Wait for confirmation.');return;}
  try{
   this.guard();if(!Number.isInteger(pees)||pees<1||pees>1000)throw Error('Choose 1–1000 pees.');
   this.set({busy:true,intent:undefined});const session=this.session;
   const amount=BigInt(pees)*await this.read<bigint>('JackpotHook','ICE_PER_PEE');
   if(amount>(this.state.ice??0n))throw Error('Not enough ICE for the tank. Try the golden throne first.');
   const allowance=await this.read<bigint>('PepeIce','allowance',[this.state.account!,this.hook]);
   if(session!==this.session)throw Error('Wallet changed. Review the tank again.');
   this.set({intent:{kind:'tank',pees,amount,step:allowance<amount?'approve':'fill'},message:`Fill ${pees} pees for ${format(amount,this.state.decimals)} ICE. This funds the ICE pot.`});
  }catch(e){this.message(errorMessage(e));}finally{this.set({busy:false});}
 }
 async advance(){
  if(this.state.busy){this.message('One wallet move at a time. Wait for confirmation.');return;}
  try{
   this.guard();const i=this.state.intent;if(!i)throw Error('Choose a move first.');
   if(i.kind==='swap'&&Date.now()-i.created>30000){this.set({intent:undefined});throw Error('Quote expired. Get a fresh quote before continuing.');}
   this.set({busy:true});const {abis,d}=this.runtime;const u=d.network.uniswapV4;
   if(i.kind==='tank'){
    if(i.step==='approve'){await this.send(this.token,abis.PepeIce,'approve',[this.hook,i.amount]);this.set({intent:{...i,step:'fill'},message:'Tank approval confirmed. Now fill the tank.'});}
    else{await this.send(this.hook,abis.JackpotHook,'fillTank',[this.key,BigInt(i.pees)],0n,'tank',i.pees);this.set({intent:undefined,message:'Tank filled. Each pee uses one local charge.'});}
   }else if(i.step==='token'){
    await this.send(this.token,abis.PepeIce,'approve',[u.permit2,i.amount]);this.set({intent:undefined,message:'ICE approval confirmed. Refresh the quote for the Permit2 step.'});
   }else if(i.step==='permit'){
    await this.send(u.permit2,permitAbi,'approve',[this.token,u.universalRouter,i.amount,Math.floor(Date.now()/1000)+1800]);this.set({intent:undefined,message:'Router allowance confirmed. Refresh the quote to swap.'});
   }else{
    await this.send(u.universalRouter,routerAbi,'execute',['0x10',[swapInput(this.key,i.ethIn,i.amount,i.minimum,this.state.account!)],BigInt(Math.floor(Date.now()/1000)+300)],i.ethIn?i.amount:0n,i.throne?'throne':'swap');
    this.set({intent:undefined,message:'Swap confirmed. Waiting for the ticket’s future block…'});
   }
  }catch(e){this.message(errorMessage(e));}finally{this.set({busy:false});await this.refresh();}
 }
 async draw(id:string){
  if(this.state.busy){this.message('One wallet move at a time. Wait for confirmation.');return;}
  try {
   this.guard();this.set({busy:true});
   const t=await this.read<{blockNumber:bigint;drawn:boolean;player:Address}>('JackpotHook','ticket',[this.id,BigInt(id)]);
   const block=await this.runtime.client.getBlockNumber({cacheTime:0});
   if(t.drawn||t.player.toLowerCase()!==this.state.account!.toLowerCase()||drawWindow(t.blockNumber,block)!=='ready')throw Error('Ticket is not claimable. Refresh the board.');
   const next=await this.runtime.client.getBlock({blockNumber:t.blockNumber+1n});const roll=rollFor(next.hash,this.id,BigInt(id));
   if(!isWin(roll))throw Error(`Roll ${roll}: no win. No draw transaction needed.`);
   this.message(`Roll ${roll}! Confirm draw to collect the contract payout.`);
   const receipt=await this.send(this.hook,this.runtime.abis.JackpotHook,'draw',[this.id,BigInt(id)]);
   const drawn=parseEventLogs({abi:this.runtime.abis.JackpotHook,eventName:'Drawn',logs:receipt.logs,strict:true}).some(log=>{const args=log.args as unknown as {poolId:Hex;ticketId:bigint};return log.address.toLowerCase()===this.hook.toLowerCase()&&args.poolId===this.id&&args.ticketId===BigInt(id);});
   if(!drawn)throw Error('No matching Drawn event. Refresh and check the transaction.');
   this.message(`Roll ${roll} payout confirmed. The pots and balances are refreshed.`);
  }catch(e){this.message(errorMessage(e));}finally{this.set({busy:false});await this.refresh();}
 }
 consumePee(){if(!this.state.account||this.state.tank<1){this.message('Tank empty. Fill it with ICE first.');return false;}this.set({tank:this.state.tank-1});this.save();return true;}
 consumeBurst(){if(this.state.free>0){this.set({free:this.state.free-1});this.save();return true;}return this.consumePee();}
 addPoints(n:number){this.set({points:this.state.points+n});this.save();}
 setSlippage(bps:number){try{minimumOut(10000n,bps);this.set({slippage:bps,intent:undefined});}catch(e){this.message(errorMessage(e));}}
}
