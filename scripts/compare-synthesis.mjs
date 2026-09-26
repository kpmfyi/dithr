import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch, openConsumer } from './browser-support.mjs';
const out=process.env.SYNTHESIS_COMPARISON_DIR || 'artifacts/synthesis-comparison-01';
await mkdir(out,{recursive:true});
const browser=await launch(), records=[];
try {
 const {page,errors}=await openConsumer(browser,process.env.SEEDBANK_URL || 'http://127.0.0.1:5187','webgl2');
 const families=await page.evaluate(()=>window.seedbank.presets.map(r=>r.family));
 for(const family of families){
  const result=await page.evaluate(async family=>{
   const runtime=window.seedbank.runtime,own=window.seedbank.presets.find(r=>r.family===family);
   const recipe={...own,seed:14562,palette:['#f6f8f5','#0066ff','#a5ff32'],parameters:{scale:2.4,speed:1.5,intensity:1.15,detail:.62}};
   runtime.setRecipe(recipe);runtime.resize(960,640);await runtime.compile();
   const frames=[];
   for(const time of [3.25,13.25,33.25]){
    const blob=await runtime.capture(time);
    const png=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
    frames.push({time,png});
   }
   return {frames,environment:runtime.environment(),recipe};
  },family);
  for(const frame of result.frames)await writeFile(`${out}/${family}-${frame.time}.png`,Buffer.from(frame.png.split(',')[1],'base64'));
  records.push({family,environment:result.environment,recipe:result.recipe});console.log(`${family}: three shared-input frames`);
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({records,errors,methodology:'All 50 active studies; same seed 14562, palette, scale 2.4, speed 1.5, intensity 1.15 and detail .62; 960x640 at 3.25,13.25,33.25 seconds. Isolates family rules from default palette and seed. Not a perceptual novelty proof.'},null,2));
}finally{await browser.close();}
