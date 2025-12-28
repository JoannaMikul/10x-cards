# Architektura UI dla 10x-cards

## 1. Przegląd struktury UI

- **Stack i paradygmaty renderowania**
  - Astro 5 + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui.
  - CSR dla list i interakcji (generator, kandydaci, fiszki, powtórki, KPI).
  - SSR dla słowników (`/api/categories`, `/api/tags`, `/api/sources`) – hydratacja do `DictionariesContext` na starcie.
  - Brak route‑driven modali – modale sterowane lokalnym stanem/Context.

- **Layout i nawigacja**
  - `Layout.astro` z persistent topbarem (logo, nawigacja do: `/generator`, `/candidates`, `/flashcards`, `/reviews`, `/admin/kpi`, user menu).
  - W `/flashcards` na `md+` lewy sidebar z filtrami; na `sm` filtry w off‑canvas/modalu.
  - Widoki publiczne: `/login`, `/register`, `/(403|404)`.

- **Zarządzanie stanem i komunikacja**
  - Konteksty: `AuthContext` (sesja, `isAdmin` z SSR), `DictionariesContext` (TTL i memo), `FlashcardsFiltersContext`, `ToastsContext`, `ModalContext`.
  - `fetch` util: deduplikacja in‑flight, `AbortController`, adapter envelope błędów `{ error: { code, message } }`.
  - Paginacja kursorowa: URL z `cursor`, przy zmianie filtrów reset kursora; „Załaduj więcej” dokleja stronę.

- **Dostępność (A11y)**
  - Ikony z widocznym tekstem na `md+`, na `sm` `aria-label` + `sr-only`.
  - Focus ring, czytelna kolejność TAB, skip-link do głównej treści.
  - Komunikaty statusu w `aria-live="polite"`.
  - Modale: trap focus, `aria-modal`, przywracanie fokusa po zamknięciu.

- **Bezpieczeństwo**
  - Supabase Auth (JWT) + RLS; `isAdmin` z SSR (middleware) przekazywane do `AuthContext`.
  - `/admin/*` ukryte w nawigacji dla non‑admin; bezpośredni dostęp → widok 403.
  - Sanitacja danych wejściowych (generator, formularze), limity długości na froncie i backendzie.
  - Spójne mapowanie kodów błędów: 401→redirect do `/login` (z `returnTo`), 403→ekran 403, 409/422/429→bannery/inline, 5xx→toast.

- **Wydajność i UX**
  - Skeleton przy pierwszym ładowaniu, spinner przy dociąganiu, empty‑state z CTA.
  - Deduplikacja zapytań, anulowanie zbędnych żądań przy zmianie filtrów.

- **Mapowanie historyjek z PRD**
  - US‑000/001 (auth i dostęp): `/login`, `/register`, redirecty; RLS.
  - US‑002/003 (generator): `/generator`, kolejka jednego żądania, limit 5/h, anulowanie.
  - US‑004 (recenzja AI): `/candidates`, akceptacja/odrzucenie/edycja z walidacją.
  - US‑005/006/007 (CRUD fiszek): `/flashcards` z modalami create/edit, soft delete/restore.
  - US‑008 (lista fiszek): `/flashcards` z filtrami, wyszukiwaniem, paginacją.
  - US‑009 (powtórki): `/reviews`, zapis wyników i podgląd statystyk.
  - US‑010 (KPI): `/admin/kpi`, tylko admin.
  - US‑011 (zarządzanie kategoriami): `/admin/categories`, tylko admin.
  - US‑012 (zarządzanie administratorami): `/admin/admins`, tylko admin.
  - US‑013 (diagnostyka błędów): `/admin/generation-errors`, tylko admin.

## 2. Lista widoków

- **Nazwa widoku**: Logowanie
  - **Ścieżka widoku**: `/login`
  - **Główny cel**: Uwierzytelnienie użytkownika i ustawienie sesji z `returnTo`.
  - **Kluczowe informacje do wyświetlenia**: Pola e‑mail/hasło, błędy logowania, link do rejestracji.
  - **Kluczowe komponenty widoku**: `AuthForm`, `FormError`, `Button`, `Toasts`, linkowanie do `/register`.
  - **UX, dostępność i względy bezpieczeństwa**: 401 z API → redirect tutaj; komunikaty bez ujawniania szczegółów błędów; focus na pierwszym polu; `aria-live` dla wyników.
  - Obsługuje: US‑000, US‑001
  - Powiązane endpointy API: Supabase Auth (SDK w przeglądarce); RLS po stronie DB.

- **Nazwa widoku**: Rejestracja
  - **Ścieżka widoku**: `/register`
  - **Główny cel**: Utworzenie konta i automatyczne zalogowanie.
  - **Kluczowe informacje do wyświetlenia**: Pola e‑mail/hasło, zasady haseł, link do logowania.
  - **Kluczowe komponenty widoku**: `AuthForm`, `FormError`, `Toasts`.
  - **UX, dostępność i względy bezpieczeństwa**: Walidacja po stronie klienta; nienaruszanie prywatności błędów; focus management, `aria-live`.
  - Obsługuje: US‑000
  - Powiązane endpointy API: Supabase Auth (SDK).

- **Nazwa widoku**: Generator AI
  - **Ścieżka widoku**: `/generator`
  - **Główny cel**: Start i monitorowanie zadania generowania z limitem i anulowaniem.
  - **Kluczowe informacje do wyświetlenia**: Pole tekstowe 1000–10 000 znaków (licznik), wybór modelu/temperatury, status joba, komunikaty 409/429/500, CTA do `/candidates`.
  - **Kluczowe komponenty widoku**: `GeneratorForm` (textarea + liczniki), `Button` (Start/Cancel), `GenerationStatusPanel` (postęp/status), `Toasts`, `FormError`.
  - **UX, dostępność i względy bezpieczeństwa**: Debounce licznika znaków; sanitacja przed wysyłką; `aria-live` dla statusu; blokada wielokrotnego submitu; obsługa `cancel`.
  - Obsługuje: US‑002, US‑003
  - Powiązane endpointy API: `POST /api/generations`, `GET /api/generations/:id` (polling), `PATCH /api/generations/:id` (cancel).

- **Nazwa widoku**: Kandydaci (z AI)
  - **Ścieżka widoku**: `/candidates`
  - **Główny cel**: Przegląd, edycja i decyzje względem propozycji fiszek.
  - **Kluczowe informacje do wyświetlenia**: Lista kandydatów (front/back, metadane sugerowane), status kandydata, walidacje 200/500 znaków.
  - **Kluczowe komponenty widoku**: `CandidateList`, `CandidateItem`, `CandidateEditor` (tryb „explicit save”), `AcceptRejectBar`, `Toasts`, `FormError`.
  - **UX, dostępność i względy bezpieczeństwa**: Edycja inline z wyraźnym zapisem; skróty klawiaturowe dla Accept/Reject; informacje o konfliktach/fingerprint; `aria-live`.
  - Obsługuje: US‑004
  - Powiązane endpointy API: `GET /api/generation-candidates`, `PATCH /api/generation-candidates/:id`, `POST /api/generation-candidates/:id/accept`, `POST /api/generation-candidates/:id/reject`.

- **Nazwa widoku**: Fiszki (lista i zarządzanie)
  - **Ścieżka widoku**: `/flashcards`
  - **Główny cel**: Przegląd, filtrowanie, wyszukiwanie, sortowanie i CRUD fiszek (soft delete).
  - **Kluczowe informacje do wyświetlenia**: Front/back (skróty), tagi, kategoria, źródło, pochodzenie (origin), daty, `next_review_at`, wskaźniki statusu, sumaryczne agregaty (opcjonalnie).
  - **Kluczowe komponenty widoku**: `FiltersSidebar` (md+), `FiltersDrawer` (sm), `SearchInput` (debounce), `SortDropdown`, `FlashcardList`, `FlashcardItem`, `LoadMoreButton`, `FlashcardFormModal` (create/edit), `ConfirmDialog` (delete/restore), `Toasts`, `FormError`.
  - **UX, dostępność i względy bezpieczeństwa**: Reset kursora przy zmianie filtrów; off‑canvas filtry na mobile; soft delete z potwierdzeniem; walidacje limitów; ochrona przed duplikatami; `aria-live` dla wyników.
  - Obsługuje: US‑005, US‑006, US‑007, US‑008, (start sesji powtórek – US‑009)
  - Powiązane endpointy API: `GET /api/flashcards`, `POST /api/flashcards`, `GET /api/flashcards/:id`, `PATCH /api/flashcards/:id`, `DELETE /api/flashcards/:id`, `POST /api/flashcards/:id/restore`.

- **Nazwa widoku**: Powtórki
  - **Ścieżka widoku**: `/reviews`
  - **Główny cel**: Minimalny player powtórek z obsługą wyników i statystyk.
  - **Kluczowe informacje do wyświetlenia**: Bieżąca fiszka, postęp sesji, skróty klawiszowe, wyniki (good/hard/again…).
  - **Kluczowe komponenty widoku**: `ReviewPlayer`, `OutcomeButtons`, `KeyboardShortcuts`, `ProgressBar`, `StatsSnippet`, `Toasts`.
  - **UX, dostępność i względy bezpieczeństwa**: Duże cele dotykowe; focus klawiaturowy; brak utraty fokusa; komunikaty postępu w `aria-live`; walidacja wejść do API.
  - Obsługuje: US‑009
  - Powiązane endpointy API: `POST /api/review-sessions`, `GET /api/review-stats`.

- **Nazwa widoku**: Dashboard KPI (admin)
  - **Ścieżka widoku**: `/admin/kpi`
  - **Główny cel**: Podgląd kluczowych metryk (AI acceptance rate, AI/manual ratio, wolumen generacji).
  - **Kluczowe informacje do wyświetlenia**: Wskaźniki, trendy, sumaryczne liczby; filtry zakresu czasu; przycisk „Odśwież”.
  - **Kluczowe komponenty widoku**: `KpiCards`, `KpiTrendChart`, `RangePicker`, `RefreshButton`, `EmptyState`, `Toasts`.
  - **UX, dostępność i względy bezpieczeństwa**: Widok tylko dla admin; spokojne zerkanie (brak automatycznego odświeżania w MVP, manualny refresh); czytelne opisy i wartości; stan 403.
  - Obsługuje: US‑010
  - Powiązane endpointy API: `GET /api/admin/kpi`.

- **Nazwa widoku**: Zarządzanie kategoriami (admin)
  - **Ścieżka widoku**: `/admin/categories`
  - **Główny cel**: Tworzenie, edycja i usuwanie globalnych kategorii z pełną walidacją.
  - **Kluczowe informacje do wyświetlenia**: Lista kategorii z nazwą, slugiem, opisem, kolorem; formularze create/edit; potwierdzenia usunięcia.
  - **Kluczowe komponenty widoku**: `CategoriesList`, `CategoryFormModal`, `ConfirmDialog`, `FormError`, `Toasts`.
  - **UX, dostępność i względy bezpieczeństwa**: Widok tylko dla admin; walidacja unikalności slugów i formatu koloru; blokada usunięcia używanych kategorii; logowanie operacji.
  - Obsługuje: US‑011
  - Powiązane endpointy API: `GET /api/admin/categories`, `POST /api/admin/categories`, `GET /api/admin/categories/:id`, `PATCH /api/admin/categories/:id`, `DELETE /api/admin/categories/:id`.

- **Nazwa widoku**: Zarządzanie administratorami (admin)
  - **Ścieżka widoku**: `/admin/admins`
  - **Główny cel**: Przyznawanie i odbieranie roli administratora użytkownikom systemu.
  - **Kluczowe informacje do wyświetlenia**: Lista użytkowników-adminów; wyszukiwanie użytkowników; przyciski grant/revoke; potwierdzenia operacji.
  - **Kluczowe komponenty widoku**: `AdminsList`, `UserSearch`, `GrantRevokeDialog`, `ConfirmDialog`, `Toasts`.
  - **UX, dostępność i względy bezpieczeństwa**: Widok tylko dla admin; walidacja zapobiegająca usunięciu ostatniego admina; logowanie wszystkich operacji; wyszukiwanie z filtrowaniem.
  - Obsługuje: US‑012
  - Powiązane endpointy API: `GET /api/admin/users`, `POST /api/admin/users/:id/grant-admin`, `POST /api/admin/users/:id/revoke-admin`.

- **Nazwa widoku**: Diagnostyka błędów generowania (admin)
  - **Ścieżka widoku**: `/admin/generation-errors`
  - **Główny cel**: Przeglądanie i analiza błędów generowania z filtrowaniem i eksportem.
  - **Kluczowe informacje do wyświetlenia**: Lista błędów z użytkownikiem, modelem, błędem, hashem tekstu, czasem; filtry zakresu dat i użytkownika; przycisk eksportu.
  - **Kluczowe komponenty widoku**: `GenerationErrorsList`, `ErrorFilters`, `ExportButton`, `ErrorDetailsModal`, `Toasts`.
  - **UX, dostępność i względy bezpieczeństwa**: Widok tylko dla admin; paginacja dla wydajności; czytelne prezentowanie błędów; eksport do CSV/JSON.
  - Obsługuje: US‑013
  - Powiązane endpointy API: `GET /api/admin/generation-errors`.

- **Nazwa widoku**: 403 Forbidden
  - **Ścieżka widoku**: `/403`
  - **Główny cel**: Jasny komunikat o braku uprawnień i powrót do strony głównej.
  - **Kluczowe informacje do wyświetlenia**: Opis błędu, linki nawigacyjne.
  - **Kluczowe komponenty widoku**: `ErrorLayout`, `Button`.
  - **UX, dostępność i względy bezpieczeństwa**: Nie ujawnia szczegółów dostępu; przyjazny powrót; focus na tytule.

- **Nazwa widoku**: 404 Not Found
  - **Ścieżka widoku**: `/404`
  - **Główny cel**: Komunikat o nieistniejącej stronie z nawigacją powrotną.
  - **Kluczowe informacje do wyświetlenia**: Tytuł, opis, link do kluczowych widoków.
  - **Kluczowe komponenty widoku**: `ErrorLayout`, `Button`.
  - **UX, dostępność i względy bezpieczeństwa**: Focus na nagłówku; bez kodów technicznych.

## 3. Mapa podróży użytkownika

- **Główny scenariusz (AI → recenzja → zapis → powtórki)**
  1. Użytkownik niezalogowany trafia na funkcjonalny widok → redirect do `/login` z `returnTo`.
  2. Po logowaniu przechodzi do `/generator`.
  3. Wkleja tekst (1000–10 000 znaków), wybiera model/temperaturę → `POST /api/generations`.
  4. Widok pokazuje status joba (polling). W przypadku `409` lub `429` jasny baner z opisem; opcja „Cancel”.
  5. Po `succeeded` CTA do `/candidates` (opcjonalnie z `generation_id` w query).
  6. W `/candidates` przegląda propozycje: edytuje front/back (walidacja), `Accept`/`Reject`.
  7. `Accept` → tworzy fiszkę (origin `ai-full` lub `ai-edited`); sukces → toast i link do `/flashcards`.
  8. W `/flashcards` może zastosować filtry/tagi/kategorie/źródło, edytować w modalach, usuwać (soft delete) lub przywracać.
  9. Z `/flashcards` lub bezpośrednio przechodzi do `/reviews`, przeprowadza sesję i zapisuje wyniki.

- **Scenariusz alternatywny (ręczne dodanie)**
  - W `/flashcards` otwiera modal „Dodaj fiszkę” → `POST /api/flashcards` → walidacje (200/500 znaków) i duplikaty (409).

- **Błędy i stany szczególne**
  - 401: redirect do `/login` z zachowaniem `returnTo`.
  - 403: `/admin/kpi` dla non‑admin → ekran 403, ukryty link w topbarze.
  - 409 `duplicate_flashcard`: inline przy polach front/back (modal lub edycja kandydata).
  - 422: inline (np. naruszenie CHECK/FK), tooltip/tekst pomocniczy z naprawą.
  - 429: baner z informacją o czasie do resetu (generator).
  - 5xx: toast z możliwością ponowienia akcji.

## 4. Układ i struktura nawigacji

- **Topbar (persistent)**
  - Logo (link do `/` lub `/flashcards` po zalogowaniu).
  - Linki: `/generator`, `/candidates`, `/flashcards`, `/reviews`, `/admin/kpi`, `/admin/categories`, `/admin/admins`, `/admin/generation-errors` (tylko admin).
  - `UserMenu`: e‑mail, wyloguj, opcjonalnie link do profilu (future).
  - Mobile: hamburger → menu w `Dialog`/`Sheet`; elementy mają `aria-label` i `sr-only`.
  - A11y: `nav` landmark, focus ring, aktywny stan linku, skip‑link do `main`.

- **Sidebar filtrów (tylko `/flashcards`)**
  - `md+`: stały lewy panel (kategorie, tagi, źródło, origin, sort).
  - `sm`: przycisk „Filtry” → off‑canvas/drawer z tym samym zestawem.
  - Reset filtrów, liczba wyników, wskaźnik aktywnych filtrów (badge).

- **URL i parametry**
  - `/flashcards`: `?q=&categoryId=&sourceId=&tagIds=1,2,3&origin=&sort=created_at&cursor=...`
  - Zmiana jakiegokolwiek filtra resetuje `cursor`.
  - „Załaduj więcej” dokleja kolejne pozycje, zachowując porządek i deterministykę (z `id ASC` wtórnym).

- **Gating tras**
  - Middleware sprawdza sesję i `isAdmin`; SSR wstrzykuje te informacje do `AuthContext`.
  - Non‑admin → wszystkie linki `/admin/*` ukryte; twarde wejście → 403.

## 5. Kluczowe komponenty

- **Layout i nawigacja**
  - `Topbar`, `NavLink`, `UserMenu`, `SkipLink`, `Sidebar`, `Sheet/Drawer` (mobile).

- **Formularze i UI bazowe**
  - `Button`, `IconButton` (z `aria-label`), `Input`, `Textarea` (z licznikami), `Select`, `MultiSelect`, `Badge/Chip`, `Tooltip`.
  - `Modal` (trap focus, restore focus), `ConfirmDialog`, `Toasts`, `FormError` (mapowanie kodów błędów).
  - `Skeleton`, `Spinner`, `EmptyState`, `Banner` (np. 429).

- **Słowniki i wybory**
  - `CategorySelect`, `TagMultiSelect`, `SourceSelect` – zasilane z `DictionariesContext` (TTL 20 min).
  - `DictionariesProvider` – SSR hydratacja + odświeżanie tła po TTL.

- **Fiszki**
  - `FlashcardList` (lista wierszy/kafli), `FlashcardItem`, `FlashcardFormModal` (create/edit).
  - `FiltersSidebar/Drawer`, `SearchInput` (debounce), `SortDropdown`, `LoadMoreButton`.

- **Generator i kandydaci**
  - `GeneratorForm` (sanitacja, limity, licznik), `GenerationStatusPanel` (polling/Cancel).
  - `CandidateList`, `CandidateItem`, `CandidateEditor` (explicit save), `AcceptRejectBar`.

- **Powtórki**
  - `ReviewPlayer`, `OutcomeButtons`, `KeyboardShortcuts`, `ProgressBar`, `StatsSnippet`.

- **KPI (admin)**
  - `KpiCards`, `KpiTrendChart`, `RangePicker`, `RefreshButton`.

- **Zarządzanie kategoriami (admin)**
  - `CategoriesList`, `CategoryFormModal`, `CategoryItem`, `ColorPicker`.

- **Zarządzanie administratorami (admin)**
  - `AdminsList`, `UserSearch`, `GrantRevokeDialog`, `UserItem`.

- **Diagnostyka błędów (admin)**
  - `GenerationErrorsList`, `ErrorFilters`, `ErrorDetailsModal`, `ExportButton`.

- **Konteksty i narzędzia**
  - `AuthProvider` (sesja, `isAdmin`), `ToastsProvider`, `ModalProvider`, `FlashcardsFiltersProvider`.
  - `useFetch` (dedupe, abort, envelope), `usePolling` (interwały, stop conditions), `useUrlQueryState`, `useCursorPagination`.
  - `ErrorBoundary` (granice błędów UI), `ProtectedRoute`/`AdminGuard` (gating komponentów).

- **Powiązanie z API (wysoki poziom)**
  - Słowniki: `GET /api/categories|tags|sources` (SSR → `DictionariesContext`).
  - Generator: `POST/GET/PATCH /api/generations`.
  - Kandydaci: `GET/PATCH/POST(accept|reject) /api/generation-candidates`.
  - Fiszki: `GET/POST/GET:id/PATCH:id/DELETE:id/POST:id/restore /api/flashcards`.
  - Powtórki: `POST /api/review-sessions`, `GET /api/review-stats`.
  - KPI (admin): `GET /api/admin/kpi`.
  - Kategorie (admin): `GET/POST/GET:id/PATCH:id/DELETE:id /api/admin/categories`.
  - Administratorzy (admin): `GET/POST:grant-admin/POST:revoke-admin /api/admin/users`.
  - Diagnostyka (admin): `GET /api/admin/generation-errors`.
