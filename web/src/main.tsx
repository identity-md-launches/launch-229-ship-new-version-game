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
import { SESSION } from './chain.mjs';
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
 // While wagmi restores a saved connection the connector is plain stored data without getProvider; the effect reruns once it hydrates.
 useEffect(()=>{let active=true;void (async()=>{const provider=typeof connector?.getProvider==='function'?await connector.getProvider() as EIP1193Provider|undefined:undefined;if(active)await engine.connect(address,chainId,provider);})();return()=>{active=false;};},[address,chainId,connector,engine]);
 useEffect(()=>{void engine.verify();const timer=setInterval(()=>{void engine.refresh();},12000);return()=>clearInterval(timer);},[engine]);
 useEffect(()=>{
  window.pepe={snapshot:engine.snapshot,consumePee:()=>engine.consumePee(),consumeBurst:()=>engine.consumeBurst(),addPoints:(n:number)=>engine.addPoints(n),message:engine.message,
   swap:(native:boolean,amount:string,throne=false)=>{setEthIn(native);if(native)setEthAmount(amount);void engine.swap(native,amount,throne);},
   flip:(native:boolean)=>setEthIn(native)};
  return()=>{delete window.pepe;};
 },[engine]);
 useEffect(()=>{scene.current?.contentWindow?.pepeScene?.update(state);},[state]);
 useEffect(()=>{scene.current?.contentWindow?.pepeScene?.pause(paused);},[paused]);
 const syncScene=()=>{scene.current?.contentWindow?.pepeScene?.update(engine.state);scene.current?.contentWindow?.pepeScene?.pause(paused);};
 const control=(key:string,down:boolean)=>scene.current?.contentWindow?.pepeScene?.control(key,down);
 async function connectWallet(){setWalletBusy(true);try{if(!connectors.length)throw Error('No browser wallet found. Install an injected wallet, then reload.');await connectAsync({connector:connectors[0]});}catch(e){engine.message(/provider.*not found/i.test(errorMessage(e))?'No browser wallet found. Install an injected wallet, then reload.':errorMessage(e));}finally{setWalletBusy(false);}}
 async function switchChain(){setWalletBusy(true);try{const provider=await connector?.getProvider() as EIP1193Provider|undefined;if(!provider)throw Error('Connect a browser wallet first.');await switchNetwork(provider as Parameters<typeof switchNetwork>[0],d);}catch(e){engine.message(errorMessage(e));}finally{setWalletBusy(false);}}
 const wrong=!!address&&chainId!==d.chainId;const session=state.session;const locked=!address||wrong||!state.ready||state.busy||!session;
 const refill=!session?'':session.refill==='granted'&&session.grant?`Auto-refill on · up to ${format(session.grant.eth)} ETH and ${format(session.grant.ice,state.decimals)} ICE a day from your wallet until ${new Date(session.grant.expiry*1000).toLocaleDateString()}.`
  :session.refill==='available'?'Auto-refill is off. Allow it once to skip top-ups for 7 days.':session.refill==='unavailable'?'Auto-refill needs the MetaMask browser extension. Top up by hand below.':'Checking auto-refill support…';
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
     <div className="direction"><strong>{ethIn?'Sepolia ETH → ICE':'100 ICE → Sepolia ETH'}</strong><button className="quiet" disabled={state.busy} onClick={()=>setEthIn(!ethIn)}>⇄ Flip Direction</button></div>
     {ethIn&&<label>ETH to Swap<select name="swap-eth" value={ethAmount} disabled={state.busy} onChange={e=>setEthAmount(e.target.value)}><option>0.001</option><option>0.005</option><option>0.01</option></select></label>}
     <label>Slippage Limit<select name="slippage" value={state.slippage} disabled={state.busy} onChange={e=>engine.setSlippage(Number(e.target.value))}><option value="10">0.1%</option><option value="50">0.5%</option><option value="100">1%</option><option value="300">3%</option><option value="500">5%</option></select></label>
     <button className="primary" disabled={locked} onClick={()=>void engine.swap(ethIn,ethIn?ethAmount:'100')}>Swap Now</button>
     {!address?<p className="help">Connect your wallet to use the fridge and tank.</p>:!session&&<p className="help">Start background play in panel 03 to use the fridge and tank.</p>}
    </section>
    <section className="panel throne-panel"><span className="eyebrow">02 · The Golden Throne</span><h2>ETH In. ICE Out.</h2><p>Buy ICE through the pool. A confirmed throne swap adds 5 free climb bursts.</p><div className="throne-options">{['0.001','0.005','0.01'].map(amount=><button key={amount} disabled={locked} onClick={()=>void engine.swap(true,amount,true)}>{amount}<small>Sepolia ETH</small></button>)}</div>
     <div className="tank-title"><h3>Fill the Tank</h3><span>{state.tank} pees left</span></div>
     <label>Pees to Buy · 10 ICE Each<input id="tank-pees" aria-invalid={!!tankError} aria-describedby={tankError?'tank-error':undefined} name="pees" inputMode="numeric" type="number" min="1" max="1000" step="1" autoComplete="off" value={pees} disabled={state.busy} onChange={e=>{setPees(e.target.value);setTankError('');}}/></label>
     <button disabled={locked} onClick={()=>{const n=Number(pees);if(!Number.isInteger(n)||n<1||n>1000){setTankError('Choose 1–1000 pees.');document.getElementById('tank-pees')?.focus();}void engine.fillTank(n);}}>Fill Tank</button>{tankError&&<p id="tank-error" role="alert">{tankError}</p>}<p className="help">Local tank · {state.free} free bursts · {new Intl.NumberFormat().format(state.points)} points. Climb prizes are points.</p>
    </section>
    <section id="review" tabIndex={-1} className="panel review-panel" aria-label="Background play"><span className="eyebrow">03 · Session</span><h2>Background Play</h2>
     <p className="status" role="status" aria-live="polite">{state.message}{state.tx&&<a href={`${d.network.explorer}/tx/${state.tx}`} target="_blank" rel="noreferrer">View Transaction ↗</a>}</p>
     {!session?<><p>Sign once per visit to open a game wallet in this tab. Swaps, tank fills and prize claims then run without wallet pop-ups.</p>
      <button className="primary" disabled={!address||wrong||!state.ready||state.busy} onClick={()=>void engine.startSession()}>Start Background Play</button>
      <p className="help">The game wallet key is never stored. Signing the same message next visit restores it.</p></>
     :<><p className="session-line">Game wallet <a href={`${d.network.explorer}/address/${session.address}`} target="_blank" rel="noreferrer">{session.address.slice(0,6)}…{session.address.slice(-4)} ↗</a> · {format(session.eth)} ETH · {format(session.ice,state.decimals)} ICE</p>
      <p className="session-line">{refill}</p>
      {session.refill==='available'&&<div className="session-group"><button disabled={locked} onClick={()=>void engine.allowRefill()}>Allow Auto-Refill</button></div>}
      <div className="session-group"><span>Top Up</span>{SESSION.topUps.map(a=><button key={a} disabled={locked} onClick={()=>void engine.topUp(a)}>{a} ETH</button>)}</div>
      <div className="session-group"><span>Move ICE</span>{SESSION.iceMoves.map(a=><button key={a} disabled={locked} onClick={()=>void engine.moveIce(a)}>{new Intl.NumberFormat().format(Number(a))} ICE</button>)}</div>
      <div className="session-group"><button className="quiet" disabled={locked} onClick={()=>void engine.withdraw()}>Withdraw to Wallet</button><button className="quiet" disabled={state.busy} onClick={()=>engine.endSession()}>End Session</button></div></>}
     <p className="help">Winning tickets are claimed automatically. Tickets and payouts always go to your wallet.</p>
    </section>
   </div>
   <section className="panel tickets"><div><h2>Your Ticket Board</h2><p>Recent tickets from the chain · up to 20 in the last 256 blocks.</p></div>{!state.tickets.length?<p>{address?'No recent tickets yet. A swap of at least 100 ICE or 0.001 ETH earns one.':'Connect your wallet to see tickets.'}</p>:<ul>{state.tickets.map(t=><li key={t.id}><b>Ticket #{t.id}</b><span>{t.roll?`Roll ${t.roll} · `:''}{t.status}</span>{t.win&&<button disabled={locked} onClick={()=>void engine.draw(t.id)}>Claim Winning Ticket #{t.id}</button>}</li>)}</ul>}</section>
   <details className="panel rules" id="rules" open={rules} onToggle={e=>setRules(e.currentTarget.open)}><summary>Rules of the Arcade</summary><div>
    <p>This is <b>Sepolia test value only</b>. ICE is a fixed supply test token. There is no mainnet token connection and no $IMD in this release.</p>
    <p>Every swap adds 1% of its specified input, rounded down, to that pool’s ETH or ICE pot. A fee of at least 0.00001 ETH or 1 ICE earns a ticket for the connected player. Pool trading fees and gas also apply.</p>
    <p>For a ticket in block B, the roll uses the hash of block B+1. Draws can execute in B+2 through B+256. The displayed roll is the same Keccak calculation as the contract, from 1 to 100.</p>
    <p><b>77</b> wins 90% of both pots. <b>20, 40, 60, 80 or 100</b> wins a golden flush: 20× the ticket fee, capped at 10% of its currency’s pot. Payouts use pot balances at draw execution; a failed draw can be retried here before expiry. Other rolls show a result without a draw transaction.</p>
    <p>A tank fill sends 10 ICE per pee into the ICE pot. Pees and climb bursts count down locally per wallet in this browser. Clearing storage loses the local tank. The climb awards local points, never tokens. Five free bursts follow each confirmed golden throne swap.</p>
    <p>Block proposers can influence future block hashes. A mainnet version needs Chainlink VRF. Background play: one signature per visit opens a game wallet in this tab. It signs your moves without pop-ups and can only spend what you send it or allow it to pull. Its key is never stored.</p>
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
