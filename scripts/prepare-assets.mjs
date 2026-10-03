import { createRequire } from 'node:module';
import { mkdirSync,copyFileSync,readdirSync,existsSync } from 'node:fs';
import path from 'node:path';
import './icons.mjs';
const require=createRequire(import.meta.url);
function root(pkg) { return path.dirname(require.resolve(pkg+'/package.json')); }
const target='public/ocr';mkdirSync(target+'/core',{recursive:true});mkdirSync(target+'/lang',{recursive:true});
copyFileSync(root('tesseract.js')+'/dist/worker.min.js',target+'/worker.min.js');
const core=path.resolve(root('tesseract.js'),'../tesseract.js-core');
if(!existsSync(core)) throw new Error('Missing tesseract.js-core dependency');
for(const name of readdirSync(core).filter(n=>/\.wasm(?:\.js)?$/.test(n))) copyFileSync(path.join(core,name),target+'/core/'+name);
for(const lang of ['eng','pol']) {
  const folder=root('@tesseract.js-data/'+lang);
  const candidates=[folder+'/4.0.0_best_int/'+lang+'.traineddata.gz',folder+'/4.0.0/'+lang+'.traineddata.gz'];
  const source=candidates.find(existsSync);if(!source) throw new Error('Missing language: '+lang);
  copyFileSync(source,target+'/lang/'+lang+'.traineddata.gz');
}
console.log('Local OCR assets ready (Polish and English).');
