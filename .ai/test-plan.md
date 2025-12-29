<plan_testów>

## 1. Wprowadzenie i cele testowania

10x-cards to aplikacja webowa dla specjalistów IT, która umożliwia szybkie tworzenie i przeglądanie wysokiej jakości fiszek (flashcards) z wykorzystaniem AI, z pełnym wsparciem metadanych i powtórek w oparciu o algorytmy typu SuperMemo. Aplikacja opiera się na Astro 5 (SSR + wyspy React), React 19, TypeScript 5, Tailwind 4, Shadcn/ui oraz Supabase (PostgreSQL, auth, funkcje i API) i integruje się z modelami AI przez Openrouter.

Główne **cele testowania**:

- **Zapewnienie poprawności funkcjonalnej**:
  - weryfikacja głównych przepływów użytkownika: rejestracja/logowanie, generowanie kandydatów kart przez AI, akceptacja/edycja kandydatów, zarządzanie fiszkami, sesje powtórkowe, widoki administracyjne.
- **Zapewnienie spójności danych i logiki powtórek**:
  - poprawne przejście danych między warstwami (AI → kandydaci → fiszki → sesje powtórkowe),
  - prawidłowe wyliczanie parametrów powtórek na bazie biblioteki `supermemo`.
- **Zapewnienie jakości niefunkcjonalnej**:
  - wydajność kluczowych widoków (generator, lista fiszek, sesje powtórkowe),
  - dostępność (WCAG), responsywność UI (Tailwind + shadcn/ui),
  - bezpieczeństwo (autentykacja Supabase, role, autoryzacja, brak wycieków danych, odporność na XSS).
- **Zapewnienie niezawodności integracji z zewnętrznymi usługami**:
  - poprawne działanie `openrouter-service` w warunkach poprawnych, błędnych i granicznych odpowiedzi,
  - odporność na błędy sieci i ograniczenia kosztowe (limity, time-outy).

## 2. Zakres testów

### 2.1 Zakres funkcjonalny (w obrębie repozytorium)

- **Warstwa UI (Astro + React)**:
  - strony: `index.astro`, `generator.astro`, `candidates.astro`, `flashcards.astro`, `reviews.astro`,
  - strony auth: `src/pages/auth/*.astro` oraz komponenty `src/components/auth/*`,
  - layout i nawigacja: `Layout.astro`, `AppSidebar.tsx`, `SidebarMenuItemComponent.tsx`,
  - moduły funkcyjne:
    - generator AI: `src/components/generator/*`, `src/hooks/useGeneration.ts`, `src/lib/services/generations.service.ts`,
    - kandydaci: `src/components/candidates/*`, `src/hooks/useCandidates.ts`, serwisy i endpointy kandydatów,
    - fiszki: `src/components/flashcards/*`, `src/hooks/useFlashcards.ts`,
    - sesje powtórek: `src/components/reviews/*`, `src/hooks/useReviewSession.ts`, `src/hooks/useReviewKeyboardShortcuts.ts`,
    - admin: `src/components/admin/*`, `src/hooks/useAdminKpiDashboard.ts`, odpowiednie endpointy `src/pages/admin/*.astro` i `/api`.

- **Warstwa API (Astro endpoints)**:
  - wszystkie pliki w `src/pages/api/*.ts` (CRUD dla kategorii, tagów, źródeł, fiszek, sesji powtórek, kandydatów, ról użytkowników, KPI, logów błędów generacji itp.),
  - middleware autentykacji i kontekstu użytkownika: `src/middleware/index.ts`, `src/lib/auth/server.ts`.

- **Warstwa domenowa i pomocnicza**:
  - serwisy: `src/lib/services/*.ts` (biznesowa logika pracy na danych),
  - walidacje Zod: `src/lib/validation/*.ts`,
  - typy współdzielone: `src/types.ts`, `src/db/database.types.ts`,
  - utils i wyszukiwanie: `src/lib/utils.ts`, `src/lib/utils/search.ts`, `src/lib/utils/base64.ts`.

- **Integracja z backendem i bazą**:
  - klient Supabase: `src/db/supabase.client.ts`, `@supabase/supabase-js`, `@supabase/ssr`,
  - funkcje SQL i migracje w `supabase/migrations/*.sql` (soft delete/restore fiszek, logowanie błędów generacji, funkcja akceptacji kandydata),
  - konfiguracja Supabase w `supabase/config.toml`.

- **Integracja AI**:
  - `src/lib/openrouter-service.ts` – budowa promptów, obsługa błędów, mapping odpowiedzi na format kart/kandydatów.

### 2.2 Zakres poza testami

- Wewnętrzna implementacja zewnętrznych bibliotek (Astro, React, Supabase, Openrouter, shadcn/ui, Tailwind) – testujemy integrację, nie biblioteki.
- Pełne testy obciążeniowe na poziomie infrastruktury produkcyjnej (ograniczymy się do testów wydajnościowych na środowisku zbliżonym do produkcji i profili Lighthouse/Playwright).

## 3. Typy testów do przeprowadzenia

### 3.1 Testy statyczne

- **Analiza statyczna kodu**:
  - ESLint (konfiguracja w `eslint.config.js`, integracja z `lint-staged`),
  - weryfikacja typów TypeScript (kompilacja `tsc`).
- **Review kodu**:
  - obowiązkowy Code Review dla zmian dotykających warstwy domenowej (`src/lib/services/*`, `src/lib/validation/*`, `src/types.ts`) i integracji z AI/Supabase.

### 3.2 Testy jednostkowe

- **Zakres priorytetowy testów jednostkowych**:
  - walidacje Zod (`src/lib/validation/*.ts`) – poprawne mapowanie payloadów żądań/odpowiedzi,
  - serwisy domenowe (`src/lib/services/*.ts`) – logika tworzenia, aktualizacji, miękkiego usuwania i przywracania fiszek, obsługa kandydatów, źródeł, tagów, sesji powtórek, logowania błędów,
  - utils (`src/lib/utils.ts`, `search.ts`, `base64.ts`) – deterministyczne funkcje pomocnicze,
  - logika AI w `openrouter-service.ts` (budowa promptów, mapowanie odpowiedzi) – z użyciem mocków Openrouter,
  - logika obliczania powtórek (integracja z `supermemo`) – sprawdzenie, czy parametry są przekazywane i przeliczane poprawnie dla różnych ocen odpowiedzi.

- **Rekomendowane narzędzia**:
  - runner: **Vitest** (natywna integracja z Vite/Astro, wsparcie dla TypeScript/ESM),
  - biblioteka asercji wbudowana w Vitest,
  - `@testing-library/jest-dom` dla asercji DOM w testach komponentów,
  - `vitest-preview` dla debugowania testów w przeglądarce,
  - `@testing-library/user-event` dla realistycznych symulacji interakcji użytkownika.

### 3.3 Testy integracyjne

- **Integracja API ↔ serwisy ↔ Supabase**:
  - testy dla `src/pages/api/*.ts` uruchamiane w środowisku testowym z lokalną instancją bazy lub mockiem Supabase,
  - weryfikacja kodów HTTP, struktury odpowiedzi, mapowania błędów (w tym błędów walidacji) oraz poprawności operacji na danych (np. soft delete/restore).

- **Integracja UI (React) ↔ hooks ↔ API**:
  - testy komponentów stron:
    - `GeneratorPage`, `CandidatesPage`, `FlashcardsPage`, `ReviewsPage`, widoki admin (`KpiDashboardPage`, ekrany kategorii, źródeł, logów błędów),
  - testy hooków:
    - `useGeneration`, `useGenerationsList`, `useCandidates`, `useFlashcards`, `useTagsCatalog`, `useReviewSession`, `useReviewKeyboardShortcuts`, `useAdminKpiDashboard`, `useIsAdmin`, `useUrlQueryState`, `useCurrentUser`,
  - z wykorzystaniem React Testing Library + `@testing-library/user-event` dla interakcji + MSW (Mock Service Worker) do stubowania odpowiedzi API.

### 3.4 Testy end-to-end (E2E)

- **Zakres kluczowy**:
  - pełne przepływy od strony UI do bazy danych:
    - rejestracja → logowanie → przejście do generatora,
    - generator AI → utworzenie kandydatów → decyzja na stronie `Candidates` → utworzenie fiszek → sesja powtórkowa na `Reviews`,
    - ręczne tworzenie/edycja fiszek (jeśli wspierane),
    - zarządzanie kategoriami, tagami, źródłami i KPI przez admina,
    - obsługa błędów AI (np. brak odpowiedzi, niepoprawny format).

- **Rekomendowane narzędzie**:
  - **Playwright** – testy na poziomie przeglądarki, scenariusze smoke i regresyjne,
  - opcjonalnie `@playwright/experimental-ct-react` dla testowania komponentów React w prawdziwej przeglądarce (alternatywa dla JSDOM w przypadku skomplikowanych interakcji).

### 3.5 Testy niefunkcjonalne

- **Wydajność**:
  - pomiar czasu ładowania i interakcji kluczowych widoków (Dashboard, Generator, Flashcards, Reviews) z wykorzystaniem Lighthouse i Playwright trace,
  - testy wydajności list (Flashcards, Candidates, admin listy) przy dużej liczbie rekordów.

- **Dostępność (a11y)**:
  - automatyczne skany (`@axe-core/playwright`) zintegrowane z testami E2E dla głównych stron,
  - manualna weryfikacja nawigacji klawiaturą, focus management, etykiety ARIA w komponentach shadcn/ui.

- **Bezpieczeństwo**:
  - weryfikacja poprawnego wykorzystania Supabase Auth (dostęp do stron tylko dla zalogowanych, admin-only dla `admin/*`),
  - testy XSS (szczególnie treści fiszek, gdzie używany jest `sanitize-html`),
  - testy uprawnień (role user/admin, brak możliwości eskalacji uprawnień przez API).

## 4. Scenariusze testowe dla kluczowych funkcjonalności

### 4.1 Autentykacja i autoryzacja (Supabase Auth, middleware)

- **Rejestracja i logowanie**:
  - poprawna rejestracja nowego użytkownika (happy path),
  - walidacja błędnych danych (zbyt krótkie hasło, istniejący email, niepoprawny format),
  - logowanie poprawne i błędne (zły email/hasło, nieaktywne konto jeśli dotyczy).
- **Zarządzanie hasłem**:
  - reset hasła (wysłanie maila, ustawienie nowego hasła),
  - zmiana hasła z poziomu zalogowanego użytkownika (`UpdatePasswordForm`).
- **Sesja i dostęp do stron**:
  - niezalogowany użytkownik ma dostęp tylko do stron publicznych (np. landing, auth),
  - próba wejścia na `/generator`, `/candidates`, `/flashcards`, `/reviews` bez zalogowania – przekierowanie na login,
  - poprawne wylogowanie i wyczyszczenie sesji.
- **Role i admin-only**:
  - użytkownik z rolą admin widzi i może wejść na `/admin/*`,
  - użytkownik bez roli admin nie widzi pozycji adminowych w sidebarze (`AppSidebar`) i nie może otworzyć `/admin/*` bezpośrednio (sprawdzenie także po stronie API).

### 4.2 Generator AI (`/generator`)

- **Happy path**:
  - wprowadzenie poprawnego tekstu wejściowego (różne długości, różne języki),
  - wybór modelu, temperatury (`ModelSelector`, `TemperatureSlider`),
  - wysłanie zapytania – stan ładowania, zablokowanie przycisku, brak możliwości wielokrotnego wysłania,
  - poprawne otrzymanie listy kandydatów kart i zapis do backendu (zależnie od architektury),
  - przekierowanie/dojście do strony `Candidates`.

- **Walidacja danych wejściowych**:
  - brak tekstu, zbyt krótki tekst, przekroczenie maksymalnego rozmiaru,
  - nieprawidłowa konfiguracja parametrów (np. poza zakresem temperatury).

- **Błędy integracji z Openrouter**:
  - błąd sieci (timeout),
  - błąd autoryzacji (niepoprawny klucz),
  - odpowiedź w nieoczekiwanym formacie (np. parsowanie JSON),
  - testy zachowania UI (komunikat błędu, możliwość ponowienia, logowanie błędu przez `error-logs.service.ts`).

### 4.3 Kandydaci (`/candidates`)

- **Lista kandydatów**:
  - poprawne wyświetlenie kandydatów wygenerowanych z AI (różne ilości, stronicowanie/ładowanie),
  - stany pustej listy (brak kandydatów).

- **Edycja kandydata**:
  - możliwość edycji treści karty przed akceptacją (np. zmiana pytania, odpowiedzi, tagów, kategorii),
  - walidacja pól podczas edycji.

- **Akceptacja/odrzucanie**:
  - akceptacja pojedynczego kandydata → utworzenie fiszki w bazie,
  - akceptacja wielu kandydatów (jeśli obsługiwane),
  - odrzucenie kandydata (soft delete lub usunięcie),
  - ponowna próba akceptacji już zaakceptowanego/odrzuconego kandydata powinna być poprawnie obsłużona (brak duplikatów, właściwy komunikat błędu).

- **Spójność z modułem fiszek**:
  - po akceptacji kandydatów, odpowiednie fiszki są widoczne na stronie `Flashcards` z prawidłowymi metadanymi (kategoria, tagi, źródło).

### 4.4 Fiszki (`/flashcards`)

- **Wyświetlanie listy fiszek**:
  - ładowanie fiszek z backendu (różne ilości, duże listy),
  - stan pustej listy (brak fiszek).

- **Filtrowanie i sortowanie**:
  - filtrowanie po kategoriach, tagach, źródłach, statusie (aktywne/usunięte),
  - wyszukiwanie tekstowe (`SearchInput`, `search.ts`),
  - sortowanie (np. po dacie utworzenia, źródle) – weryfikacja poprawnej kolejności,
  - zachowanie filtrów w URL (`useUrlQueryState`) i poprawne odtwarzanie stanu po odświeżeniu strony.

- **Tworzenie i edycja fiszek**:
  - (jeśli istnieje odpowiedni modal `FlashcardFormModal`) – poprawna walidacja, zapis, obsługa błędów,
  - edycja treści, tagów, kategorii, źródła – zmiany widoczne natychmiast na liście.

- **Usuwanie i przywracanie (soft delete)**:
  - usuwanie fiszki wywołuje funkcję soft delete w bazie (migracja `soft_delete_flashcard_function.sql`),
  - fiszka znika z widoku domyślnego, może być widoczna w filtrze „usunięte” (jeśli dostępny),
  - przywrócenie fiszki (`restore_flashcard_function.sql`) – powrót do aktywnego widoku bez utraty historii.

### 4.5 Sesje powtórkowe (`/reviews`)

- **Rozpoczęcie sesji**:
  - pobranie fiszek do powtórki na podstawie algorytmu planowania (SuperMemo + logika w serwisach),
  - stan pustej kolejki – odpowiedni komunikat, brak błędów.

- **Przebieg sesji**:
  - wyświetlanie kart w przewidzianej kolejności,
  - rejestracja odpowiedzi użytkownika (Again/Hard/Good/Easy lub podobne),
  - aktualizacja harmonogramu powtórek i zapis do bazy (weryfikacja zgodności z oczekiwaniami SuperMemo),
  - aktualizacja paska postępu (`ProgressBar`), liczników i statystyk (`StatsSnippet`).

- **Skróty klawiaturowe**:
  - działanie shortcutów z `useReviewKeyboardShortcuts` (nawigacja, wybór odpowiedzi),
  - brak konfliktów z natywnymi skrótami przeglądarki.

- **Zakończenie sesji**:
  - poprawne zakończenie po przejściu wszystkich fiszek,
  - poprawne zapisanie wyników w bazie,
  - możliwość powrotu do listy fiszek lub rozpoczęcia nowej sesji.

### 4.6 Widoki administracyjne (`/admin/*`)

- **KPI dashboard**:
  - poprawne pobieranie danych KPI z `admin-kpi.service.ts` i prezentacja w `KpiDashboardPage`,
  - poprawność agregacji (np. liczba fiszek, liczba użytkowników, ilość wygenerowanych kandydatów, błędy generacji).

- **Kategorie, tagi, źródła**:
  - CRUD kategorii z użyciem `categories.service.ts` i odpowiednich endpointów,
  - powiązania z fiszkami (kategorie używane w filtrach i formularzach),
  - walidacja unikalności nazw/slugów.

- **Błędy generacji**:
  - zapis błędów generacji (migracja `add_log_generation_error_function.sql`, serwis `error-logs.service.ts`),
  - wyświetlanie logów błędów w widoku admina (sortowanie, filtrowanie, szczegóły),
  - scenariusze z wieloma błędami i stronami wyników.

### 4.7 API i migracje

- **API**:
  - dla każdego endpointu w `src/pages/api/*.ts`: testy happy path, błędnych danych (niezgodnych z Zod schema), błędów autoryzacji, błędów bazodanowych,
  - weryfikacja, że API nie zwraca nadmiarowych danych (np. wrażliwych pól) oraz obsługuje paginację/filtry zgodnie z kontraktem.

- **Migracje**:
  - uruchomienie wszystkich migracji na czystej bazie – brak błędów,
  - test migracji funkcji soft delete/restore i logowania błędów generacji – wywołanie bezpośrednio z SQL oraz przez API,
  - weryfikacja spójności schematu z typami TypeScript (`database.types.ts`).

## 5. Środowisko testowe

- **Środowiska**:
  - lokalne środowisko deweloperskie (Astro dev + Supabase CLI `supabase start` w Docker),
  - dedykowane środowisko testowe (stage) z osobną bazą danych i konfiguracją Supabase,
  - ewentualne środowisko pre-prod (mirror produkcji) dla testów wydajnościowych i E2E smoke tuż przed releasem.

- **Konfiguracja Supabase**:
  - osobne projekty/instancje dla `dev`, `test`, `prod`,
  - osobne klucze API (anon/service) i role,
  - automatyczne uruchamianie migracji na środowisku testowym przed testami integracyjnymi/E2E.

- **Konfiguracja AI (Openrouter)**:
  - na środowisku testowym preferowane stuby/mocking Openrouter (np. flagą środowiskową przełączamy `openrouter-service` w tryb mock),
  - osobny klucz testowy z niskimi limitami finansowymi i logicznym ograniczeniem liczby żądań w testach.

- **Przeglądarki i urządzenia**:
  - docelowo: Chromium (Playwright default), Chrome, Firefox, Safari (przynajmniej smoke),
  - rozdzielczości: desktop (≥1280px), tablet (~768px), mobile (~375–414px) ze względu na layouty responsywne oparte na Tailwind.

## 6. Narzędzia do testowania

### 6.1 Stack technologiczny testów

```json
{
  "devDependencies": {
    // Testy jednostkowe i integracyjne
    "vitest": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "vitest-preview": "^0.0.1",

    // Testowanie komponentów React
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",

    // Mockowanie API
    "msw": "^2.0.0",

    // E2E i Component Testing
    "@playwright/test": "^1.40.0",
    "@playwright/experimental-ct-react": "^1.40.0",

    // Dostępność
    "@axe-core/playwright": "^4.8.0",

    // Statyczna analiza i formatowanie
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "prettier-plugin-astro": "^0.13.0",
    "@typescript-eslint/parser": "^7.0.0"
  }
}
```

### 6.2 Opis narzędzi i zastosowanie

- **Testy jednostkowe i integracyjne**:
  - **Vitest** – runner testów zoptymalizowany dla Vite/Astro, natywne wsparcie dla TypeScript/ESM
  - **@vitest/ui** – interfejs webowy do przeglądania wyników testów
  - **vitest-preview** – debugowanie testów jednostkowych w przeglądarce
  - **React Testing Library** – testowanie komponentów React zgodnie z best practices (testowanie zachowania, nie implementacji)
  - **@testing-library/user-event** – realistyczne symulacje interakcji użytkownika (lepsze niż `fireEvent`)
  - **@testing-library/jest-dom** – niestandardowe matchery DOM dla lepszych asercji
  - **MSW (Mock Service Worker)** – mockowanie HTTP dla API i Supabase w testach i developmencie

- **Testy E2E i komponentów**:
  - **Playwright**:
    - scenariusze smoke (krótki przebieg głównych ścieżek) uruchamiane na każdym PR,
    - scenariusze regresyjne (pełny przepływ AI → kandydaci → fiszki → sesje) uruchamiane przed releasem,
    - trace viewer dla debugowania testów,
    - równoległa egzekucja na wielu przeglądarkach (Chromium, Firefox, WebKit).
  - **@playwright/experimental-ct-react** (opcjonalnie):
    - testowanie komponentów React w prawdziwej przeglądarce,
    - alternatywa dla JSDOM w przypadku skomplikowanych interakcji lub problemów z renderowaniem.

- **Analiza statyczna i formatowanie**:
  - **ESLint** (już skonfigurowany w `eslint.config.js`) – linting kodu
  - **Prettier + prettier-plugin-astro** – automatyczne formatowanie kodu
  - **TypeScript Compiler** (`tsc --noEmit`) – weryfikacja typów

- **Dostępność i wydajność**:
  - **@axe-core/playwright** – automatyczne testy dostępności zintegrowane z testami E2E,
  - **Lighthouse** – audyty wydajności, dostępności, SEO i best practices,
  - **Playwright traces** – analiza wydajności i debugowanie interakcji.

- **Środowisko testowe dla Supabase**:
  - **Supabase CLI** (`supabase start`) – lokalny projekt Supabase w Docker,
  - automatyczne uruchamianie migracji przed testami,
  - dedykowane środowiska: `dev`, `test`, `prod` z osobnymi kluczami API.

- **CI/CD**:
  - **GitHub Actions**:
    - pipeline: lint → type-check → testy jednostkowe/integracyjne → testy E2E smoke → build,
    - równoległa egzekucja testów dla szybszego feedbacku,
    - cache dla `node_modules` i build artifacts,
    - badge statusu buildów/testów w README.

## 7. Harmonogram testów

- **Faza 1 – Fundament (T0–T1)**:
  - konfiguracja runnera testów jednostkowych/integracyjnych,
  - pokrycie testami walidacji (`validation/*.ts`), utilsów i serwisów domenowych,
  - włączenie testów do pipeline CI.

- **Faza 2 – Integracja warstw (T1–T2)**:
  - testy integracyjne API ↔ serwisy ↔ Supabase (lokalna/testowa baza),
  - testy komponentów stron i kluczowych hooków z użyciem MSW.

- **Faza 3 – E2E i scenariusze biznesowe (T2–T3)**:
  - implementacja scenariuszy E2E dla przepływów: auth, generator, kandydaci, fiszki, sesje, admin,
  - stabilizacja testów E2E (usuwanie flaky tests).

- **Faza 4 – Niefunkcjonalne i hardening (T3–T4)**:
  - testy wydajnościowe i dostępności,
  - audyt bezpieczeństwa (uprawnienia, XSS),
  - przygotowanie zestawu testów regresyjnych na każdy release.

## 8. Kryteria akceptacji testów

- **Funkcjonalne**:
  - wszystkie scenariusze P0 (krytyczne) i P1 (wysokie) zakończone statusem „pass”,
  - brak otwartych błędów o priorytecie krytycznym i wysokim przed releasem.

- **Pokrycie testami**:
  - ≥90% pokrycia linii/kodu dla modułów walidacji i serwisów domenowych,
  - ≥80% pokrycia kluczowych hooków i komponentów stron,
  - zestaw E2E smoke obejmujący co najmniej: auth, generator, kandydaci, fiszki, sesje, jeden widok admin.

- **Jakość niefunkcjonalna**:
  - brak błędów krytycznych a11y na stronach głównych (@axe-core/playwright, Lighthouse),
  - czas TTFB i FCP kluczowych stron w akceptowalnym zakresie (wymagania zdefiniowane wspólnie z biznesem),
  - brak wykrytych luk bezpieczeństwa w zakresie ról, uprawnień i XSS dla treści fiszek.

## 9. Role i odpowiedzialności

- **QA / Inżynier testów**:
  - definiowanie i utrzymanie planu testów,
  - projektowanie scenariuszy testowych, automatyzacja testów E2E i częściowo integracyjnych,
  - raportowanie i weryfikacja poprawek błędów.

- **Frontend developer**:
  - implementacja testów jednostkowych i integracyjnych dla komponentów, hooków i logiki frontowej,
  - dbałość o zgodność z wytycznymi a11y i responsywność UI.

- **Backend / Fullstack developer**:
  - implementacja testów jednostkowych i integracyjnych dla serwisów i endpointów API,
  - nadzór nad migracjami Supabase, spójnością typów oraz integracją z Openrouter.

- **DevOps / Platform engineer**:
  - konfiguracja środowisk testowych, CI/CD, monitoringu,
  - utrzymanie tajemnic (klucze Supabase, Openrouter) i polityk dostępu.

- **Product Owner / Analityk biznesowy**:
  - priorytetyzacja scenariuszy biznesowych,
  - akceptacja kryteriów wejścia/wyjścia dla releasów.

## 10. Procedury raportowania błędów

- **Rejestrowanie błędów**:
  - centralny system (np. GitHub Issues/Jira) z szablonem obejmującym:
    - tytuł, opis,
    - kroki do odtworzenia,
    - oczekiwany vs aktualny rezultat,
    - środowisko (dev/test/prod), wersja, przeglądarka/urządzenie,
    - załączniki (zrzuty ekranu, logi, trace z Playwright).

- **Klasyfikacja**:
  - **Priorytet** (P0–P3) na podstawie wpływu na użytkownika i biznes,
  - **Typ** (funkcjonalny, wydajnościowy, a11y, bezpieczeństwo, UI/UX).

- **Cykl życia błędu**:
  - statusy: New → Triaged → In Progress → Ready for QA → Verified → Closed / Reopened,
  - każdy błąd powiązany z konkretnym PR/commitem oraz, jeśli możliwe, z testem automatycznym.

- **Raportowanie zbiorcze**:
  - cykliczne raporty (np. tygodniowe) z:
    - liczbą nowych/zamkniętych błędów,
    - podziałem po priorytetach i obszarach (auth, generator, kandydaci, fiszki, reviews, admin),
    - trendami jakości (defect density, flakiness testów).

- **Definicja „gotowości do releasu”**:
  - spełnione kryteria z sekcji 8,
  - brak otwartych P0/P1,
  - zielony pipeline CI (lint, testy jednostkowe/integracyjne, E2E smoke, build).
    </plan_testów>
