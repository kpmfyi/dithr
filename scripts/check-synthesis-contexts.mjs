import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { synthesisFamilies } from '../src/seedbank/recipes.ts';
import { demos } from '../src/demos/catalog.ts';
import { launch } from './browser-support.mjs';
const out=process.env.SYNTHESIS_CONTEXT_DIR || 'artifacts/synthesis-context-04';await mkdir(out,{recursive:true});
const results=[];
for(const family of [...synthesisFamilies,'broken-lcd','intaglio']){
 const browser=await launch();
 try {
  const page=await browser.newPage({viewport:{width:1380,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.SEEDBANK_URL || 'http://127.0.0.1:5187'}/demos?study=${family}`,{waitUntil:'networkidle'});
  await page.waitForSelector(`.usage-stage[data-family="${family}"] .shader-surface[data-ready="true"]`,{timeout:45000});
  const environment=JSON.parse(await page.locator('.usage-stage canvas').getAttribute('data-environment'));
  await page.locator('.usage-stage').screenshot({path:`${out}/${family}-desktop.png`});
  const before=await page.locator('.usage-stage canvas').getAttribute('data-time');
  await page.getByRole('button',{name:'Play demo motion',exact:true}).click();
  await page.waitForFunction(t=>document.querySelector('.usage-stage canvas').dataset.time!==t,before);
  await page.getByRole('button',{name:'Pause demo motion',exact:true}).click();
  const stopped=await page.locator('.usage-stage canvas').getAttribute('data-time');await page.waitForTimeout(200);
  assert.equal(await page.locator('.usage-stage canvas').getAttribute('data-time'),stopped);
  await page.getByRole('button',{name:'Reset still'}).click();
  assert.equal(Number(await page.locator('.usage-stage canvas').getAttribute('data-time')),demos.find(d=>d.family===family).recipe.time);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download tuned recipe'}).click();
  await (await download).saveAs(`${out}/${family}.json`);
  assert.deepEqual(JSON.parse(await readFile(`${out}/${family}.json`,'utf8')),demos.find(d=>d.family===family).recipe);
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
   assert.equal(await page.locator('.usage-stage canvas').evaluate(c=>getComputedStyle(c).imageRendering),'pixelated');
   if(width===390)await page.locator('.usage-stage').screenshot({path:`${out}/${family}-mobile.png`});
  }
  await page.getByRole('link',{name:'Edit this recipe'}).click();await page.waitForFunction(()=>!document.querySelector('.play-button')?.disabled);
  assert.equal(await page.getByLabel('Preset name').inputValue(),demos.find(d=>d.family===family).recipe.name);
  assert.deepEqual(errors,[]);results.push({family,environment,playPauseReset:true,exactRecipe:true,mobileWidths:[390,320],handoff:true,errors});
  console.log(`${family}: context playback, recipe, mobile, workbench handoff passed`);
 }finally{await browser.close();}
}
await writeFile(`${out}/report.json`,JSON.stringify({results,methodology:'Each context in its own fresh browser to isolate GPU allocations. Ten new families plus two historical controls. Actual playback and paused time, reset, exact recipe download, 390/320px overflow/pixel-preserving scaling, workbench handoff.'},null,2));
