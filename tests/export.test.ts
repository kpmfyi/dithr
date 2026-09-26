import test from 'node:test';
import assert from 'node:assert/strict';
import { presets, serializeRecipe } from '../src/seedbank/recipes.ts';
import { createZip, exampleHtml, integrationCode, reactCode, typescriptCode, validateOutput } from '../src/workbench/export.ts';
import { rotatePalette } from '../src/workbench/color.ts';
import { stepTime, timelineWindow } from '../src/workbench/timeline.ts';
const output={width:960,height:640,animate:true,backend:'auto' as const};

test('all integration formats retain exact settings and validated output',()=>{
  const recipe={...presets.at(-1)!,time:123.456,seed:31415,palette:['#012345','#abcdef','#fedcba'] as [string,string,string]};
  for(const code of [integrationCode(recipe,output),reactCode(recipe,output),typescriptCode(recipe,output)]) {
    assert.ok(code.includes(serializeRecipe(recipe).trim()));
    assert.match(code,/resize\(960, 640\)/);assert.match(code,/prefers-reduced-motion/);assert.match(code,/dispose/);
  }
  for(const n of [NaN,Infinity,15,2049,400.5])for(const key of ['width','height'])assert.throws(()=>validateOutput({...output,[key]:n}));
  assert.throws(()=>integrationCode({...recipe,seed:Infinity},output));
  const hostile={...recipe,name:'</script><script>alert(1)</script>'};
  assert.ok(integrationCode(hostile,output).includes(JSON.stringify(hostile.name)));
  assert.ok(!exampleHtml(output).includes(hostile.name));
  assert.match(reactCode(recipe,output),/if \(cancelled\) \{ instance.dispose\(\); return; \}/);
});
test('ZIP entries retain bytes and reject unsafe or duplicate paths',()=>{
  const encoder=new TextEncoder(),data=encoder.encode('A crisp pixel → #ff0088');
  const zip=createZip([{name:'src/example.ts',data}]),view=new DataView(zip.buffer);
  assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(zip.length-22,true),0x06054b50);
  const start=30+view.getUint16(26,true);assert.deepEqual(zip.slice(start,start+data.length),data);
  assert.equal(view.getUint32(18,true),data.length);
  for(const name of ['../secret','/absolute','a/../../file','a//b','a\\b'])assert.throws(()=>createZip([{name,data}]));
  assert.throws(()=>createZip([{name:'a',data},{name:'a',data}]));
});
test('palette hue rotates stored RGB colors and preserves grayscale',()=>{
  assert.deepEqual(rotatePalette(['#ff0000','#00ff00','#0000ff'],120),['#00ff00','#0000ff','#ff0000']);
  assert.deepEqual(rotatePalette(['#000000','#808080','#ffffff'],145),['#000000','#808080','#ffffff']);
  for(const recipe of presets)assert.deepEqual(rotatePalette(recipe.palette,0),recipe.palette);
  assert.throws(()=>rotatePalette(presets[0].palette,NaN));
});
test('timeline steps clamp at zero and finite horizons without wrapping',()=>{
  assert.equal(stepTime('estuary',0,-1/60),0);
  assert.equal(stepTime('estuary',1e12,10),1e12);
  assert.equal(stepTime('broken-lcd',3600,10),3600);
  assert.deepEqual(timelineWindow('estuary',1e12,60),{start:1e12-60,end:1e12});
  assert.deepEqual(timelineWindow('broken-lcd',3599,10),{start:3590,end:3600});
});
