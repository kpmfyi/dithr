import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { launch } from './browser-support.mjs';
const out=process.env.SYNTHESIS_COUPLING_DIR || 'artifacts/synthesis-coupling-01';
await mkdir(out,{recursive:true});
const browser=await launch(), results=[];
try {
 const families=(process.env.REVIEW_FAMILIES || 'estuary,excitable,sgraffito,relay,slipstream,grain-boundary,countermarch,overprint,avalanche,magnetron').split(',');
 for(const family of families) {
  const captures=[];
  for(const coupling of [1,0]) {
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${process.env.SEEDBANK_URL || 'http://127.0.0.1:5187'}/synthesis-lab/scripts/synthesis-lab.html`);
   await page.waitForFunction(()=>window.synthesisLab);
   const data=await page.evaluate(async ({family,coupling})=>{
    const own=window.synthesisLab.presets.find(r=>r.family===family);
    const recipe={...own,seed:14562,palette:['#f6f8f5','#0066ff','#a5ff32'],parameters:{scale:2.4,speed:1.5,intensity:1.15,detail:.62}};
    const runtime=await window.synthesisLab.create(recipe,coupling), frames=[];
    for(const time of [3.25,13.25,33.25])frames.push({time,png:await runtime.capture(time)});
    const environment=runtime.environment();runtime.dispose();return {frames,environment};
   },{family,coupling});
   assert.deepEqual(errors,[]);
   for(const frame of data.frames)await writeFile(`${out}/${family}-${coupling}-${frame.time}.png`,Buffer.from(frame.png.split(',')[1],'base64'));
   captures.push({coupling,environment:data.environment});await page.close();
  }
  results.push({family,captures});console.log(`${family}: normal and memory-disabled renders saved`);
 }
 const sourceSha256=createHash('sha256').update(await readFile('src/seedbank/synthesis.ts')).digest('hex');
 await writeFile(`${out}/report.json`,JSON.stringify({sourceSha256,results,methodology:'Independent Three.js renderer. Shared seed, palette, controls and three times. Only the feedback-memory coupling coefficient changes (1 vs 0); geometry, event schedule, resolution, display and transport candidates are held constant. Pixel and structural differences are causal checks, not aesthetic scores.'},null,2));
}finally{await browser.close();}
