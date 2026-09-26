// Benchmark a block of completed output frames to amortize browser readback overhead.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { launch, openConsumer } from './browser-support.mjs';
const out=process.env.SYNTHESIS_MEASURE_DIR || 'artifacts/synthesis-measure-batched-01';
await mkdir(out,{recursive:true});
const selected=(process.env.MEASURE_FAMILIES || 'broken-lcd,crosscurrent,undertow,downpour,faultline,rotor,slingshot,cell-division,shockfront,filament,intaglio,braid,scrim,guilloche,imbricate,capillary,palimpsest,diffract,microcode,plume,estuary,excitable,sgraffito,relay,slipstream,grain-boundary,countermarch,overprint,avalanche,magnetron').split(',');
const rounds=Number(process.env.MEASURE_ROUNDS || 3), browser=await launch();
try {
 const {page,errors}=await openConsumer(browser,process.env.SEEDBANK_URL || 'http://127.0.0.1:5187','webgl2');
 const records=[];
 for(let round=0;round<rounds;round++) for(const family of round%2 ? [...selected].reverse():selected) {
  const data=await page.evaluate(async ({family,round})=>{
   const runtime=window.seedbank.runtime, own=window.seedbank.presets.find(r=>r.family===family);
   const recipe={...own,seed:14562,palette:['#f6f8f5','#0066ff','#a5ff32'],parameters:{scale:2.4,speed:1.5,intensity:1.15,detail:.62}};
   runtime.setRecipe(recipe);runtime.resize(960,640);await runtime.compile();
   const gl=document.querySelector('#canvas').getContext('webgl2');
   const readback=new Uint8Array(4), complete=()=>gl.readPixels(480,320,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readback);
   runtime.render(10);complete();
   if(gl.isContextLost() || gl.getError()!==gl.NO_ERROR)throw new Error('invalid context before timing');
   const ms=[],gpuMs=[], checksums=[];const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   for(let block=0;block<15;block++) {
    await new Promise(requestAnimationFrame);
    const query=ext?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    const start=performance.now();
    for(let n=0;n<8;n++)runtime.render(10+(block*8+n+1)/60);
    if(query)gl.endQuery(ext.TIME_ELAPSED_EXT);complete(); const elapsed=(performance.now()-start)/8;
    if(gl.isContextLost() || gl.getError()!==gl.NO_ERROR)throw new Error('invalid context during timing');
    if(query){while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))await new Promise(requestAnimationFrame);if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw new Error('Disjoint timer result');if(block>=3)gpuMs.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6/8);gl.deleteQuery(query);}
    if(block>=3)ms.push(elapsed);
    checksums.push([...readback].join(','));
   }
   const values=[...ms].sort((a,b)=>a-b);
   const gpuSorted=[...gpuMs].sort((a,b)=>a-b);
   return {family,round,ms,gpuMs,gpuMedian:gpuSorted.length?gpuSorted[Math.floor(gpuSorted.length/2)]:null,median:values[Math.floor(values.length/2)],p95:values[Math.floor(values.length*.95)],
    readbackChanges:new Set(checksums).size,timerQueryAvailable:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),environment:runtime.environment()};
  },{family,round});records.push(data);console.log(`${family} round ${round+1}: ${data.median.toFixed(2)}ms wall / ${data.gpuMedian?.toFixed(2)}ms timer per output frame`);
 }
 assert.deepEqual(errors,[]);
 const sourceHashes={};for(const file of ['synthesis.ts','synthesis-evolution.ts','intricacy.ts','broken-lcd.ts'])sourceHashes[file]=createHash('sha256').update(await readFile(`src/seedbank/${file}`)).digest('hex');
 await writeFile(`${out}/report.json`,JSON.stringify({sourceHashes,uncapped:process.env.SEEDBANK_UNCAPPED === '1',methodology:'Single canvas. WebGL2 synchronous 1-pixel readback after each block of eight output frames. 960x640 output and 384x256 feedback except Cell division (320px max); matched seed, palette, scale 2.4, speed 1.5, detail .62, intensity 1.15. Fixed 1/60s input increments; 3 warmup blocks +12 measured blocks per trial; order alternates between trials. Median and p95 are block ms divided by 8, NOT single-frame latency. Includes CPU and software GPU completion plus amortized readback. EXT_disjoint_timer_query_webgl2 intervals recorded separately in gpuMs and rejected if disjoint. Context and GL error checked. One RAF yield between blocks. No other shader test runs concurrently. Not a physical GPU benchmark.',records,errors},null,2));
}finally{await browser.close();}
