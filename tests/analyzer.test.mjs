import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze,extractLinks,listedDomain,shareReport,normalize,MAX_TEXT } from '../src/analyzer.js';
const scenarios=[
  ['courier impersonation','InPost: Dopłać 2,99 zł: https://inpost-doplata.example/oplata','high','brand-InPost'],
  ['bank credentials','PKO BP: Podaj hasło i kod SMS na https://pko.example/login','high','secrets'],
  ['BLIK request','Cześć wyślij mi kod BLIK, oddam jutro','high','blik'],
  ['reverse BLIK request','Kod BLIK proszę prześlij teraz','high','blik'],
  ['remote access','Bank: zainstaluj AnyDesk aby ochronić konto','high','remote'],
  ['safe account','Przelej środki na bezpieczne konto banku','high','safe-account'],
  ['marketplace receipt','OLX: odbierz pieniądze w formularzu https://odbior.example','high','marketplace'],
  ['family emergency','Mamo, mam nowy numer, potrzebuję przelewu','high','family'],
  ['guaranteed profit','Gwarantowany zysk 70% z inwestycji bez ryzyka','high','investment'],
  ['deceptive subdomain','InPost dopłata: https://inpost.pl.oszust.example','high','brand-InPost'],
  ['userinfo trick','https://inpost.pl@oszust.example/','high','userinfo'],
  ['system command','Aby potwierdzić CAPTCHA wciśnij Win+R i wklej powershell','high','command'],
  ['javascript URL','javascript:alert(document.cookie)','high','command'],
  ['HTTP payments','Zapłać tutaj http://example.com/pay','caution','http'],
  ['short URL','https://bit.ly/test','caution','shortener'],
  ['national domain','https://żółw.pl','caution','idn'],
  ['ordinary','Spotkajmy się jutro o 17 przy kawiarni.','unknown',null],
  ['unrecognised link','https://example.com/','unknown',null],
  ['official link','InPost: przesyłkę znajdziesz na https://inpost.pl','unknown',null],
  ['official subdomain','PKO: https://www.pkobp.pl','unknown',null],
  ['official e-government','Ministerstwo Finansów https://podatki.gov.pl','unknown',null],
  ['educational mention','Nie podawaj nikomu kodu BLIK.','unknown',null],
];
for(const[name,input,level,reason]of scenarios)test(name,()=>{const r=analyze(input);assert.equal(r.level,level);if(reason)assert.ok(r.reasons.some(x=>x.id===reason));});
test('empty input rejected',()=>assert.throws(()=>analyze('   '),/Wklej/));
test('input limit enforced',()=>assert.throws(()=>analyze('x'.repeat(MAX_TEXT+1)),/najwyżej/));
test('Unicode normalization',()=>assert.equal(normalize('ZAŻÓŁĆ ŁÓDŹ'),'zazolc lodz'));
test('no link safety guarantee',()=>assert.match(analyze('Cześć').summary,/nie potwierdza bezpieczeństwa/));
test('registered domain is not deceptive prefix',()=>assert.equal(extractLinks('https://inpost.pl.evil.co.uk/pay')[0].domain,'evil.co.uk'));
test('defanged links parsed',()=>assert.equal(extractLinks('hxxps://evil[.]example/login')[0].host,'evil.example'));
test('trailing punctuation removed',()=>assert.equal(extractLinks('Sprawdź (https://example.com/).')[0].host,'example.com'));
test('CERT exact host',()=>{const r=analyze('https://scam.example',{domains:new Set(['scam.example']),listDate:'test'});assert.equal(r.level,'high');assert.ok(r.reasons.some(x=>x.id==='cert-scam.example'));});
test('CERT subdomain covered',()=>assert.equal(listedDomain('pay.scam.example',new Set(['scam.example'])),'scam.example'));
test('CERT parent not flagged by child entry',()=>assert.equal(listedDomain('example.com',new Set(['bad.example.com'])),null));
test('CERT suffix collision not matched',()=>assert.equal(listedDomain('notscam.example',new Set(['scam.example'])),null));
test('CERT uppercase and trailing dot',()=>assert.equal(listedDomain('A.SCAM.EXAMPLE.',new Set(['scam.example'])),'scam.example'));
test('shared report excludes message, URLs and private identifiers',()=>{const input='Cześć Jan Kowalski, numer 555123456, konto 12345678901234567890123456. Wyślij kod BLIK na https://evil.example';const report=shareReport(analyze(input));for(const secret of ['Jan','555123456','12345678901234567890123456','evil.example','https://'])assert.ok(!report.includes(secret));});
test('hostile HTML is data',()=>{const r=analyze('<img src=x onerror=alert(1)> Podaj hasło');assert.equal(r.level,'high');});
test('long multi-link input bounded',()=>{const r=analyze(Array.from({length:100},(_,i)=>`https://a${i}.example`).join(' '));assert.equal(r.links.length,40);assert.equal(r.limited,true);});
test('HTTPS alone never produces safe verdict',()=>assert.equal(analyze('https://secure.example').level,'unknown'));
