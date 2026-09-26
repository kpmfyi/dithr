// Separate simulation throughput from full-resolution display/readback cost.
import assert from 'node:assert/strict';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { launch } from './browser-support.mjs';
const out=process.env.SYNTHESIS_SIM_DIR || 'artifacts/synthesis-simulation-01';
await mkdir(out,{recursive:true});const browser=await launch(),records=[];
const families=(process.env.MEASURE_FAMILIES || 'broken-lcd,crosscurrent,undertow,downpour,faultline,rotor,slingshot,cell-division,shockfront,filament,intaglio,braid,scrim,guilloche,imbricate,capillary,palimpsest,diffract,microcode,plume,estuary,excitable,sgraffito,relay,slipstream,grain-boundary,countermarch,overprint,avalanche,magnetron').split(',');
try {
 for(let round=0;round<3;round++)for(const family of round%2?[...families].reverse():families){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.SEEDBANK_URL || 'http://127.0.0.1:5187'}/synthesis-lab/scripts/synthesis-lab.html`);await page.waitForFunction(()=>window.synthesisLab);
  const result=await page.evaluate(async ({family,round})=>{
   const own=window.synthesisLab.presets.find(r=>r.family===family);
   const recipe={...own,seed:14562,palette:['#f6f8f5','#0066ff','#a5ff32'],parameters:{scale:2.4,speed:1.5,intensity:1.15,detail:.62}};
   const runtime=await window.synthesisLab.create(recipe),gl=document.querySelector('canvas').getContext('webgl2'),bytes=new Uint8Array(4);
   const complete=()=>gl.readPixels(480,320,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
   runtime.render(10);complete();const ms=[],gpuMs=[];const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   for(let block=0;block<14;block++){
    await new Promise(requestAnimationFrame);
    const query=ext?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    const start=performance.now();
    for(let step=0;step<16;step++)runtime.advance(10+(block*16+step+1)/90);
    runtime.present();if(query)gl.endQuery(ext.TIME_ELAPSED_EXT);complete();
    const elapsed=(performance.now()-start)/16;
    if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw new Error('invalid GL state');
    if(query){while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))await new Promise(requestAnimationFrame);if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw new Error('Disjoint timer result');if(block>=3)gpuMs.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6/16);gl.deleteQuery(query);}
    if(block>=3)ms.push(elapsed);
   }
   const environment=runtime.environment(),values=[...ms].sort((a,b)=>a-b),timerQueryAvailable=!!gl.getExtension('EXT_disjoint_timer_query_webgl2');runtime.dispose();
   const gpuSorted=[...gpuMs].sort((a,b)=>a-b);
   return {family,round,ms,gpuMs,gpuMedian:gpuSorted.length?gpuSorted[Math.floor(gpuSorted.length/2)]:null,median:values[Math.floor(values.length/2)],p95:values[Math.floor(values.length*.95)],environment,timerQueryAvailable};
  },{family,round});assert.deepEqual(errors,[]);records.push(result);await page.close();console.log(`${family} trial ${round+1}: ${result.median.toFixed(3)}ms wall / ${result.gpuMedian?.toFixed(3)}ms timer / simulation step`);
 }
 const sourceHashes={};for(const file of ['synthesis.ts','synthesis-evolution.ts','intricacy.ts','broken-lcd.ts'])sourceHashes[file]=createHash('sha256').update(await readFile(`src/seedbank/${file}`)).digest('hex');
 await writeFile(`${out}/report.json`,JSON.stringify({sourceHashes,records,browser:await browser.version(),uncapped:process.env.SEEDBANK_UNCAPPED==='1',methodology:'Simulation throughput, not frame latency. Each block advances exactly 16 fixed simulation steps at speed 1.5, then presents once at 960x640 and synchronously reads one pixel. Block duration divided by 16 includes amortized display/readback and CPU scheduling. 3 warmup blocks +11 measured blocks per trial, three order-alternated trials, isolated canvas. Feedback 384x256 except legacy Cell division 320px maximum. Matched seed/palette/controls. EXT_disjoint_timer_query_webgl2 intervals recorded separately in gpuMs; queried after completion and rejected if disjoint. Software adapter; no physical GPU claim.'},null,2));
}finally{await browser.close();}
