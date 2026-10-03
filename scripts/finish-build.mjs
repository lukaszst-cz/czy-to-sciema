import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const files=[];
function walk(dir='dist') {for(const x of readdirSync(dir,{withFileTypes:true})) {const p=path.join(dir,x.name);if(x.isDirectory())walk(p);else if(x.name!=='sw.js')files.push(p.replaceAll('\\','/').replace(/^dist\//,''));}}
walk();
const version=createHash('sha256').update(files.map(f=>readFileSync('dist/'+f)).reduce((a,b)=>Buffer.concat([a,b]),Buffer.alloc(0))).digest('hex').slice(0,12);
const template=readFileSync('public/sw.js','utf8');
writeFileSync('dist/sw.js',template.replace('__CACHE_VERSION__',version).replace('/*__ASSETS__*/[]',JSON.stringify(files.map(f=>'./'+f))));
writeFileSync('dist/.nojekyll','');
console.log(`Offline cache ${version}: ${files.length} files.`);
