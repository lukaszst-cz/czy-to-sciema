import { mkdirSync,writeFileSync,existsSync } from 'node:fs';
const output='public/data/threats.json';
try{
  const response=await fetch('https://hole.cert.pl/domains/v2/domains.txt',{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const raw=await response.text();
  const domains=[...new Set(raw.split(/\r?\n/).map(s=>s.trim().toLowerCase()).filter(s=>/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(s)))];
  if(domains.length<1000)throw new Error('Unexpected list format');
  mkdirSync('public/data',{recursive:true});writeFileSync(output,JSON.stringify({source:'https://hole.cert.pl/domains/v2/domains.txt',fetchedAt:new Date().toISOString(),domains}));
  console.log('CERT snapshot: '+domains.length+' domains.');
}catch(e){
  if(process.env.CI)throw e;
  if(!existsSync(output)){mkdirSync('public/data',{recursive:true});writeFileSync(output,JSON.stringify({fetchedAt:null,domains:[]}));}
  console.log('CERT snapshot unavailable: '+e.message);
}
