import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const server=spawn(process.execPath,['tests/server.mjs'],{stdio:'ignore'});
const result={checkedAt:new Date().toISOString(),mode:'Read-only production browser; no wallet injected; no mocks',errors:[],failedRequests:[]};
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 page.on('pageerror',e=>result.errors.push(e.message));
 page.on('requestfailed',req=>result.failedRequests.push({url:req.url(),error:req.failure()?.errorText}));
 await page.goto('http://127.0.0.1:4173/ipfs/test/');
 await page.waitForFunction(()=>document.querySelector('.poolline')?.textContent?.includes('Block '),{},{timeout:45000});
 result.status=await page.locator('#review .status').innerText();
 result.balances=await page.locator('.balances').innerText();
 result.price=await page.locator('.poolline').innerText();
 result.walletWritesDisabled=await page.getByRole('button',{name:'Quote Fridge Swap'}).isDisabled();
 result.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
}catch(e){result.failure=String(e);process.exitCode=1;}
finally{await browser?.close();server.kill();await writeFile('../docs/frontend/live-browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
