import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createIntricacyEvolution } from '../src/seedbank/intricacy-evolution.ts';
import { createSynthesisEvolution } from '../src/seedbank/synthesis-evolution.ts';
const out=process.env.SYNTHESIS_SCORE_DIR || 'artifacts/synthesis-score-01';
const trials=[];let checksum=0;
const consume=value=>{
 let sum=value.carrier ?? 0;for(const x of value.drift)sum+=x;if(value.warp)for(const x of value.warp)sum+=x;
 for(const event of value.events)for(let i=0;i<4;i++)sum+=event.a[i]+event.b[i];
 return sum;
};
for(let round=0;round<7;round++)for(const name of round%2?['synthesis','intricacy']:['intricacy','synthesis']){
 const score=(name==='intricacy'?createIntricacyEvolution:createSynthesisEvolution)(14562);
 for(let i=0;i<3000;i++)checksum+=consume(score.sample(i/60));
 const start=performance.now(), samples=60000;
 for(let i=0;i<samples;i++){const value=score.sample(100+i/60);checksum+=consume(value);}
 trials.push({name,round,samples,ms:performance.now()-start});
}
assert.ok(Number.isFinite(checksum));
await mkdir(out,{recursive:true});await writeFile(`${out}/report.json`,JSON.stringify({trials,checksum,node:process.version,methodology:'CPU event-input generation plus consuming every emitted drift, warp, event and carrier value (to avoid an unused-output benchmark), not whole-frame or GPU timing. Same seed and 60,000 consecutive simulation times per trial; 3,000 warmups; seven trials with alternating order. Old score has six renewal slots/eight tracks and allocates per step; new score has four overlapping renewal slots/four tracks and reuses storage. Outputs differ, so this measures the cost of each design, not an equivalent-output optimization.'},null,2));
for(const name of ['intricacy','synthesis']){const ms=trials.filter(t=>t.name===name).map(t=>t.ms).sort((a,b)=>a-b);console.log(name,ms[3].toFixed(2),'ms / 60,000 samples');}
