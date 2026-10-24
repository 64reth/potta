import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const point=n=>page.locator(`[data-node="${n}"]`);
const click=async n=>{await point(n).click({force:true});};
try{
 await page.goto('http://127.0.0.1:5173');await fs.mkdir('artifacts',{recursive:true});
 assert.match(await page.locator('#status-title').innerText(),/Azure/);
 await click('A');assert.match(await point('A').getAttribute('aria-label'),/Azure piece/);assert.match(await page.locator('#status-title').innerText(),/Ochre/);
 await click('A');assert.match(await page.locator('#status-title').innerText(),/Ochre/);
 for(const n of ['B','D','E','I','G'])await click(n);
 assert.match(await page.locator('#phase').innerText(),/MOVE/);
 await click('A');assert.equal(await page.locator('.node.legal').count(),0);await click('C');assert.match(await point('C').getAttribute('aria-label'),/empty/);
 await click('B');assert.equal(await point('A').getAttribute('aria-pressed'),'true');
 await click('I');assert.equal(await point('F').getAttribute('aria-disabled'),'false');await click('F');assert.match(await point('I').getAttribute('aria-label'),/empty/);
 await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
 // Fresh-board route: Azure F–C completes A–B–C.
 await page.locator('#restart').click();await page.getByRole('button',{name:'Keep playing'}).click();assert.match(await point('A').getAttribute('aria-label'),/Azure/);
 await page.locator('#restart').click();await page.getByRole('button',{name:'Start new game',exact:true}).click();
 for(const n of ['A','D','B','G','F','I'])await click(n);
 await click('F');await click('C');assert.match(await page.locator('#status-title').innerText(),/Azure takes the line/);assert.equal(await page.locator('.win-line').count(),1);assert.equal(await page.locator('.victorious').count(),3);
 await click('H');assert.match(await point('H').getAttribute('aria-label'),/empty/);
 await page.screenshot({path:'artifacts/win.png',fullPage:true});await page.getByRole('button',{name:'Rematch'}).click();assert.equal(await page.locator('.piece').count(),0);assert.match(await page.locator('#status-title').innerText(),/Azure/);
 await page.getByRole('button',{name:'How to play'}).click();assert.equal(await page.locator('#rules-dialog').evaluate(e=>e.open),true);await page.keyboard.press('Escape');
 for(const width of [390,320,768]){
  await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await click('A');await click('B');await page.screenshot({path:`artifacts/mobile-${width}.png`,fullPage:true});
  await page.locator('#restart').click();await page.getByRole('button',{name:'Start new game',exact:true}).click();
 }
 // Keyboard interaction, a blocked draw and rematch through real controls.
 await point('A').focus();await page.keyboard.press('Enter');for(const n of ['C','B','E','D','G'])await click(n);assert.match(await page.locator('#status-title').innerText(),/shared finish/);await page.getByRole('button',{name:'Rematch'}).click();
 assert.deepEqual(errors,[]);console.log('Browser passed: placement, invalid moves, selection, connected movement, turns, victory, blocked draw, restart cancellation, rematch, instructions, keyboard and 320/390/768/1440 layouts.');
}finally{await browser.close();}
