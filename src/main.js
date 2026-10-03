import './styles.css';
import { analyze, shareReport } from './analyzer.js';
import { imageCanvas, readQR, readText } from './image-reader.js';
const $=id=>document.getElementById(id);
const message=$('message');
let result=null,canvas=null,worker=null,reading=false,generation=0,list=new Set(),listDate=null,installPrompt=null;
const examples={
  parcel:'InPost: Twoja paczka została wstrzymana. Dopłać 2,99 zł w ciągu 30 minut: https://inpost-doplata.example/oplata',
  bank:'PKO BP: Konto zostanie zablokowane. Zaloguj się natychmiast i podaj kod SMS: https://pko-weryfikacja.example/login',
  family:'Cześć, potrzebuję szybko zapłacić. Wyślij mi kod BLIK, za chwilę oddam pieniądze.',
  ordinary:'Cześć! Spotkajmy się jutro o 17 przy kawiarni. Daj znać, czy Ci pasuje.'
};
function hideResult(){result=null;$('empty-result').hidden=false;$('filled-result').hidden=true;}
function count(){ $('char-count').textContent=message.value.length.toLocaleString('pl-PL')+' / 20 000'; }
function error(text=''){ $('form-error').textContent=text;$('form-error').hidden=!text; }
function invalidate(){hideResult();error();count();}
message.addEventListener('input',invalidate);
document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{message.value=examples[b.dataset.example];invalidate();message.focus();}));
function render(analysis){
  result=analysis;$('empty-result').hidden=true;$('filled-result').hidden=false;
  $('risk-box').className='risk-box '+result.level;
  $('risk-label').textContent=result.level==='high'?'⚠ Sygnały ostrzegawcze':result.level==='caution'?'! Wymaga sprawdzenia':'? Ocena ograniczona';
  $('risk-heading').textContent=result.label;$('risk-summary').textContent=result.summary;
  $('reasons').replaceChildren();
  const reasons=result.reasons.length?result.reasons:[{title:'Nie znaleziono opisanych schematów',detail:'Ocena obejmuje tylko dostarczony tekst i zapis adresów. Nie sprawdza właściciela strony, nadawcy ani jej zawartości.'}];
  for(const r of reasons){const li=document.createElement('li');const title=document.createElement('strong');title.textContent=r.title;const detail=document.createElement('p');detail.textContent=r.detail;li.append(title,detail);$('reasons').append(li);}
  $('links-details').hidden=!result.links.length;$('links-list').replaceChildren();
  for(const link of result.links){const li=document.createElement('li');li.textContent=link.invalid?'Adres nieczytelny':`Domena: ${link.host} | domena główna: ${link.domain}`;$('links-list').append(li);}
  if(result.limited){const li=document.createElement('li');li.textContent='Sprawdzono pierwszych 40 adresów. Podziel wiadomość na części, aby sprawdzić resztę.';$('links-list').append(li);}
  $('next-step').textContent={
    bank:'Otwórz samodzielnie swoją aplikację bankową lub zadzwoń na numer z karty. Nie korzystaj z kontaktu podanego w podejrzanej wiadomości.',
    marketplace:'Sprawdź rozmowę i płatność w oficjalnej aplikacji platformy. Nie podawaj danych karty, aby odebrać pieniądze.',
    family:'Zadzwoń do tej osoby na numer, który znasz od wcześniej. Potwierdź prośbę głosem, zanim podasz kod lub wykonasz przelew.',
    parcel:'Sprawdź przesyłkę w aplikacji przewoźnika lub na stronie otwartej samodzielnie. Zweryfikuj, czy w ogóle oczekujesz takiej paczki.',
    general:'Potwierdź sprawę przez znany wcześniej numer lub oficjalną aplikację. Jeśli masz wątpliwości, poproś bliską osobę o pomoc.'
  }[result.context];
  $('result').focus({preventScroll:true});$('result').scrollIntoView({behavior:'auto',block:'start'});
}
$('analysis-form').addEventListener('submit',event=>{event.preventDefault();error();try{render(analyze(message.value,{domains:list,listDate}));}catch(e){error(e.message);message.focus();}});
async function cancel(){generation++;reading=false;if(worker){const current=worker;worker=null;await current.terminate().catch(()=>{});}buttons(false);}
function buttons(busy){reading=busy;$('ocr-button').disabled=busy;$('qr-button').disabled=busy;$('cancel-image').hidden=!busy;$('analyze-button').disabled=busy;}
$('cancel-image').addEventListener('click',async()=>{await cancel();$('image-status').textContent='Odczyt anulowany. Możesz wkleić tekst lub spróbować ponownie.';});
$('clear-button').addEventListener('click',async()=>{await cancel();message.value='';canvas=null;$('image-input').value='';$('image-tools').hidden=true;$('image-status').textContent='';$('file-name').textContent='';$('share-text').value='';if($('share-dialog').open)$('share-dialog').close();invalidate();message.focus();});
async function selectImage(file){
  await cancel();canvas=null;invalidate();$('image-tools').hidden=false;$('file-name').textContent=file.name;$('image-status').textContent='Wczytuję obraz na tym urządzeniu…';
  const current=generation;
  try{const loaded=await imageCanvas(file);if(current!==generation)return;canvas=loaded;$('image-status').textContent='Wybierz odczyt tekstu albo QR. Sprawdź odczyt przed analizą.';}catch(e){if(current===generation){$('image-status').textContent='';error(e.message);}}
}
$('image-input').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)void selectImage(file);});
message.addEventListener('paste',e=>{const file=Array.from(e.clipboardData?.files||[]).find(f=>f.type.startsWith('image/'));if(file){e.preventDefault();void selectImage(file);}});
$('qr-button').addEventListener('click',()=>{if(!canvas){error('Najpierw dodaj czytelny obraz.');return;}error();const decoded=readQR(canvas);if(!decoded){$('image-status').textContent='Nie znaleźliśmy QR. Przytnij zdjęcie do jednego kodu, pozostaw biały margines i spróbuj ponownie.';return;}message.value=decoded;invalidate();$('image-status').textContent='Kod QR odczytany. Nie otwieraliśmy jego adresu. Sprawdź poniższą treść i wybierz „Sprawdź wiadomość”.';message.focus();});
$('ocr-button').addEventListener('click',async()=>{
  if(!canvas){error('Najpierw dodaj czytelny obraz.');return;}error();buttons(true);const current=++generation;
  $('image-status').textContent='Odczytuję tekst lokalnie. Pierwszy odczyt może potrwać kilkadziesiąt sekund…';
  try{
    const data=await readText(canvas,m=>{if(current===generation&&m.status==='recognizing text')$('image-status').textContent=`Odczytuję tekst: ${Math.round(m.progress*100)}%.`;},w=>{if(current===generation)worker=w;else if(w)void w.terminate().catch(()=>{});});
    if(current!==generation)return;
    if(!data.text)throw new Error('Nie znaleźliśmy tekstu. Przytnij zdjęcie lub wklej wiadomość ręcznie.');
    message.value=data.text;invalidate();
    $('image-status').textContent=(data.confidence<70?'Odczyt może zawierać dużo błędów. ':'Tekst odczytany. ')+'Sprawdź zwłaszcza adresy i popraw błędy przed analizą.';
    message.focus();
  }catch(e){if(current===generation){console.warn('Local image reader failed:',e.name);error('Nie udało się odczytać tekstu. Spróbuj z wyraźniejszym zdjęciem albo wklej wiadomość ręcznie.');$('image-status').textContent='Odczyt nie powiódł się. Nie nadano oceny ryzyka.';}}
  finally{if(current===generation){worker=null;buttons(false);}}
});
$('share-button').addEventListener('click',()=>{if(!result)return;$('share-text').value=shareReport(result);$('native-share').hidden=!navigator.share;$('share-status').textContent='';$('share-dialog').showModal();});
$('close-share').addEventListener('click',()=>$('share-dialog').close());
$('native-share').addEventListener('click',async()=>{try{await navigator.share({title:'CzyToŚciema? Pomóż mi sprawdzić wiadomość',text:$('share-text').value});$('share-status').textContent='Przekazano raport do wybranej aplikacji.';}catch(e){$('share-status').textContent=e.name==='AbortError'?'Udostępnianie anulowane.':'Udostępnianie niedostępne. Użyj „Kopiuj” lub „Pobierz TXT”.';}});
$('copy-report').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('share-text').value);$('share-status').textContent='Skopiowano. Wklej raport w rozmowie z zaufaną osobą.';}catch{$('share-text').focus();$('share-text').select();$('share-status').textContent='Zaznaczyliśmy raport. Skopiuj go ręcznie albo pobierz TXT.';}});
$('download-report').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([$ ('share-text').value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='CzyToSciema-ocena.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('share-status').textContent='Przygotowano plik TXT z oceną.';});
function large(value){document.documentElement.classList.toggle('large-type',value);$('large-type').setAttribute('aria-pressed',String(value));try{localStorage.setItem('czytosciema-large',String(value));}catch{}}
try{large(localStorage.getItem('czytosciema-large')==='true');}catch{}
$('large-type').addEventListener('click',()=>large(!document.documentElement.classList.contains('large-type')));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install-button').hidden=false;});
$('install-button').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install-button').hidden=true;}});
async function loadList(){
  try{
    const response=await fetch('./data/threats.json',{cache:'no-cache'});if(!response.ok)throw new Error('list unavailable');
    const data=await response.json();if(!data.fetchedAt||!Array.isArray(data.domains)||!data.domains.length)throw new Error('empty list');
    list=new Set(data.domains);listDate=new Date(data.fetchedAt).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'});
    const age=Date.now()-Date.parse(data.fetchedAt);
    $('list-status').textContent=`Kopia listy CERT Polska: ${listDate}. ${list.size.toLocaleString('pl-PL')} domen. `+(age>86400000?'Kopia ma ponad dobę; może być nieaktualna. ':'To kopia, nie sprawdzenie na żywo.');
    if(result)render(analyze(message.value,{domains:list,listDate}));
  }catch{$('list-status').textContent='Lista CERT Polska niedostępna. Działa analiza treści i budowy adresów.';}
}
void loadList();
if('serviceWorker' in navigator&&!import.meta.env.DEV){
  navigator.serviceWorker.register('./sw.js').then(async registration=>{
    registration.addEventListener('updatefound',()=>{const incoming=registration.installing;incoming?.addEventListener('statechange',()=>{if(incoming.state==='installed'&&navigator.serviceWorker.controller){$('offline-status').textContent='Dostępna nowa wersja. Zamknij aplikację i otwórz ją ponownie.';}});});
    await navigator.serviceWorker.ready;$('offline-status').textContent='✓ Gotowa offline';
  }).catch(()=>{$('offline-status').textContent='Tryb offline niedostępny w tej przeglądarce';});
}else{$('offline-status').textContent=import.meta.env.DEV?'Wersja lokalna':'Do działania potrzebna jest otwarta przeglądarka';}
// Only user interface preference is persisted. Clear private working data on page departure.
window.addEventListener('pagehide',()=>{message.value='';$('share-text').value='';canvas=null;hideResult();void cancel();});
count();
