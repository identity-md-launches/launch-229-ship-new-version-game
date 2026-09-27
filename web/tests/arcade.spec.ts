import {test,expect,type Page} from '@playwright/test';
import {decodeAbiParameters,maxUint256,parseAbiParameters} from 'viem';
import {fixture,d,player} from './wallet-fixture';
import {MAX_UINT160,MAX_UINT48,poolTuple} from '../src/protocol';
import {walletAddChain} from '../src/chain.mjs';
type Fx=Awaited<ReturnType<typeof fixture>>;
const E=10n**18n;const lc=(a:unknown)=>String(a).toLowerCase();
const status=(page:Page)=>page.getByRole('status').first();
const button=(page:Page,name:string)=>page.getByRole('button',{name,exact:true});
const pill=(page:Page)=>page.frameLocator('iframe').locator('#walletBtn');
// The wallet pill inside the scene; its label appears once the shell has pushed the first wallet view.
async function connect(page:Page){await expect(pill(page)).toHaveAccessibleName('Connect wallet');await pill(page).click();}
async function open(page:Page){await page.goto('/ipfs/test/');await expect(page.locator('.poolline')).toContainText('Block ');await connect(page);await expect(button(page,'Start Background Play')).toBeEnabled();}
async function startSession(page:Page){await button(page,'Start Background Play').click();await expect(page.locator('.session-line').first()).toContainText('Game wallet');}
// Funded before the session starts, so start-up also sends the one-time approvals.
async function play(page:Page,fx:Fx,{eth=E/100n,ice=1000n*E}={}){fx.fund(fx.session,{eth,ice});await open(page);await startSession(page);await expect(status(page)).toContainText('Game wallet ready.');}
async function swapNow(page:Page,fx:Fx){
 const n=fx.raw.length;const clicked=Date.now();await button(page,'Swap Now').click();
 await expect.poll(()=>fx.raw.slice(n).some(r=>r.functionName==='execute')).toBe(true);
 expect(fx.raw.slice(n).find(r=>r.functionName==='execute')!.at-clicked).toBeLessThan(3000);
 await expect(status(page)).toContainText('Swap confirmed');
}
const functions=(fx:Fx)=>fx.raw.map(r=>r.functionName);
// Test-only instrumentation exposes original closure functions without shipping test hooks.
async function instrument(page:Page){await page.route('**/game.html',async route=>{const response=await route.fetch();const body=(await response.text()).replace('  // ---- loop ----','window.__sceneTest={hitIce:hitIce,takeBow:takeBow,fridgeHit:fridgeHit,startDraw:startDraw,releaseDraw:releaseDraw};\n  // ---- loop ----');await route.fulfill({response,body});});}
type Scene={__sceneTest:{hitIce:(side:number)=>void;takeBow:()=>void;fridgeHit:(d:unknown,x:number)=>void}};
const scene=(page:Page)=>page.frames().find(f=>f.url().endsWith('game.html'))!;
async function armFridge(page:Page){await scene(page).evaluate(()=>{const t=(window as unknown as Scene).__sceneTest;t.hitIce(-1);t.takeBow();});await expect(page.frameLocator('iframe').locator('#swapSign')).toHaveClass(/on/);}
const hitFridge=(page:Page,sid:number)=>scene(page).evaluate(sid=>{(window as unknown as Scene).__sceneTest.fridgeHit({sid,x:1096,y:210},1090);},sid);
const pageErrors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const errors:string[]=[];pageErrors.set(page,errors);page.on('pageerror',e=>errors.push(e.message));});
test.afterEach(({page})=>{expect(pageErrors.get(page)).toEqual([]);});
// Records the scene's music calls; its Audio element is not in the DOM.
function musicSpy(){const w=window as unknown as {music:string[]};w.music=[];const {play,pause}=HTMLMediaElement.prototype;
 HTMLMediaElement.prototype.play=function(this:HTMLMediaElement){w.music.push('play');return play.call(this).then(()=>{w.music.push('playing');});};
 HTMLMediaElement.prototype.pause=function(this:HTMLMediaElement){w.music.push('pause');return pause.call(this);};}

test('static subpath, no wallet, no overflow, local assets, keyboard and mobile screenshots',async({page})=>{
 const fx=await fixture(page,{wallet:false});const failed:string[]=[];page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await page.goto('/ipfs/test/');await expect(button(page,'Swap Now')).toBeDisabled();
 await connect(page);await expect(page.frameLocator('iframe').locator('#walletMsg')).toContainText('No browser wallet found.');
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'../docs/frontend/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'../docs/frontend/mobile.png',fullPage:true});
 await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.tagName)).not.toBe('BODY');
 expect(failed).toEqual([]);expect(fx.external).toEqual([]);
});
test('clean top: no header or status bar, hook title in the scene, status line in panel 03',async({page})=>{
 await fixture(page,{wallet:false});await page.goto('/ipfs/test/');
 await expect(page.locator('header')).toHaveCount(0);await expect(page.locator('.statusbar')).toHaveCount(0);await expect(page.getByText(/Test Value Only/)).toHaveCount(0);
 const frame=page.frameLocator('iframe');await expect(frame.locator('#chainMessage')).toHaveCount(0);await expect(frame.locator('h1.hook-title')).toHaveText('pepes armed with ai');
 expect(await page.locator('[role=status]').first().evaluate(el=>!!el.closest('#review'))).toBe(true);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('scene redesign: docked brand, wallet pill top-right, no speaker, mainnet holdings in the dropdown and chips',async({page})=>{
 const fx=await fixture(page);await page.setViewportSize({width:1440,height:1100});await page.goto('/ipfs/test/');
 const frame=page.frameLocator('iframe');const lbl=frame.locator('#walletLbl');const pop=frame.locator('#walletPop');
 await expect(frame.locator('.slide')).toHaveClass(/docked/);await expect(frame.locator('#soundBtn')).toHaveCount(0);await expect(page.locator('.wallet-controls')).toHaveCount(0);
 await expect(frame.locator('#balance')).toHaveClass(/show/);await expect(frame.locator('#imdBal')).toHaveClass(/show/);
 await expect(frame.locator('#balAmt')).toHaveText('—');await expect(frame.locator('#imdAmt')).toHaveText('—');await expect(lbl).toHaveText('connect');
 // positions in scene units (the slide is 1280 wide)
 const slide=(await frame.locator('.slide').boundingBox())!;const k=slide.width/1280;
 const at=async(sel:string)=>{const b=(await frame.locator(sel).boundingBox())!;return {left:(b.x-slide.x)/k,top:(b.y-slide.y)/k,right:(slide.x+slide.width-b.x-b.width)/k,bottom:(b.y+b.height-slide.y)/k};};
 const brand=await at('.brandmark');expect(Math.abs(brand.left-20)).toBeLessThanOrEqual(2);expect(Math.abs(brand.top-20)).toBeLessThanOrEqual(2);
 for(const chip of ['#balance','#imdBal']){const c=await at(chip);expect(c.left).toBeLessThan(400);expect(c.bottom).toBeLessThan(120);}
 const top=await at('#walletBtn');expect(Math.abs(top.top-22.5)).toBeLessThanOrEqual(3);expect(Math.abs(top.right-14)).toBeLessThanOrEqual(3);
 // connect: short address on the pill, mainnet $ICE / $IMD in the chips
 await connect(page);await expect(lbl).toHaveText(`${player.slice(0,6)}…${player.slice(-4)}`);await expect(frame.locator('#wallet')).toHaveClass(/on/);
 await expect(frame.locator('#balAmt')).toHaveText('1,234.5');await expect(frame.locator('#imdAmt')).toHaveText('42');
 await expect(frame.locator('#balance')).toHaveAttribute('aria-label','Mainnet $ICE balance 1,234.5');
 // dropdown: mainnet holdings; Escape and a click outside the scene close it
 await pill(page).click();await expect(pop).toBeVisible();await expect(pill(page)).toHaveAttribute('aria-expanded','true');
 await expect(frame.locator('#wpNet')).toHaveText('Sepolia');await expect(frame.locator('#wpEth')).toHaveText('1.5');await expect(frame.locator('#wpIce')).toHaveText('1,234.5');await expect(frame.locator('#wpImd')).toHaveText('42');
 await expect(pop).toContainText('on Ethereum mainnet');await expect(pop).toContainText('the arcade plays on Sepolia for now');
 await page.keyboard.press('Escape');await expect(pop).toBeHidden();await expect(pill(page)).toHaveAttribute('aria-expanded','false');
 await pill(page).click();await expect(pop).toBeVisible();await page.locator('.poolline').click();await expect(pop).toBeHidden();
 // disconnect from the dropdown
 await pill(page).click();await frame.locator('#wpOut').click();await expect(lbl).toHaveText('connect');await expect(frame.locator('#balAmt')).toHaveText('—');await expect(button(page,'Start Background Play')).toBeDisabled();
 // small screens: the pill stays at least 28 px tall
 await page.setViewportSize({width:390,height:844});await expect.poll(async()=>Math.round((await pill(page).boundingBox())!.height*100)/100).toBeGreaterThanOrEqual(28);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(fx.external).toEqual([]);
});
test('unknown network offers switch, adds exact vetted chain, reconnects live reads',async({page})=>{
 await fixture(page,{wrong:true});await page.goto('/');await connect(page);await expect(page.getByText('Wrong network.',{exact:false})).toBeVisible();
 await expect(page.frameLocator('iframe').locator('#walletLbl')).toHaveText('switch to Sepolia');await expect(page.frameLocator('iframe').locator('#wallet')).toHaveClass(/wrong/);
 await expect(button(page,'Start Background Play')).toBeDisabled();await pill(page).click();await expect(button(page,'Start Background Play')).toBeEnabled();expect(await page.evaluate(()=>(window as unknown as {addedChain:unknown}).addedChain)).toEqual(walletAddChain(d.network));
 await expect(page.getByLabel('Live chain state')).toContainText('100,000');await expect(page.getByText('1 ETH = 1,000,000 ICE',{exact:false})).toBeVisible();
});
test('background ICE sale: one-time approvals, router payload with player hookData, no wallet prompt',async({page})=>{
 const fx=await fixture(page);await play(page,fx);expect(fx.prompts).toBe(1);
 await swapNow(page,fx);
 expect(functions(fx)).toEqual(['approve','approve','approve','execute']);expect(fx.raw.every(r=>r.from===lc(fx.session))).toBe(true);
 const [permit2Approval,routerApproval,hookApproval,swap]=fx.raw;
 expect(permit2Approval.to).toBe(lc(d.contracts.find(c=>c.name==='PepeIce')!.address));expect(lc(permit2Approval.args[0])).toBe(d.network.uniswapV4.permit2);expect(permit2Approval.args[1]).toBe(maxUint256);
 expect(routerApproval.to).toBe(d.network.uniswapV4.permit2);expect(lc(routerApproval.args[1])).toBe(d.network.uniswapV4.universalRouter);expect(routerApproval.args[2]).toBe(MAX_UINT160);expect(routerApproval.args[3]).toBe(Number(MAX_UINT48));
 expect(lc(hookApproval.args[0])).toBe(lc(d.contracts.find(c=>c.name==='JackpotHook')!.address));
 expect(swap.to).toBe(d.network.uniswapV4.universalRouter);expect(swap.value).toBe(0n);expect(swap.args[0]).toBe('0x10');
 const [actions,params]=decodeAbiParameters(parseAbiParameters('bytes,bytes[]'),(swap.args[1] as `0x${string}`[])[0]);expect(actions).toBe('0x060c0f');const [payload]=decodeAbiParameters(parseAbiParameters(`(${poolTuple} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`),params[0]);expect(payload.zeroForOne).toBe(false);expect(payload.amountIn).toBe(100n*E);expect(payload.amountOutMinimum).toBeGreaterThan(0n);expect(decodeAbiParameters([{type:'address'}],payload.hookData)[0]).toBe(player);
 expect(fx.prompts).toBe(1);expect(fx.sent).toEqual([]);
});
test('golden throne buy is instant; winning draw by the game wallet at B+2; free bursts after receipt',async({page})=>{
 const fx=await fixture(page,{roll:77});await play(page,fx);await button(page,'0.001 Sepolia ETH').click();await expect(page.getByText('5 free bursts',{exact:false})).toBeVisible();await expect(status(page)).toContainText('Throne buy confirmed');
 expect(fx.raw.at(-1)!.functionName).toBe('execute');expect(fx.raw.at(-1)!.value).toBe(10n**15n);
 await expect(page.getByText('Waiting for block 102',{exact:false})).toBeVisible();fx.setBlock(101n);await button(page,'Refresh').click();await expect(page.getByText('Waiting for block 102',{exact:false})).toBeVisible();expect(functions(fx)).not.toContain('draw');
 fx.setBlock(102n);await button(page,'Refresh').click();await expect.poll(()=>functions(fx).at(-1)).toBe('draw');await expect(status(page)).toContainText('payout confirmed');
 expect(fx.raw.at(-1)!.from).toBe(lc(fx.session));expect(fx.prompts).toBe(1);
});
test('losing roll shows outcome without broadcasting draw',async({page})=>{
 const fx=await fixture(page,{roll:13});await play(page,fx);await button(page,'0.005 Sepolia ETH').click();await expect(status(page)).toContainText('Throne buy confirmed');fx.setBlock(102n);await button(page,'Refresh').click();await expect(page.getByText('Roll 13 · No win',{exact:false})).toBeVisible();expect(functions(fx)).not.toContain('draw');
});
test('tank fill from the game wallet credits local pees and survives reload',async({page})=>{
 const fx=await fixture(page);await play(page,fx);await page.getByLabel('Pees to Buy').fill('3');await button(page,'Fill Tank').click();await expect(page.getByText('3 pees left',{exact:true})).toBeVisible();expect(fx.tank).toBe(3n);expect(fx.balance(fx.session,'ice')).toBe(970n*E);
 expect(await page.evaluate(()=>(window.pepe as {consumePee:()=>boolean}).consumePee())).toBe(true);await expect(page.getByText('2 pees left',{exact:true})).toBeVisible();await page.reload();await connect(page);await expect(page.getByText('2 pees left',{exact:true})).toBeVisible();
 expect(functions(fx)).toEqual(['approve','approve','approve','fillTank']);expect(fx.prompts).toBe(1);
});
test('short game wallet and invalid tank range give actionable messages',async({page})=>{
 const fx=await fixture(page);await open(page);await startSession(page);await expect(status(page)).toContainText('Top up the game wallet with a little Sepolia ETH to start.');
 await button(page,'Swap Now').click();await expect(status(page)).toContainText('The game wallet needs more ICE. Use Move ICE in panel 03.');
 await button(page,'0.001 Sepolia ETH').click();await expect(status(page)).toContainText('The game wallet needs more Sepolia ETH. Use Top Up in panel 03.');
 await page.getByLabel('Pees to Buy').fill('1001');await button(page,'Fill Tank').click();await expect(status(page)).toContainText('1–1000');expect(fx.raw).toEqual([]);expect(fx.sent).toEqual([]);
});
test('wallet rejection of the session signature or a top-up changes nothing',async({page})=>{
 const fx=await fixture(page);await open(page);fx.reject();await button(page,'Start Background Play').click();await expect(status(page)).toContainText('Wallet said no');await expect(page.locator('.session-line')).toHaveCount(0);
 fx.reject(false);await startSession(page);fx.reject();await button(page,'0.01 ETH').click();await expect(status(page)).toContainText('Wallet said no');
 expect(fx.balance(fx.session,'eth')).toBe(0n);expect(fx.sent).toEqual([]);expect(fx.raw).toEqual([]);expect(fx.prompts).toBe(3);await expect(page.getByText('0 free bursts',{exact:false})).toBeVisible();
});
test('router simulation revert prevents game-wallet signing',async({page})=>{
 const fx=await fixture(page);await play(page,fx);const before=fx.raw.length;fx.revert();await button(page,'0.001 Sepolia ETH').click();await expect(status(page)).toContainText('SlippageTooHigh');expect(fx.raw.length).toBe(before);
});
test('missing deployed code keeps value controls locked',async({page})=>{
 await fixture(page,{missingCode:true});await page.goto('/');await expect(status(page)).toContainText('code is missing');await connect(page);await expect(button(page,'Start Background Play')).toBeDisabled();await expect(button(page,'Swap Now')).toBeDisabled();
});
test('scene runs like the prototype; pause, rules and music (M key) are keyboard accessible',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(musicSpy);await fixture(page);await page.goto('/');const frame=page.frameLocator('iframe');await expect(frame.locator('html')).not.toHaveClass('paused');await page.getByRole('button',{name:'Pause Animation'}).click();await expect(frame.locator('html')).toHaveClass('paused');await expect(page.getByRole('button',{name:'Resume Animation'})).toBeVisible();const music=()=>scene(page).evaluate(()=>(window as unknown as {music:string[]}).music.at(-1));
 await frame.locator('#hero').focus();await page.keyboard.press('Shift');await expect.poll(music).toBe('playing');
 await page.keyboard.press('m');await expect.poll(music).toBe('pause');await page.keyboard.press('m');await expect.poll(music).toBe('playing');await page.getByText('Rules of the Arcade',{exact:true}).click();await expect(page.getByText('Block proposers can influence',{exact:false})).toBeVisible();
});
test('fridge collision swaps in the background',async({page})=>{
 const fx=await fixture(page);await instrument(page);await play(page,fx);await armFridge(page);
 await expect(page.getByText('100 points. Climb prizes are points.',{exact:false})).toBeVisible();await expect(page.getByLabel('Live chain state')).toContainText('100,000');
 await hitFridge(page,1);await expect.poll(()=>functions(fx).at(-1)).toBe('execute');await expect(status(page)).toContainText('Swap confirmed');expect(fx.prompts).toBe(1);
});
test('a receipt without TankFilled cannot create local pees',async({page})=>{
 const fx=await fixture(page);await play(page,fx);fx.dropLogs();await button(page,'Fill Tank').click();await expect(status(page)).toContainText('No matching TankFilled');await expect(page.getByText('0 pees left',{exact:true})).toBeVisible();
});
test('session start: one signature, key never stored, same game wallet after reload',async({page})=>{
 const fx=await fixture(page);await open(page);await startSession(page);
 const short=`${fx.session.slice(0,6)}…${fx.session.slice(-4)}`;await expect(page.locator('.session-line').first()).toContainText(short);expect(fx.prompts).toBe(1);
 const stored=await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].join('\n').toLowerCase());
 expect(stored).not.toContain(fx.sessionKey.slice(2).toLowerCase());expect(stored).toContain(lc(fx.session));
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('#review').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.reload();await connect(page);await expect(button(page,'Start Background Play')).toBeEnabled();await startSession(page);
 await expect(page.locator('.session-line').first()).toContainText(short);await expect(status(page)).not.toContainText('signed differently');expect(fx.prompts).toBe(2);
});
test('auto-refill: one grant, then fridge swaps pull ICE with zero prompts',async({page})=>{
 const fx=await fixture(page,{permissions:true});await open(page);await startSession(page);await expect(page.getByText('Auto-refill is off.',{exact:false})).toBeVisible();
 await button(page,'0.01 ETH').click();await expect(status(page)).toContainText('Game wallet ready.');
 await button(page,'Allow Auto-Refill').click();await expect(status(page)).toContainText('Auto-refill is on.');await expect(page.getByText('Auto-refill on · up to 0.02 ETH and 10,000 ICE a day',{exact:false})).toBeVisible();
 const prompts=fx.prompts;expect(prompts).toBe(3);
 for(let i=0;i<3;i++)await swapNow(page,fx);
 expect(functions(fx).filter(f=>f==='redeemDelegations')).toHaveLength(1);expect(functions(fx).filter(f=>f==='execute')).toHaveLength(3);
 expect(fx.balance(player,'ice')).toBe(99000n*E);expect(fx.balance(fx.session,'ice')).toBe(700n*E);expect(fx.prompts).toBe(prompts);
});
test('manual mode: top up and move ICE, then play with zero prompts',async({page})=>{
 const fx=await fixture(page);await open(page);await startSession(page);await expect(page.getByText('Auto-refill needs the MetaMask browser extension.',{exact:false})).toBeVisible();
 await button(page,'0.01 ETH').click();await expect(status(page)).toContainText('Game wallet ready.');
 await button(page,'1,000 ICE').click();await expect(status(page)).toContainText('ICE moved to the game wallet.');
 expect(fx.sent.map(s=>[s.address,s.functionName,s.value])).toEqual([[lc(fx.session),'',E/100n],[lc(d.contracts.find(c=>c.name==='PepeIce')!.address),'transfer',0n]]);
 const prompts=fx.prompts;expect(prompts).toBe(3);const before=fx.raw.length;
 await swapNow(page,fx);
 await page.getByLabel('Pees to Buy').fill('2');await button(page,'Fill Tank').click();await expect(page.getByText('2 pees left',{exact:true})).toBeVisible();
 await button(page,'0.001 Sepolia ETH').click();await expect(page.getByText('5 free bursts',{exact:false})).toBeVisible();
 expect(fx.raw.slice(before).map(r=>r.functionName)).toEqual(['execute','fillTank','execute']);expect(fx.prompts).toBe(prompts);
});
test('a non-ECDSA signature is refused',async({page})=>{
 const fx=await fixture(page,{badSignature:true});await open(page);await button(page,'Start Background Play').click();await expect(status(page)).toContainText('Session play needs a wallet that signs with a regular account key.');await expect(page.locator('.session-line')).toHaveCount(0);expect(fx.raw).toEqual([]);
});
test('one move at a time: a second hit during a pending swap is skipped with a message',async({page})=>{
 const fx=await fixture(page);await instrument(page);await play(page,fx);await armFridge(page);
 fx.hold();await hitFridge(page,1);await expect.poll(()=>functions(fx).at(-1)).toBe('execute');await expect(status(page)).toContainText('Swap sent');
 await hitFridge(page,2);await expect(status(page)).toContainText('Still confirming the last move. Try again in a moment.');expect(functions(fx).filter(f=>f==='execute')).toHaveLength(1);
 fx.release();await expect(status(page)).toContainText('Swap confirmed',{timeout:15000});expect(functions(fx).filter(f=>f==='execute')).toHaveLength(1);
});
test('withdraw to wallet returns ICE and ETH to the player',async({page})=>{
 const fx=await fixture(page);await play(page,fx,{eth:E/100n,ice:500n*E});const eth=fx.balance(player,'eth'),ice=fx.balance(player,'ice');
 await button(page,'Withdraw to Wallet').click();await expect(status(page)).toContainText('Withdrawn to your wallet.');
 // The game wallet keeps twice the cost of the final plain transfer (21000 gas at 2 wei).
 expect(fx.balance(fx.session,'ice')).toBe(0n);expect(fx.balance(fx.session,'eth')).toBe(84000n);expect(fx.balance(player,'ice')).toBe(ice+500n*E);expect(fx.balance(player,'eth')).toBe(eth+E/100n-84000n);
 await button(page,'Withdraw to Wallet').click();await expect(status(page)).toContainText('Nothing to withdraw.');expect(fx.prompts).toBe(1);
});
test('a second tab cannot start background play',async({page,context})=>{
 await fixture(page);await open(page);await startSession(page);
 const other=await context.newPage();const errors:string[]=[];other.on('pageerror',e=>errors.push(e.message));await fixture(other);await open(other);
 await button(other,'Start Background Play').click();await expect(status(other)).toContainText('Background play is open in another tab. End it there first.');await expect(other.locator('.session-line')).toHaveCount(0);
 await button(page,'End Session').click();await expect(status(page)).toContainText('Background play ended.');
 await startSession(other);expect(errors).toEqual([]);
});
