import { chromium,firefox,webkit,devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import QRCode from 'qrcode';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { testOrigin } from './test-origin.mjs';
const base=process.env.BASE_URL||'http://127.0.0.1:5185/';
mkdirSync('test-results',{recursive:true});
const selected=process.env.TEST_ENGINES?.split(',')||['chromium','firefox','webkit'];
const profiles=[['desktop',{viewport:{width:1440,height:1000}}],['android',devices['Pixel 7']],['iphone',devices['iPhone 13']],['tablet',devices['iPad (gen 7)']],['small',{viewport:{width:320,height:800}}]];
const report=[];
let failures=0;
// Preview startup is asynchronous in CI. Wait for a real response before opening browsers.
for(let attempt=0;attempt<60;attempt++){
  try{const ready=await fetch(base,{signal:AbortSignal.timeout(3000)});if(ready.ok)break;}catch{}
  if(attempt===59)throw new Error('Preview did not become ready: '+base);
  await new Promise(resolve=>setTimeout(resolve,500));
}
for(const engine of selected){
  const type={chromium,firefox,webkit}[engine];
  let browser;
  try{browser=await type.launch({headless:true});}catch(e){failures++;console.log('FAIL '+engine+'/launch: '+e.message);report.push({engine,profile:'launch',status:'FAIL',error:e.message});continue;}
  try{
    for(const[name,profile]of profiles){
      if(engine==='firefox'&&profile.isMobile)continue;
      const context=await browser.newContext({...profile,acceptDownloads:true});
      const page=await context.newPage();const errors=[];const outbound=[];
      page.on('pageerror',err=>errors.push(err.message));page.on('request',req=>{if(!req.url().startsWith(base)&&!req.url().startsWith('blob:')&&!req.url().startsWith('data:'))outbound.push(req.url());});
      try{
        await page.goto(base,{waitUntil:'networkidle'});
        await page.getByRole('button',{name:/Sprawdź wiadomość/}).click();
        assert.match(await page.locator('#form-error').innerText(),/Wklej/);
        await page.locator('textarea#message').fill('InPost: Dopłać 2,99 zł w ciągu 30 minut: https://inpost.pl.oszust.example/oplata');
        await page.getByRole('button',{name:/Sprawdź wiadomość/}).click();
        assert.equal(await page.locator('#risk-heading').innerText(),'Wysokie ryzyko');
        assert.match(await page.locator('#reasons').innerText(),/inna domena/);
        await page.getByRole('button',{name:/Zapytaj bliską osobę/}).click();
        await page.locator('#share-dialog').waitFor({state:'visible'});
        assert.ok(await page.locator('#share-dialog').isVisible());
        assert.ok(!(await page.locator('#share-text').inputValue()).includes('oszust.example'));
        await page.getByRole('button',{name:'Pobierz TXT',exact:true}).click();
        await page.getByRole('button',{name:'Zamknij',exact:true}).click();
        await page.getByRole('button',{name:'Wyczyść',exact:true}).click();
        assert.equal(await page.locator('#message').inputValue(),'');
        assert.ok(await page.locator('#empty-result').isVisible());
        await page.locator('#message').fill('<img src=x onerror=alert(1)> Cześć jutro o 17');
        await page.getByRole('button',{name:/Sprawdź wiadomość/}).click();
        assert.equal(await page.locator('#risk-heading').innerText(),'Brak wyraźnych sygnałów');
        assert.equal(await page.locator('#reasons img').count(),0);
        await page.locator('#message').fill('Nowa treść');
        assert.ok(await page.locator('#filled-result').isHidden());
        await page.getByRole('button',{name:/Duże litery/}).click();
        await page.waitForFunction(()=>document.querySelector('#large-type').getAttribute('aria-pressed')==='true');
        assert.equal(await page.locator('#large-type').getAttribute('aria-pressed'),'true');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No horizontal overflow');
        const a11y=await new AxeBuilder({page}).analyze();
        const serious=a11y.violations.filter(x=>['serious','critical'].includes(x.impact));
        assert.deepEqual(serious.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[]);
        await page.getByRole('button',{name:/Duże litery/}).click();
        await page.locator('#message').fill('Wyślij mi kod BLIK');await page.getByRole('button',{name:/Sprawdź wiadomość/}).click();
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:`test-results/${engine}-${name}.png`,fullPage:true});
        assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
        report.push({engine,profile:name,checks:'form, risk, domain, share privacy, reset, XSS, stale result, font, overflow, accessibility, no external requests',status:'PASS'});
        console.log('PASS '+engine+'/'+name);
      }catch(e){failures++;console.log('FAIL '+engine+'/'+name+': '+e.message);report.push({engine,profile:name,status:'FAIL',error:e.message});await page.screenshot({path:`test-results/FAIL-${engine}-${name}.png`,fullPage:true});}
      await context.close();
    }
    // One full OCR / QR / offline integration per browser, with real packaged assets.
    const origin=await testOrigin();
    const context=await browser.newContext({viewport:{width:1200,height:1000}});const page=await context.newPage();
    try{
      const fixture=await browser.newPage({viewport:{width:1000,height:240}});
      await fixture.setContent('<html><body style="font:32px Arial;background:white;color:black;padding:25px">InPost: Doplac 2,99 zl.<br>https://inpost-doplata.example</body></html>');
      const screenshot=await fixture.screenshot();await fixture.close();
      await page.goto(origin.url,{waitUntil:'networkidle'});
      await page.locator('#image-input').setInputFiles({name:'sms.png',mimeType:'image/png',buffer:screenshot});
      await page.locator('#image-status').filter({hasText:'Wybierz odczyt'}).waitFor();
      await page.getByRole('button',{name:'Odczytaj tekst ze zdjęcia',exact:true}).click();
      await page.getByRole('button',{name:/Sprawdź wiadomość/}).waitFor({state:'visible'});
      await page.waitForFunction(()=>!document.querySelector('#analyze-button').disabled,null,{timeout:120000});
      assert.match(await page.locator('#message').inputValue(),/InPost/i);
      await page.getByRole('button',{name:/Sprawdź wiadomość/}).click();assert.equal(await page.locator('#risk-heading').innerText(),'Wysokie ryzyko');
      const qr=await QRCode.toBuffer('https://inpost.pl.oszust.example/pay',{width:480,margin:4});
      await page.locator('#image-input').setInputFiles({name:'qr.png',mimeType:'image/png',buffer:qr});
      await page.locator('#image-status').filter({hasText:'Wybierz odczyt'}).waitFor();await page.getByRole('button',{name:'Odczytaj kod QR',exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('#analyze-button').disabled);
      assert.equal(await page.locator('#message').inputValue(),'https://inpost.pl.oszust.example/pay');
      await page.locator('#image-input').setInputFiles({name:'wrong.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-not-an-image')});
      await page.locator('#form-error').filter({hasText:'Wybierz zdjęcie'}).waitFor();
      await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Gotowa offline'),null,{timeout:120000});
      // Stop the real origin. A new request must fail, while cached navigation,
      // model loading and OCR still work. No mocked responses or skipped engine.
      await origin.close();
      await assert.rejects(fetch(origin.url,{signal:AbortSignal.timeout(3000)}));
      await page.reload({waitUntil:'load'});
      await page.locator('#message').fill('Wyślij mi kod BLIK');await page.getByRole('button',{name:/Sprawdź wiadomość/}).click();assert.equal(await page.locator('#risk-heading').innerText(),'Wysokie ryzyko');
      await page.locator('#image-input').setInputFiles({name:'offline.png',mimeType:'image/png',buffer:screenshot});
      await page.locator('#image-status').filter({hasText:'Wybierz odczyt'}).waitFor();await page.getByRole('button',{name:'Odczytaj tekst ze zdjęcia',exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('#analyze-button').disabled,null,{timeout:120000});assert.match(await page.locator('#message').inputValue(),/InPost/i);
      report.push({engine,profile:'image-and-offline',checks:'real OCR PL/EN, QR decoding, invalid upload, offline reload, offline text analysis, offline OCR',status:'PASS'});
      console.log('PASS '+engine+'/image-and-offline');
    }catch(e){failures++;console.log('FAIL '+engine+'/images: '+e.message);report.push({engine,profile:'image-and-offline',status:'FAIL',error:e.message});await page.screenshot({path:`test-results/FAIL-${engine}-images.png`,fullPage:true});}
    await origin.close();await context.close();
  }finally{await browser.close();}
}
writeFileSync('test-results/report.json',JSON.stringify({base,results:report,failures},null,2));
console.log(JSON.stringify({results:report,failures},null,2));
if(failures)process.exitCode=1;
