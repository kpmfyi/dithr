import assert from 'node:assert/strict';
import { readdir, mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { presets,serializeRecipe,GENERATOR_VERSION } from '../src/seedbank/recipes.ts';
import { createZip,integrationCode,typescriptCode,reactCode,exampleHtml,exportReadme } from '../src/workbench/export.ts';

const out=process.env.EXPORT_EVIDENCE_DIR || 'artifacts/code-export-01';
const recipe={...presets.at(-1),seed:31415,time:123.456,generatorVersion:GENERATOR_VERSION,palette:['#132a35','#f26849','#d9eea2','#7950df','#36c4b8']};
const output={width:864,height:1080,animate:false,backend:'webgl2'};
const source=JSON.parse(await readFile('public/export/source.json','utf8'));
const files={...source,'main.js':integrationCode(recipe,output),'Shader.tsx':reactCode(recipe,output),'integration.ts':typescriptCode(recipe,output),
 'index.html':exampleHtml(output),'recipe.json':serializeRecipe(recipe),'output.json':JSON.stringify(output),'README.md':exportReadme(recipe,output),'seedbank.js':await readFile('public/export/seedbank.js','utf8')};
for(const [name,contents] of Object.entries(files)){
 await mkdir(dirname(`${out}/${name}`),{recursive:true});await writeFile(`${out}/${name}`,contents);
}
await writeFile(`${out}/shader.zip`,createZip(Object.entries(files).map(([name,text])=>({name,data:new TextEncoder().encode(text)}))));
execFileSync('python3',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert len(z.namelist())==int(sys.argv[2]); print("Independent ZIP CRC check passed")',`${out}/shader.zip`,String(Object.keys(files).length)],{stdio:'inherit'});
execFileSync(process.execPath,['--check',`${out}/main.js`],{stdio:'inherit'});
const program=ts.createProgram([`${out}/Shader.tsx`,`${out}/integration.ts`],{noEmit:true,strict:true,skipLibCheck:true,allowImportingTsExtensions:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX});
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length)console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));
assert.equal(diagnostics.length,0,'Generated React and TypeScript examples type-check with the exported source tree');
assert.deepEqual(JSON.parse(await readFile(`${out}/recipe.json`,'utf8')),recipe);
assert.deepEqual(JSON.parse(await readFile(`${out}/output.json`,'utf8')),output);
// Every runtime source is offered, and nothing else from the repository.
const runtimeSources=(await readdir('src/seedbank')).filter(n=>n.endsWith('.ts')).length;
assert.equal(Object.keys(source).filter(n=>n.startsWith('src/seedbank/')).length,runtimeSources);
for(const text of Object.values(files))assert.ok(!/\/(?:home|Users)\/[^/\s]+\//.test(text),'Export does not contain machine home paths');
await writeFile(`${out}/report.json`,JSON.stringify({recipe,output,files:Object.keys(files),independentZipCheck:true,javascriptSyntax:true,reactAndTypescriptTypes:true,sourceCount:runtimeSources,notes:'Generated export files, not viewer screenshots. No GPU or browser interaction claim.'},null,2));
console.log('JavaScript syntax, React/TypeScript integration, ZIP CRCs, exact recipe/output and source inclusion passed.');
