import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider, createConfig, http, useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, ConnectButton, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { loadDeployment, type Runtime } from './config';
import { GameEngine, format, type Snapshot } from './engine';
import { errorMessage, switchNetwork } from './protocol';
import { type EIP1193Provider } from 'viem';
import './style.css';
declare global {interface Window {pepe?:unknown;pepeScene?:{update:(s:Snapshot)=>void;control:(key:string,down:boolean)=>void;pause:(value:boolean)=>void;};}}
function Arcade({runtime,engine}:{runtime:Runtime;engine:GameEngine}) {
 const state=useSyncExternalStore(engine.subscribe,engine.snapshot);
 const {address,chainId,connector}=useAccount();const {connectAsync,connectors}=useConnect();const {disconnect}=useDisconnect();
 const scene=useRef<HTMLIFrameElement>(null);const [pees,setPees]=useState('10');const [ethIn,setEthIn]=useState(false);const [ethAmount,setEthAmount]=useState('0.001');
 const [paused,setPaused]=useState(false);
 const [tankError,setTankError]=useState('');
 const [walletBusy,setWalletBusy]=useState(false);const [rules,setRules]=useState(location.hash==='#rules');
 const d=runtime.d;
 useEffect(()=>{let active=true;void (async()=>{const provider=await connector?.getProvider() as EIP1193Provider|undefined;if(active)await engine.connect(address,chainId,provider);})();return()=>{active=false;};},[address,chainId,connector,engine]);
 useEffect(()=>{void engine.verify();const timer=setInterval(()=>{void engine.refresh();},12000);return()=>clearInterval(timer);},[engine]);
 useEffect(()=>{
  window.pepe={snapshot:engine.snapshot,consumePee:()=>engine.consumePee(),consumeBurst:()=>engine.consumeBurst(),addPoints:(n:number)=>engine.addPoints(n),message:engine.message,
   swap:(native:boolean,amount:string,throne=false)=>{setEthIn(native);if(native)setEthAmount(amount);void engine.prepareSwap(native,amount,throne).then(()=>{if(engine.state.intent){const review=document.getElementById('review');review?.scrollIntoView({block:'nearest'});review?.focus({preventScroll:true});}});},
   flip:(native:boolean)=>{setEthIn(native);engine.set({intent:undefined});}};
  return()=>{delete window.pepe;};
 },[engine]);
 useEffect(()=>{scene.current?.contentWindow?.pepeScene?.update(state);},[state]);
 useEffect(()=>{scene.current?.contentWindow?.pepeScene?.pause(paused);},[paused]);
 const syncScene=()=>{scene.current?.contentWindow?.pepeScene?.update(engine.state);scene.current?.contentWindow?.pepeScene?.pause(paused);};
 const control=(key:string,down:boolean)=>scene.current?.contentWindow?.pepeScene?.control(key,down);
 async function connectWallet(){setWalletBusy(true);try{if(!connectors.length)throw Error('No browser wallet found. Install an injected wallet, then reload.');await connectAsync({connector:connectors[0]});}catch(e){engine.message(/provider.*not found/i.test(errorMessage(e))?'No browser wallet found. Install an injected wallet, then reload.':errorMessage(e));}finally{setWalletBusy(false);}}
 async function switchChain(){setWalletBusy(true);try{const provider=await connector?.getProvider() as EIP1193Provider|undefined;if(!provider)throw Error('Connect a browser wallet first.');await switchNetwork(provider as Parameters<typeof switchNetwork>[0],d);}catch(e){engine.message(errorMessage(e));}finally{setWalletBusy(false);}}
 const wrong=!!address&&chainId!==d.chainId;const locked=!address||wrong||!state.ready||state.busy;
 const intent=state.intent;
 const label=intent?.kind==='tank'?(intent.step==='approve'?'Approve ICE for Tank':'Confirm Tank Fill'):intent?.step==='token'?'Approve ICE for Permit2':intent?.step==='permit'?'Approve Router in Permit2':'Confirm Swap';
 return <>
  <a className="skip" href="#moves">Skip to Wallet Controls</a>
  <main id="arcade">
   <h1 className="sr-only">Pepe’s Sepolia Arcade</h1>
   <section className="game-region" aria-label="Original Pepe arcade"><div className="scene"><iframe ref={scene} title="Pepe platform game: arrows to move, space to strike or pee, E for throne, T to flip" src="./game.html" onLoad={syncScene}/><div className="wallet-controls">{address?<><ConnectButton.Custom>{({openAccountModal})=><button onClick={openAccountModal} aria-label="Open wallet account">{address.slice(0,6)}…{address.slice(-4)}</button>}</ConnectButton.Custom><button className="quiet" onClick={()=>disconnect()}>Disconnect</button></>:<button disabled={walletBusy} onClick={()=>void connectWallet()}>{walletBusy?'Connecting…':'Connect Wallet'}</button>}</div></div>
    <div className="game-tools"><span>Arrows move · Hold Space to aim · E throne · T flip · C cash out · M music</span><button className="quiet" onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused?'Resume Animation':'Pause Animation'}</button></div>
    <div className="touch-controls" aria-label="Game controls">{[['ArrowLeft','← Left'],['ArrowUp','↑ Jump'],['ArrowRight','Right →'],[' ','Strike / Pee'],['e','Throne'],['t','Flip'],['c','Cash Out']].map(([key,text])=><button key={key} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);control(key,true);}} onPointerUp={()=>control(key,false)} onPointerCancel={()=>control(key,false)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)control(key,true);}}} onKeyUp={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();control(key,false);}}}>{text}</button>)}</div>
   </section>
   {wrong&&<div className="network-alert"><span>Wrong network. Your wallet must be on {d.network.name}.</span><button disabled={walletBusy||state.busy} onClick={()=>void switchChain()}>Switch to {d.network.name}</button></div>}
   <section className="balances" aria-label="Live chain state">
    {[['Your ICE',format(state.ice,state.decimals)],['Your Sepolia ETH',format(state.eth)],['Jackpot · ICE',format(state.potIce,state.decimals)],['Jackpot · ETH',format(state.potEth)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}
   </section>
   <div className="poolline"><span>{state.price?`1 ETH = ${new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(state.price)} ICE`:'Pool price unavailable'} · {state.block?`Block ${state.block}`:'Reading chain…'}{state.updated&&` · Read ${new Date(state.updated).toLocaleTimeString()}`}</span><button className="quiet" disabled={state.busy} onClick={()=>void engine.verify()}>Refresh</button></div>
   <div className="panels" id="moves">
    <section className="panel swap-panel"><span className="eyebrow">01 · The Jackpot Fridge</span><h2>Pee, Swap, Roll.</h2><p>Each swap feeds 1% of its input into the pot. Hit the fridge in the game, or use these controls.</p>
     <div className="direction"><strong>{ethIn?'Sepolia ETH → ICE':'100 ICE → Sepolia ETH'}</strong><button className="quiet" disabled={state.busy} onClick={()=>{setEthIn(!ethIn);engine.set({intent:undefined});}}>⇄ Flip Direction</button></div>
     {ethIn&&<label>ETH to Swap<select name="swap-eth" value={ethAmount} disabled={state.busy} onChange={e=>{setEthAmount(e.target.value);engine.set({intent:undefined});}}><option>0.001</option><option>0.005</option><option>0.01</option></select></label>}
     <label>Slippage Limit<select name="slippage" value={state.slippage} disabled={state.busy} onChange={e=>engine.setSlippage(Number(e.target.value))}><option value="10">0.1%</option><option value="50">0.5%</option><option value="100">1%</option><option value="300">3%</option><option value="500">5%</option></select></label>
     <button className="primary" disabled={locked} onClick={()=>void engine.prepareSwap(ethIn,ethIn?ethAmount:'100')}>Quote Fridge Swap</button>
     {!address&&<p className="help">Connect your wallet to use the fridge and tank.</p>}
    </section>
    <section className="panel throne-panel"><span className="eyebrow">02 · The Golden Throne</span><h2>ETH In. ICE Out.</h2><p>Buy ICE through the pool. A confirmed throne swap adds 5 free climb bursts.</p><div className="throne-options">{['0.001','0.005','0.01'].map(amount=><button key={amount} disabled={locked} onClick={()=>void engine.prepareSwap(true,amount,true)}>{amount}<small>Sepolia ETH</small></button>)}</div>
     <div className="tank-title"><h3>Fill the Tank</h3><span>{state.tank} pees left</span></div>
     <label>Pees to Buy · 10 ICE Each<input id="tank-pees" aria-invalid={!!tankError} aria-describedby={tankError?'tank-error':undefined} name="pees" inputMode="numeric" type="number" min="1" max="1000" step="1" autoComplete="off" value={pees} disabled={state.busy} onChange={e=>{setPees(e.target.value);setTankError('');}}/></label>
     <button disabled={locked} onClick={()=>{const n=Number(pees);if(!Number.isInteger(n)||n<1||n>1000){setTankError('Choose 1–1000 pees.');document.getElementById('tank-pees')?.focus();}void engine.prepareTank(n);}}>Review Tank Fill</button>{tankError&&<p id="tank-error" role="alert">{tankError}</p>}<p className="help">Local tank · {state.free} free bursts · {new Intl.NumberFormat().format(state.points)} points. Climb prizes are points.</p>
    </section>
    <section id="review" tabIndex={-1} className="panel review-panel" aria-label="Transaction review"><span className="eyebrow">03 · Wallet Move</span><h2>Review & Confirm</h2>
     <p className="status" role="status" aria-live="polite">{state.message}{state.tx&&<a href={`${d.network.explorer}/tx/${state.tx}`} target="_blank" rel="noreferrer">View Transaction ↗</a>}</p>
     {intent?<>
      <p className="quote">{intent.kind==='tank'?`${intent.pees} pees for ${format(intent.amount,state.decimals)} ICE`:`${format(intent.amount,intent.ethIn?18:state.decimals)} ${intent.ethIn?'ETH':'ICE'} → ≈ ${format(intent.out,intent.ethIn?state.decimals:18)} ${intent.ethIn?'ICE':'ETH'}`}</p>
      {intent.kind==='swap'&&<><p>Minimum received: <b>{format(intent.minimum,intent.ethIn?state.decimals:18)} {intent.ethIn?'ICE':'ETH'}</b>. Quote valid for 30 seconds. Swap deadline: 5 minutes.</p><ol><li>{intent.ethIn?'Native ETH: no approval.':'Approve only this ICE amount for Permit2.'}</li>{!intent.ethIn&&<li>Approve only this amount for the router, for 30 minutes.</li>}<li>Simulate, then confirm the swap.</li></ol></>}
      {intent.kind==='tank'&&<p>Approve {format(intent.amount,state.decimals)} ICE for JackpotHook, then confirm fillTank. Pees are credited after confirmation.</p>}
      <button className="primary" disabled={locked} onClick={()=>void engine.advance()}>{state.busy?'Waiting for Wallet…':label}</button><button className="quiet" disabled={state.busy} onClick={()=>engine.set({intent:undefined})}>Cancel Review</button>
     </>:<p>Choose a quote or tank fill. Approvals and swaps each have their own wallet confirmation. Keep some Sepolia ETH for gas.</p>}
     <p className="help">Winning tickets prompt a separate draw confirmation. Losing tickets cost no draw gas.</p>
    </section>
   </div>
   <section className="panel tickets"><div><h2>Your Ticket Board</h2><p>Recent tickets from the chain · up to 20 in the last 256 blocks.</p></div>{!state.tickets.length?<p>{address?'No recent tickets yet. A swap of at least 100 ICE or 0.001 ETH earns one.':'Connect your wallet to see tickets.'}</p>:<ul>{state.tickets.map(t=><li key={t.id}><b>Ticket #{t.id}</b><span>{t.roll?`Roll ${t.roll} · `:''}{t.status}</span>{t.win&&<button disabled={locked} onClick={()=>void engine.draw(t.id)}>Claim Winning Ticket #{t.id}</button>}</li>)}</ul>}</section>
   <details className="panel rules" id="rules" open={rules} onToggle={e=>setRules(e.currentTarget.open)}><summary>Rules of the Arcade</summary><div>
    <p>This is <b>Sepolia test value only</b>. ICE is a fixed supply test token. There is no mainnet token connection and no $IMD in this release.</p>
    <p>Every swap adds 1% of its specified input, rounded down, to that pool’s ETH or ICE pot. A fee of at least 0.00001 ETH or 1 ICE earns a ticket for the connected player. Pool trading fees and gas also apply.</p>
    <p>For a ticket in block B, the roll uses the hash of block B+1. Draws can execute in B+2 through B+256. The displayed roll is the same Keccak calculation as the contract, from 1 to 100.</p>
    <p><b>77</b> wins 90% of both pots. <b>20, 40, 60, 80 or 100</b> wins a golden flush: 20× the ticket fee, capped at 10% of its currency’s pot. Payouts use pot balances at draw execution; a rejected draw can be retried here before expiry. Other rolls show a result without a draw transaction.</p>
    <p>A tank fill sends 10 ICE per pee into the ICE pot. Pees and climb bursts count down locally per wallet in this browser. Clearing storage loses the local tank. The climb awards local points, never tokens. Five free bursts follow each confirmed golden throne swap.</p>
    <p>Block proposers can influence future block hashes. A mainnet version needs Chainlink VRF. The auto-pee pad prepares each swap for review; each transaction still requires your wallet confirmation.</p>
    <p>Use arrows to move and jump, Space to strike or aim and release, E for the throne, T to flip the fridge, C to cash out climb points, and M to toggle music. Touch controls are below the scene. Pause animation or skip straight to wallet controls at any time.</p>
   </div></details>
  </main>
  <footer><div><b>Deployed on {d.network.name}</b>{d.contracts.map(c=><a key={c.name} href={`${d.network.explorer}/address/${c.address}`} target="_blank" rel="noreferrer">{c.name} <span>{c.address}</span> ↗</a>)}</div><div><b>Test ETH & Release</b>{d.network.faucets.map((url,i)=><a href={url} key={url} target="_blank" rel="noreferrer">Sepolia Faucet {i+1} ↗</a>)}<a href="./imd-deployment.json">Deployment Manifest ↗</a><span>MIT · pepes armed with ai</span></div></footer>
 </>;
}
async function start(){
 const root=createRoot(document.getElementById('root')!);
 root.render(<p className="startup" role="status">Opening the arcade…</p>);
 try{
  const runtime=await loadDeployment();const engine=new GameEngine(runtime);
  const config=createConfig({chains:[runtime.chain],connectors:[injected()],transports:{[runtime.chain.id]:http(runtime.d.network.rpcUrls[0])},multiInjectedProviderDiscovery:true});
  root.render(<WagmiProvider config={config}><QueryClientProvider client={new QueryClient()}><RainbowKitProvider theme={darkTheme({accentColor:'#e3be60',accentColorForeground:'#03061a',borderRadius:'medium'})}><Arcade runtime={runtime} engine={engine}/></RainbowKitProvider></QueryClientProvider></WagmiProvider>);
 }catch(e){root.render(<main className="startup"><h1>Arcade Unavailable</h1><p role="alert">{errorMessage(e)}</p><button onClick={()=>location.reload()}>Retry Loading</button></main>);}
}
void start();
