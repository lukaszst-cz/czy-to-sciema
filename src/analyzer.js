import { parse } from 'tldts';

export const MAX_TEXT = 20000;
export const BRANDS = [
  { name: 'InPost', pattern: /\binpost\b/i, domains: ['inpost.pl'] },
  { name: 'DPD', pattern: /\bdpd\b/i, domains: ['dpd.com', 'dpd.com.pl'] },
  { name: 'DHL', pattern: /\bdhl\b/i, domains: ['dhl.com', 'dhl.de'] },
  { name: 'Poczta Polska', pattern: /poczta\s*polska|pocztex/i, domains: ['poczta-polska.pl', 'pocztex.pl'] },
  { name: 'OLX', pattern: /\bolx\b/i, domains: ['olx.pl'] },
  { name: 'Allegro', pattern: /\ballegro\b/i, domains: ['allegro.pl', 'allegrolokalnie.pl'] },
  { name: 'Vinted', pattern: /\bvinted\b/i, domains: ['vinted.pl', 'vinted.com'] },
  { name: 'PKO BP', pattern: /\bpko\b|\bipko\b/i, domains: ['pkobp.pl', 'ipko.pl'] },
  { name: 'Bank Pekao', pattern: /\bpekao\b/i, domains: ['pekao.com.pl', 'pekao24.pl'] },
  { name: 'mBank', pattern: /\bmbank\b/i, domains: ['mbank.pl'] },
  { name: 'ING', pattern: /\bing\b/i, domains: ['ing.pl', 'ingbank.pl'] },
  { name: 'Santander', pattern: /\bsantander\b/i, domains: ['santander.pl', 'centrum24.pl'] },
  { name: 'Millennium', pattern: /\bmillennium\b/i, domains: ['bankmillennium.pl'] },
  { name: 'ZUS', pattern: /\bzus\b/i, domains: ['zus.pl'] },
  { name: 'gov.pl', pattern: /\bgov\.pl\b|urzad\s*skarbowy|ministerstwo\s*finansow/i, domains: ['gov.pl', 'podatki.gov.pl'] },
];
const shorteners = new Set(['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'rebrand.ly', 'linktr.ee']);
export function normalize(text) {
  return text.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').replaceAll('ł', 'l').replaceAll('Ł', 'L').toLowerCase();
}
const isWithin = (host, domain) => host === domain || host.endsWith('.' + domain);
export function listedDomain(host, list = new Set()) {
  let part = host.toLowerCase().replace(/\.$/, '');
  while (part.includes('.')) { if (list.has(part)) return part; part = part.slice(part.indexOf('.') + 1); }
  return null;
}
export function extractLinks(text) {
  // Never request or navigate to extracted links. Remove common defanging only for local parsing.
  const source = text.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '').replace(/hxxps?:\/\//gi, s => s.toLowerCase().replace('xx', 'tt')).replace(/\[\.\]|\(\.\)/g, '.');
  const matches = source.match(/(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s<>"\u200b-\u200f]+|\b(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]+)(?::\d+)?(?:\/[^\s<>"\u200b-\u200f]*)?/giu) || [];
  return [...new Set(matches.map(raw => raw.replace(/[),;.!?\]}]+$/g, '')))].slice(0, 40).map(raw => {
    try {
      const explicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
      const url = new URL(explicitScheme ? raw : 'https://' + raw);
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      const domain = parse(host, { allowPrivateDomains: true }).domain || host;
      return { raw, host, domain, protocol: url.protocol, userinfo: !!(url.username || url.password), port: url.port, explicitScheme, url };
    } catch { return { raw, invalid: true }; }
  });
}
export function analyze(input, options = {}) {
  const original = input.trim();
  if (!original || original.length > MAX_TEXT) throw new Error(!original ? 'Wklej wiadomość lub link.' : `Tekst może mieć najwyżej ${MAX_TEXT} znaków.`);
  const text = normalize(original);
  const links = extractLinks(original);
  const reasons = [];
  function add(id, title, detail, weight = 1) { if (!reasons.some(r => r.id === id)) reasons.push({ id, title, detail, weight }); }
  const urgent = /piln|natychmiast|ostatni[ae]? (szans|ostrzez)|w ciagu (?:\d+|kilku) (?:min|godzin)|dzisiaj|konto.{0,35}(?:zablok|zawiesz)|odlaczen|komornik/.test(text);
  const payment = /dopl[aą]t|opl[aą]t|zapl[aą][ct]|uregul|przelew|platn|pieniadz|zaliczk|kaucj|blik|card|payment|refund/.test(text);
  const sensitive = /(?:podaj|wyslij|przeslij|wpisz|potwierdz|zweryfikuj|udostepnij|send|provide|enter).{0,90}(?:hasl|password|kod\s*(?:blik|sms|autoryzac)|pin\b|cvv|cvc|dane\s*(?:karty|logowania)|numer\s*karty|skan.{0,20}dowod|pesel)/.test(text);
  const login = /zaloguj|logowan|weryfikac|verify|login|account.{0,30}blocked/.test(text);
  const codeRequest = /(?:podaj|wyslij|przeslij|daj|udostepnij|potrzebuje).{0,55}(?:kod.{0,12}blik|blika)|(?:kod.{0,12}blik).{0,40}(?:wyslij|przeslij|podaj)/.test(text);
  const remote = /(?:zainstaluj|pobierz|install|download).{0,70}(?:anydesk|teamviewer|rustdesk|quicksupport|aplikacj.{0,20}zdaln)/.test(text);
  const safeAccount = /(?:przelej|przenies|przekaz).{0,60}(?:bezpieczn|techniczn|zabezpiecz).{0,25}(?:konto|rachunek)/.test(text);
  const marketplace = /\bolx\b|vinted|allegro|marketplace|kupujac|sprzedajac|przedmiot|ogloszeni/.test(text);
  if (codeRequest) add('blik', 'Prośba o kod BLIK', 'Kod może umożliwić płatność lub wypłatę. Potwierdź prośbę rozmową na znany numer; nie przekazuj kodu w wiadomości.', 5);
  if (sensitive) add('secrets', 'Prośba o poufne dane', 'Treść prosi o hasło, dane karty, dokument lub kod. Nie wpisuj ich w formularzu otwartym z tej wiadomości.', 5);
  if (remote) add('remote', 'Instalacja narzędzia zdalnego dostępu', 'Osoba po drugiej stronie może przejąć ekran i dostęp do kont. Sprawdź sprawę bezpośrednio w swojej instytucji.', 5);
  if (safeAccount) add('safe-account', 'Przelew na „bezpieczne konto”', 'To znany schemat oszustwa na pracownika banku. Zakończ kontakt i samodzielnie zadzwoń do banku.', 5);
  if (urgent) add('pressure', 'Presja na szybkie działanie', 'Wiadomość próbuje skrócić czas na sprawdzenie sprawy. Pilność sama w sobie nie dowodzi oszustwa.');
  if (payment && links.length) add('payment', 'Pieniądze i link w jednej wiadomości', 'Dopłata, zaliczka lub zwrot po przejściu przez link wymaga niezależnego sprawdzenia.', 1);
  if (marketplace && /(?:odbierz|otrzym|odebra|potwierdz).{0,50}(?:pieniadz|platn|przelew)|(?:karta|cvv|cvc).{0,50}(?:otrzym|odbior|odebra)/.test(text)) add('marketplace', '„Odbiór pieniędzy” przez formularz', 'Kupujący nie powinien kierować sprzedającego do obcego formularza z danymi karty. Sprawdź transakcję w aplikacji platformy.', 5);
  if (/gwarantowan.{0,35}(?:zysk|zwrot)|bez ryzyka.{0,35}(?:zysk|inwest)|(?:zysk|zarob).{0,30}\d{2,}\s*%/.test(text)) add('investment', 'Obietnica nadzwyczajnego zysku', 'Gwarancja dużego zarobku albo inwestycja „bez ryzyka” to poważny sygnał ostrzegawczy.', 5);
  if (/mamo|tato|babciu|dziadku/.test(text) && /nowy numer|zepsul.{0,20}telefon|zgubil.{0,20}telefon/.test(text) && payment) add('family', 'Nowy numer i prośba o pieniądze', 'Może to być podszywanie się pod bliską osobę. Zadzwoń na jej dotychczasowy numer, zanim zapłacisz.', 5);
  if (/[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/.test(original)) add('hidden', 'Ukryte znaki w treści', 'Niewidoczne znaki mogą maskować nazwę lub adres. Mogą też wynikać z kopiowania; sprawdź oryginał.', 1);
  if (/javascript\s*:|data\s*:text\/html|powershell|cmd\s*\/c|(?:windows|win)\s*\+\s*r/.test(text)) add('command', 'Kod lub polecenie zamiast zwykłego linku', 'Nie wklejaj poleceń do okna systemowego i nie uruchamiaj kodu przesłanego w wiadomości.', 5);
  const brands = BRANDS.filter(b => b.pattern.test(text));
  for (const link of links) {
    if (link.invalid) { add('malformed', 'Adresu nie udało się odczytać', 'Sprawdź pisownię adresu w oryginalnej wiadomości.'); continue; }
    const flagged = listedDomain(link.host, options.domains);
    if (flagged) add('cert-' + flagged, 'Domena na liście ostrzeżeń CERT Polska', `Adres ${link.host} pasuje do wpisu ${flagged}. Data kopii listy: ${options.listDate || 'nieznana'}. To informacja o tej kopii, nie sprawdzenie strony na żywo.`, 8);
    if (!['https:', 'http:'].includes(link.protocol)) add('protocol', 'Nietypowy rodzaj adresu', `Adres używa ${link.protocol}. Aplikacja nie otwiera go ani nie uruchamia.`, 4);
    if (link.userinfo) add('userinfo', 'Adres maskuje właściwy serwer', `Fragment przed @ nie jest nazwą strony. Właściwy serwer to ${link.host}.`, 5);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(link.host) || link.host.includes(':')) add('ip', 'Link prowadzi do adresu IP', `Serwer ${link.host} nie jest zwykłą domeną firmy. To wymaga dodatkowej weryfikacji.`, 2);
    if (link.protocol === 'http:' && link.explicitScheme) add('http', 'Połączenie bez HTTPS', 'Adres zaczyna się od http://. Nie wpisuj tam haseł ani danych karty.', payment || login ? 3 : 1);
    if (shorteners.has(link.domain)) add('shortener', 'Skrócony lub pośredni link', `Adres ${link.host} może przekierować na inną stronę. Bez otwarcia nie można ustalić celu.`, 2);
    if (link.host.includes('xn--')) add('idn', 'Domena ze znakami narodowymi', `Zapis techniczny: ${link.host}. Znaki mogą wyglądać jak litery innej domeny; sam ten zapis nie dowodzi oszustwa.`, 1);
    for (const brand of brands) {
      if (!brand.domains.some(d => isWithin(link.host, d))) {
        add('brand-' + brand.name, `Nazwa ${brand.name}, ale inna domena`, `Treść wspomina ${brand.name}, a link prowadzi do ${link.host}. Znane domeny tej usługi: ${brand.domains.join(', ')}. Inny adres może należeć do partnera; sprawdź go samodzielnie.`, payment || login ? 4 : 2);
      }
    }
  }
  const score = reasons.reduce((n,r)=>n+r.weight,0);
  const level = reasons.some(r=>r.weight>=5) || score>=5 ? 'high' : reasons.length ? 'caution' : 'unknown';
  const copy = {
    high: { label: 'Wysokie ryzyko', summary: 'Widać poważne sygnały ostrzegawcze. Wstrzymaj płatność i przekazywanie danych.' },
    caution: { label: 'Zachowaj ostrożność', summary: 'Treść wymaga sprawdzenia. Zanim zareagujesz, potwierdź sprawę innym kanałem.' },
    unknown: { label: 'Brak wyraźnych sygnałów', summary: 'Nie znaleźliśmy opisanych schematów. To nie potwierdza bezpieczeństwa ani tożsamości nadawcy.' },
  }[level];
  return { level, ...copy, reasons, links: links.map(({raw,host,domain,invalid})=>({raw,host,domain,invalid})), limited: links.length>=40, context: codeRequest || /mamo|tato|babciu|dziadku/.test(text) ? 'family' : marketplace ? 'marketplace' : /bank|konto|rachunek/.test(text) ? 'bank' : /pacz|kurier|przesylk/.test(text) ? 'parcel' : 'general' };
}
export function shareReport(result) {
  // Deliberately omit the original message, URLs, names, phone numbers and account numbers.
  return `CzyToŚciema?\n${result.label}\n${result.summary}\n\nSygnały: ${result.reasons.length ? result.reasons.map(r=>r.title).join('; ') : 'Nie znaleziono opisanych schematów.'}\n\nMożesz pomóc mi sprawdzić tę wiadomość? Skontaktuj się ze mną znanym wcześniej kanałem.\n\nOcena opiera się na regułach i nie potwierdza nadawcy. Oryginalna wiadomość i linki nie zostały dołączone.`;
}

