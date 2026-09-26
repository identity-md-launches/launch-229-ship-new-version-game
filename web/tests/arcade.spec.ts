import {test,expect} from '@playwright/test';
import {decodeAbiParameters,parseAbiParameters} from 'viem';
import {fixture,d,player} from './wallet-fixture';
import {poolTuple} from '../src/protocol';
import {walletAddChain} from '../src/chain.mjs';
async function open(page:import('@playwright/test').Page){await page.goto('/ipfs/test/');await expect(page.getByRole('button',{name:'Connect Wallet',exact:true})).toBeVisible();await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();await expect(page.getByRole('button',{name:'Quote Fridge Swap'})).toBeEnabled();}
const quote=(page:import('@playwright/test').Page)=>page.getByRole('button',{name:'Quote Fridge Swap'}).click();
test('static subpath, no wallet, no overflow, local assets, keyboard and mobile screenshots',async({page})=>{
 await fixture(page,{wallet:false});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const failed:string[]=[];page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await page.goto('/ipfs/test/');await expect(page.getByRole('button',{name:'Quote Fridge Swap'})).toBeDisabled();
 await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('No browser wallet');
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'../docs/frontend/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'../docs/frontend/mobile.png',fullPage:true});
 await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.tagName)).not.toBe('BODY');
 expect(errors).toEqual([]);expect(failed).toEqual([]);
});
test('unknown network offers switch, adds exact vetted chain, reconnects live reads',async({page})=>{
 await fixture(page,{wrong:true});await page.goto('/');await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();await expect(page.getByText('Wrong network.',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:'Quote Fridge Swap'})).toBeDisabled();await page.getByRole('button',{name:'Switch to Sepolia'}).click();await expect(page.getByRole('button',{name:'Quote Fridge Swap'})).toBeEnabled();expect(await page.evaluate(()=>(window as unknown as {addedChain:unknown}).addedChain)).toEqual(walletAddChain(d.network));
 await expect(page.getByLabel('Live chain state')).toContainText('100,000');await expect(page.getByText('1 ETH = 1,000,000 ICE',{exact:false})).toBeVisible();
});
test('ICE sale uses separate exact approvals then router payload with hookData',async({page})=>{
 const mock=await fixture(page);await open(page);await quote(page);await page.getByRole('button',{name:'Approve ICE for Permit2',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('ICE approval confirmed');
 await quote(page);await page.getByRole('button',{name:'Approve Router in Permit2'}).click();await expect(page.getByRole('status').first()).toContainText('Router allowance confirmed');
 await quote(page);await page.getByRole('button',{name:'Confirm Swap',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('Swap confirmed');
 expect(mock.sent.map(s=>s.functionName)).toEqual(['approve','approve','execute']);expect(String(mock.sent[0].args[0]).toLowerCase()).toBe(d.network.uniswapV4.permit2);expect(mock.sent[0].args[1]).toBe(100n*10n**18n);expect(String(mock.sent[1].args[1]).toLowerCase()).toBe(d.network.uniswapV4.universalRouter);
 const swap=mock.sent[2];expect(swap.address).toBe(d.network.uniswapV4.universalRouter);expect(swap.value).toBe(0n);expect(swap.args[0]).toBe('0x10');
 const [actions,params]=decodeAbiParameters(parseAbiParameters('bytes,bytes[]'),(swap.args[1] as `0x${string}`[])[0]);expect(actions).toBe('0x060c0f');const [payload]=decodeAbiParameters(parseAbiParameters(`(${poolTuple} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`),params[0]);expect(payload.zeroForOne).toBe(false);expect(payload.amountOutMinimum).toBeGreaterThan(0n);expect(decodeAbiParameters([{type:'address'}],payload.hookData)[0].toLowerCase()).toBe(player);
});
test('golden throne native swap has no approvals; winning draw only at B+2; free bursts after receipt',async({page})=>{
 const mock=await fixture(page,{roll:77});await open(page);await page.getByRole('button',{name:'0.001 Sepolia ETH',exact:true}).click();await page.getByRole('button',{name:'Confirm Swap',exact:true}).click();await expect(page.getByText('5 free bursts',{exact:false})).toBeVisible();expect(mock.sent.map(s=>s.functionName)).toEqual(['execute']);expect(mock.sent[0].value).toBe(10n**15n);
 await expect(page.getByText('Waiting for block 102',{exact:false})).toBeVisible();mock.setBlock(101n);await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByText('Waiting for block 102',{exact:false})).toBeVisible();expect(mock.sent.length).toBe(1);
 mock.setBlock(102n);await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect.poll(()=>mock.sent.map(s=>s.functionName)).toEqual(['execute','draw']);await expect(page.getByRole('status').first()).toContainText('payout confirmed');
});
test('losing roll shows outcome without broadcasting draw',async({page})=>{
 const mock=await fixture(page,{roll:13});await open(page);await page.getByRole('button',{name:'0.005 Sepolia ETH',exact:true}).click();await page.getByRole('button',{name:'Confirm Swap',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('Swap confirmed');mock.setBlock(102n);await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByText('Roll 13 · No win',{exact:false})).toBeVisible();expect(mock.sent.map(s=>s.functionName)).toEqual(['execute']);
});
test('tank approval and fill confirmed; scene pees decrement local charges and reload preserves them',async({page})=>{
 const mock=await fixture(page);await open(page);await page.getByLabel('Pees to Buy').fill('3');await page.getByRole('button',{name:'Review Tank Fill'}).click();await page.getByRole('button',{name:'Approve ICE for Tank',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm Tank Fill'})).toBeEnabled();await page.getByRole('button',{name:'Confirm Tank Fill'}).click();await expect(page.getByText('3 pees left',{exact:true})).toBeVisible();expect(mock.tank).toBe(3n);
 expect(await page.evaluate(()=>(window.pepe as {consumePee:()=>boolean}).consumePee())).toBe(true);await expect(page.getByText('2 pees left',{exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();await expect(page.getByText('2 pees left',{exact:true})).toBeVisible();expect(mock.sent.map(s=>s.functionName)).toEqual(['approve','fillTank']);
});
test('insufficient balances and invalid tank range give actionable messages',async({page})=>{
 const mock=await fixture(page,{poor:true});await open(page);await quote(page);await expect(page.getByRole('status').first()).toContainText('Not enough ICE');await page.getByRole('button',{name:'0.001 Sepolia ETH',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('Not enough Sepolia ETH');await page.getByLabel('Pees to Buy').fill('1001');await page.getByRole('button',{name:'Review Tank Fill'}).click();await expect(page.getByRole('status').first()).toContainText('1–1000');expect(mock.sent).toEqual([]);
});
test('wallet rejection leaves balances and free bursts uncredited',async({page})=>{
 const mock=await fixture(page);await open(page);mock.reject();await page.getByRole('button',{name:'0.001 Sepolia ETH',exact:true}).click();await page.getByRole('button',{name:'Confirm Swap',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('Wallet said no');await expect(page.getByText('0 free bursts',{exact:false})).toBeVisible();expect(mock.sent).toEqual([]);
});
test('router simulation revert prevents wallet signing',async({page})=>{
 const mock=await fixture(page);await open(page);await page.getByRole('button',{name:'0.001 Sepolia ETH',exact:true}).click();mock.revert();await page.getByRole('button',{name:'Confirm Swap',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('SlippageTooHigh');expect(mock.sent).toEqual([]);
});
test('missing deployed code keeps value controls locked',async({page})=>{
 await fixture(page,{missingCode:true});await page.goto('/');await expect(page.getByRole('status').first()).toContainText('code is missing');await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();await expect(page.getByRole('button',{name:'Quote Fridge Swap'})).toBeDisabled();
});
test('scene runs like the prototype; pause, rules and music are keyboard accessible',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await fixture(page);await page.goto('/');const frame=page.frameLocator('iframe');await expect(frame.locator('html')).not.toHaveClass('paused');await page.getByRole('button',{name:'Pause Animation'}).click();await expect(frame.locator('html')).toHaveClass('paused');await expect(page.getByRole('button',{name:'Resume Animation'})).toBeVisible();await frame.getByRole('button',{name:'Mute music',exact:true}).focus();await page.keyboard.press('Enter');await expect(frame.getByRole('button',{name:'Play music',exact:true})).toBeVisible();await page.getByRole('link',{name:'Rules',exact:true}).click();await expect(page.getByText('Block proposers can influence',{exact:false})).toBeVisible();
});
test('prototype gameplay keeps points local and fridge collision prepares a real swap',async({page})=>{
 await fixture(page);
 // Test-only instrumentation exposes original closure functions without shipping test hooks.
 await page.route('**/game.html',async route=>{const response=await route.fetch();const body=(await response.text()).replace('  // ---- loop ----', 'window.__sceneTest={hitIce:hitIce,takeBow:takeBow,fridgeHit:fridgeHit,startDraw:startDraw,releaseDraw:releaseDraw};\n  // ---- loop ----');await route.fulfill({response,body});});
 await open(page);const frame=page.frames().find(f=>f.url().endsWith('game.html'))!;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await frame.evaluate(()=>{const t=(window as unknown as {__sceneTest:{hitIce:(side:number)=>void;takeBow:()=>void}}).__sceneTest;t.hitIce(-1);t.takeBow();});
 await expect(page.getByText('100 points. Climb prizes are points.',{exact:false})).toBeVisible();await expect(page.getByLabel('Live chain state')).toContainText('100,000');
 await expect(page.frameLocator('iframe').locator('#swapSign')).toHaveClass(/on/);
 await frame.evaluate(()=>{(window as unknown as {__sceneTest:{fridgeHit:(d:unknown,x:number)=>void}}).__sceneTest.fridgeHit({sid:1,x:1096,y:210},1090);});
 await expect(page.getByRole('button',{name:'Approve ICE for Permit2',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('expired quote prevents signing and requires a fresh review',async({page})=>{
 const mock=await fixture(page);await open(page);await page.getByRole('button',{name:'0.001 Sepolia ETH',exact:true}).click();
 await page.evaluate(()=>{const before=Date.now.bind(Date);Date.now=()=>before()+31000;});
 await page.getByRole('button',{name:'Confirm Swap',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('Quote expired');expect(mock.sent).toEqual([]);
});
test('a successful replacement receipt without TankFilled cannot create local pees',async({page})=>{
 const mock=await fixture(page);await open(page);await page.getByRole('button',{name:'Review Tank Fill'}).click();await page.getByRole('button',{name:'Approve ICE for Tank',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm Tank Fill'})).toBeEnabled();mock.dropLogs();await page.getByRole('button',{name:'Confirm Tank Fill'}).click();await expect(page.getByRole('status').first()).toContainText('No matching TankFilled');await expect(page.getByText('0 pees left',{exact:true})).toBeVisible();
});
