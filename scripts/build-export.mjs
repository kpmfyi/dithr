import { build } from 'vite';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
await build({configFile:false,publicDir:false,build:{outDir:'public/export',emptyOutDir:true,sourcemap:false,
  lib:{entry:'src/seedbank/index.ts',formats:['es'],fileName:()=> 'seedbank.js'},minify:true}});
// Only runtime sources are offered for export. No repository metadata or local files.
const files={};
for(const name of (await readdir('src/seedbank')).filter(n=>n.endsWith('.ts')).sort())files[`src/seedbank/${name}`]=await readFile(`src/seedbank/${name}`,'utf8');
files['THIRD_PARTY_LICENSES.txt']=await readFile('node_modules/three/LICENSE','utf8');
files['LICENSE']=await readFile('LICENSE','utf8');
await mkdir('public/export',{recursive:true});
await writeFile('public/export/source.json',JSON.stringify(files));
console.log(`Prepared portable export runtime and ${Object.keys(files).length-2} source files, with project and dependency licenses.`);
