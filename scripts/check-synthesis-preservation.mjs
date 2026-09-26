import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { launch,openConsumer } from './browser-support.mjs';
const out='artifacts/synthesis-preservation-05';await mkdir(out,{recursive:true});
const browser=await launch(),checks=[];
try{
 const {page,errors}=await openConsumer(browser,'http://127.0.0.1:5187','webgl2');
 const recipes=await page.evaluate(()=>window.seedbank.presets.filter(r=>r.generatorVersion==='1.7.0'));
 for(const recipe of recipes){
  const frames=await page.evaluate(async recipe=>{
   const runtime=window.seedbank.runtime;runtime.setRecipe(recipe);
   const capture=async (size,t)=>{runtime.resize(...size);const blob=await runtime.capture(t);return new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});};
   return [await capture([960,640],3.25),await capture([480,480],3.25),await capture([480,480],60)];
  },recipe);
  const paths=[`artifacts/synthesis-04-webgl2/${recipe.id}/frozen.png`,`artifacts/synthesis-review-03-${recipe.family}/adjacent/00.png`,`artifacts/synthesis-review-03-${recipe.family}/lifecycle/30.png`];
  for(let i=0;i<3;i++)assert.deepEqual(Buffer.from(frames[i].split(',')[1],'base64'),await readFile(paths[i]),`${recipe.family}: preserved ${paths[i]}`);
  checks.push({family:recipe.family,frozen:true,adjacent:true,minuteEnd:true});console.log(`${recipe.family}: frozen, adjacent, minute-end preserved byte-for-byte`);
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({sourceSha256:createHash('sha256').update(await readFile('src/seedbank/synthesis.ts')).digest('hex'),checks,errors,methodology:'Current optimized graph reproduces the prior 960x640 frozen frame and the 480x480 lifecycle first/last frames byte-for-byte for every family.'},null,2));
}finally{await browser.close();}
