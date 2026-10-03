# CzyToŚciema?

Polska aplikacja do sprawdzania podejrzanych SMS-ów, e-maili, ofert, adresów, zrzutów ekranu i kodów QR. Działa lokalnie w przeglądarce, również offline po pierwszym pełnym pobraniu.

## Używanie

1. Wklej wiadomość lub link. Dla obrazu wybierz „Dodaj obraz”, a potem odczyt tekstu albo QR.
2. Sprawdź tekst po odczycie zdjęcia, szczególnie adresy. Wybierz „Sprawdź wiadomość”.
3. Przeczytaj sygnały i następny krok. „Zapytaj bliską osobę” otwiera podgląd raportu, który można udostępnić, skopiować lub pobrać jako TXT.

Treść i obrazy nie są wysyłane na serwer. Raport nie zawiera oryginalnej wiadomości ani jej adresów. Brak sygnałów **nie oznacza bezpieczeństwa**. Reguły nie potwierdzają nadawcy i nie rozpoznają deepfake'ów.

## Platformy

Responsywna aplikacja PWA: Chrome/Edge na Windows, macOS i Androidzie, Safari na iPhone/iPad oraz Firefox. Na iOS instalacja odbywa się przez menu Udostępnij > Do ekranu początkowego. Odczyt OCR działa w Web Workerze z lokalnymi modelami polskim i angielskim. QR jest dekodowany lokalnie przez jsQR, bez zależności od eksperymentalnego BarcodeDetector.

PNG, JPG, WebP i BMP do 15 MB oraz 40 mln pikseli. HEIC wymaga zapisania jako JPG. Pierwsza instalacja pobiera około 36 MB modeli OCR i silnika. Tryb offline jest gotowy dopiero po odpowiednim komunikacie. Urządzenie może później usunąć pamięć przeglądarki; wtedy potrzebne jest ponowne pobranie.

## Uruchomienie kodu

Node.js 24 i pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm test
node scripts/update-threats.mjs
pnpm build
pnpm preview
```

Otwórz http://127.0.0.1:5185/. Budowanie kopiuje OCR i modele z przypiętych paczek npm. Nie wymaga klucza API ani płatnej usługi.

## Testy i publikacja

```sh
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm test:e2e
```

Testy obejmują 38 scenariuszy analizy oraz przepływy na silnikach Chromium, Firefox i WebKit: desktop, telefon, tablet, szerokość 320 px, dużą czcionkę, formularz, prywatność raportu, XSS, nieaktualny wynik, OCR, QR, błędny plik, odświeżenie i OCR offline. Raport JSON oraz zrzuty ekranu są w `test-results/`. Profile urządzeń są emulowane; nie stanowią testu na fizycznym iPhonie lub telefonie z Androidem.

GitHub Actions sprawdza kod i publikuje dopiero po powodzeniu testów. Kopia listy CERT jest pobierana przy wydaniu i co 6 godzin przez harmonogram Actions, którego start może być opóźniony przez GitHub. Aplikacja pokazuje dokładną datę pobrania i ostrzega po 24 godzinach. Lista offline jest kopią zainstalowanej wersji. CERT zaleca odświeżanie co 5 minut w systemach blokujących ruch; aplikacja nie jest filtrem sieciowym ani usługą sprawdzania na żywo.

## Granice i prywatność

- Analiza nie odwiedza podejrzanych adresów, nie rozwija skracaczy i nie pobiera załączników.
- Ocena używa sygnałów z tekstu, budowy domen i datowanej kopii listy ostrzeżeń. Nie jest statystycznym prawdopodobieństwem i nie ma deklarowanej skuteczności procentowej.
- Nie przechowuje historii ani treści. `localStorage` zawiera wyłącznie preferencję dużej czcionki. Cache zawiera tylko publiczne pliki aplikacji i listę CERT.
- Hosting GitHub Pages otrzymuje standardowe żądania zasobów, w tym adres IP i metadane przeglądarki. Nie stosujemy dodatkowych trackerów.
- Udostępnianie raportu jest wyłącznie działaniem użytkownika. Aplikacja nie kontaktuje się samodzielnie z rodziną, bankiem, Policją ani CERT.
- Każdy tekst, także polecenia i HTML w wiadomości lub QR, pozostaje danymi; interfejs używa `textContent`.

Źródła: [CERT: lista i formaty](https://cert.pl/lista-ostrzezen/), [prośby o szybki przelew](https://cert.pl/szybkie-przelewy/), [niebezpieczne płatności](https://cert.pl/baza-wiedzy/niebezpieczne-platnosci/), [dokumentacja Tesseract.js](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
