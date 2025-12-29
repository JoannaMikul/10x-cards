## Plan implementacji widoku Diagnostyka błędów generowania (admin)

### 1. Przegląd

- **Cel widoku**: Zapewnić administratorom narzędzie do monitorowania i diagnozowania błędów generowania fiszek przez AI na podstawie logów z tabeli `generation_error_logs`.
- **Zakres funkcjonalny**:
  - Wyświetlanie listy logów błędów z kluczowymi polami: użytkownik (`user_id`), model (`model`), kod błędu (`error_code`), komunikat (`error_message`), hash tekstu źródłowego (`source_text_hash`), długość tekstu (`source_text_length`), czas wystąpienia (`created_at`).
  - Filtrowanie po użytkowniku (UUID), modelu oraz zakresie dat (`from`/`to`).
  - Paginacja kursorowa (`cursor`, `limit`) z przyciskiem „Załaduj więcej”.
  - Eksport danych (min. JSON i CSV) do dalszej analizy z użyciem aktualnie zastosowanych filtrów.
- **Ograniczenia i założenia**:
  - Widok tylko dla zalogowanych administratorów (gating po stronie middleware + autoryzacja w API `GET /api/admin/generation-error-logs`).
  - Brak mutacji danych – widok jest tylko do odczytu (read-only).
  - Potencjalnie duża liczba logów → konieczna paginacja i ostrożność przy eksporcie (limitowane pobieranie).

### 2. Routing widoku

- **Ścieżka URL**: `/admin/generation-errors`.
- **Strona Astro**:
  - Nowy plik `src/pages/admin/generation-errors.astro`.
  - Korzysta z `Layout.astro` oraz wzorca stosowanego w innych widokach admina (`/admin/kpi`, `/admin/categories`, `/admin/admins`).
  - Wewnątrz renderuje komponent React:
    - `AdminGenerationErrorsPage` z `src/components/admin/generation-errors/AdminGenerationErrorsPage.tsx`.
    - Hydratacja po stronie klienta (`client:load`), ponieważ widok wymaga interaktywności (filtry, paginacja, eksport, modal).
- **Gating i nawigacja**:
  - Middleware (`src/middleware/index.ts`) dostarcza do kontekstu informację o zalogowanym użytkowniku oraz jego roli (`isAdmin`).
  - Link do `/admin/generation-errors` jest widoczny w nawigacji (`AppSidebar`/topbar) tylko dla adminów, spójnie z innymi trasami `/admin/*`.
  - Wejście nie-admina na ścieżkę powinno skutkować widokiem 403 (po stronie middleware/SSR), ale komponent musi też poprawnie reagować na `401/403` z API.

### 3. Struktura komponentów

- **Drzewo komponentów (wysoki poziom)**:
  - `AdminGenerationErrorsPage`
    - `ErrorFilters`
      - `UserIdFilterInput` (input tekstowy na UUID użytkownika)
      - `ModelFilterSelect` (select lub input tekstowy na nazwę modelu)
      - `DateRangeFilter` (dwa pola daty `from` / `to`)
      - Przyciski: „Zastosuj filtry”, „Wyczyść filtry”
    - `GenerationErrorsList`
      - `GenerationErrorListHeader` (nagłówki kolumn)
      - `GenerationErrorListItem` (wiersz/log)
      - `EmptyState` (brak wyników)
      - `ErrorState` (błąd ładowania)
      - `Skeleton`/`LoadingState` (pobieranie)
      - `LoadMoreButton` (pobieranie kolejnej strony)
    - `ExportButton`
    - `ErrorDetailsModal`
    - Globalne `Toasts` są już zapewnione przez istniejącą konfigurację (sonner) – widok tylko je wykorzystuje.

### 4. Szczegóły komponentów

- **AdminGenerationErrorsPage**
  - **Opis**: Główny kontener widoku admina; łączy filtry, listę logów i eksport. Odpowiada za inicjalne pobranie danych, przekazywanie stanu i akcji z hooka do komponentów prezentacyjnych.
  - **Główne elementy**:
    - Layout strony admina (nagłówek z tytułem, opisem, ewentualnie licznik wyników).
    - Sekcja filtrów (`ErrorFilters`) nad listą.
    - Lista logów (`GenerationErrorsList`) z paginacją.
    - Panel akcji z `ExportButton`.
    - `ErrorDetailsModal` montowany na poziomie root i sterowany stanem (otwarty/wybrany log).
  - **Obsługiwane interakcje**:
    - Inicjalne ładowanie logów na `mount` (bez filtrów lub z domyślnym zakresem dat, np. ostatnie 7 dni – do decyzji).
    - Reakcja na zmianę filtrów i zatwierdzenie („Zastosuj filtry”).
    - Obsługa „Załaduj więcej” (doklejanie danych).
    - Otwieranie/zamykanie modala szczegółów.
    - Wywołanie eksportu z aktualnie używanymi filtrami.
  - **Walidacja**:
    - Przekazywanie do hooka wyłącznie przefiltrowanych i zwalidowanych wartości z `ErrorFilters`.
    - Przy wykryciu błędów walidacji w filtrach (np. niepoprawny UUID) komponent nie wywołuje zapytania do API, tylko pokazuje błędy.
  - **Typy**:
    - Korzysta z `GenerationErrorLogDTO`, `GenerationErrorLogListResponse`, `ApiErrorResponse` oraz nowych typów widokowych: `AdminGenerationErrorLogListItemVM`, `AdminGenerationErrorLogsFilters`, `AdminGenerationErrorLogsViewState`.
  - **Propsy**:
    - Brak propsów zewnętrznych – komponent jest rootem widoku i sam korzysta z hooków (`useAdminGenerationErrorLogs`).

- **ErrorFilters**
  - **Opis**: Panel filtrów nad listą logów, odpowiedzialny za konfigurację zapytania do API (`user_id`, `model`, `from`, `to`) i ich lokalną walidację.
  - **Główne elementy**:
    - Pole tekstowe `UserIdFilterInput` (np. `Input` z shadcn/ui) z placeholderem „UUID użytkownika”.
    - Select lub `Combobox` `ModelFilterSelect` z listą dostępnych modeli (np. z konfiguracji generatora) + opcja wpisania własnej wartości (jeśli lista nie wystarcza).
    - Dwa pola daty `DateRangeFilter` (np. `input type="date"` lub komponent daty z shadcn/ui) dla `from` i `to`.
    - Przyciski `Button`:
      - „Zastosuj filtry” (submit).
      - „Wyczyść filtry” (reset do wartości domyślnych).
    - Komponent błędów formularza (`FormError`) do wyświetlania globalnych błędów walidacji (np. „Niepoprawny UUID użytkownika”, „Data od nie może być późniejsza niż do”, „Zakres dat nie może przekraczać 90 dni”).
  - **Obsługiwane interakcje**:
    - Edycja wartości filtrów (onChange).
    - Submit formularza (klik „Zastosuj filtry” lub Enter).
    - Reset filtrów (klik „Wyczyść filtry”).
  - **Walidacja**:
    - `user_id`:
      - Puste → brak filtra.
      - Niepuste → musi wyglądać jak UUID (prosty regex lub helper); w razie błędu blokada submitu i komunikat.
    - `model`:
      - Przycięcie białych znaków, maks. np. 200 znaków (spójnie z backendowym Zod).
    - `from` / `to`:
      - Oba pola mogą być puste (brak filtra).
      - Jeśli oba ustawione:
        - `from` ≤ `to`.
        - Opcjonalnie dodatkowe ograniczenie np. maks. 90 dni między datami (wzorzec z `validateDateRange` z `useAdminKpiDashboard`).
    - W przypadku błędów walidacji filtry nie są wysyłane do hooka (ani do API); na interfejsie wyświetlane są komunikaty.
  - **Typy**:
    - `AdminGenerationErrorLogsFilters` – struktura filtrów widoku.
  - **Propsy**:
    - `filters: AdminGenerationErrorLogsFilters` – aktualne wartości filtrów ze stanu hooka.
    - `onChange(filters: AdminGenerationErrorLogsFilters)` – aktualizacja lokalnego stanu filtrów w hooku (bez natychmiastowego fetch).
    - `onSubmit()` – akcja wywoływana po przejściu walidacji (hook wykonuje zapytanie).
    - `onReset()` – reset filtrów i ponowne pobranie pierwszej strony.
    - `validationErrors: string[]` – lista błędów walidacji (opcjonalnie mapowana do `FormError`).

- **GenerationErrorsList**
  - **Opis**: Komponent prezentujący tablicę logów w formie tabeli lub listy wierszy, z obsługą paginacji i stanów „loading/empty/error”.
  - **Główne elementy**:
    - `table` lub `div` z gridem zawierający nagłówki kolumn: Użytkownik, Model, Kod błędu, Hash, Długość, Czas, Akcje.
    - Wiersze `GenerationErrorListItem` z zwięzłym przedstawieniem logu (np. skrócony hash, skrócony komunikat błędu z tooltipem).
    - `LoadMoreButton` pod listą, jeśli `hasMore === true`.
    - `Skeleton`/spinner, gdy `loading === true` i nie ma jeszcze danych.
    - `EmptyState`, gdy `!loading && items.length === 0` – komunikat „Brak błędów dla wybranych filtrów”.
    - `ErrorState`, gdy `error != null` – wyświetla ogólny komunikat i pozwala ponowić próbę (`onRetry`).
  - **Obsługiwane interakcje**:
    - Kliknięcie w wiersz lub przycisk „Szczegóły” → otwarcie `ErrorDetailsModal` (callback `onSelect(log)`).
    - Kliknięcie przycisku „Załaduj więcej” → wywołanie `onLoadMore()`.
  - **Walidacja**:
    - Brak dodatkowej walidacji – komponent jest prezentacyjny, przyjmuje już przetworzone dane VM.
  - **Typy**:
    - `AdminGenerationErrorLogListItemVM[]`, `ApiErrorResponse | null`.
  - **Propsy**:
    - `items: AdminGenerationErrorLogListItemVM[]`.
    - `loading: boolean`.
    - `error: ApiErrorResponse | null`.
    - `hasMore: boolean`.
    - `onLoadMore(): void`.
    - `onSelect(log: AdminGenerationErrorLogListItemVM): void`.
    - `onRetry(): void` (opcjonalne, np. ponowne pobranie z aktualnymi filtrami).

- **GenerationErrorListItem**
  - **Opis**: Pojedynczy wiersz reprezentujący log błędu.
  - **Główne elementy**:
    - Kolumny z:
      - Użytkownik: skrócony `userId` (np. pierwsze 8 znaków) + tooltip z pełnym UUID.
      - Model: nazwa modelu.
      - Kod błędu: np. `active_request_exists`, `hourly_quota_reached`, `db_error`, itp.
      - Hash tekstu: skrócony hash + przycisk „Kopiuj hash”.
      - Długość tekstu: liczba znaków.
      - Czas: data i godzina (`createdAt` w formacie czytelnym dla admina).
      - Akcje: przycisk „Szczegóły”.
  - **Obsługiwane interakcje**:
    - Kliknięcie w cały wiersz lub osobny przycisk „Szczegóły” → `onClick`.
    - Kliknięcie „Kopiuj hash” – użycie `navigator.clipboard.writeText` i toast z potwierdzeniem.
  - **Walidacja**:
    - Brak – komponent korzysta z gotowego VM.
  - **Typy**:
    - `AdminGenerationErrorLogListItemVM`.
  - **Propsy**:
    - `item: AdminGenerationErrorLogListItemVM`.
    - `onClick(item: AdminGenerationErrorLogListItemVM): void`.

- **ExportButton**
  - **Opis**: Przycisk (lub split-button) do eksportu aktualnie przefiltrowanych logów do formatu CSV lub JSON.
  - **Główne elementy**:
    - `Button` z ikoną eksportu, ewentualnie `DropdownMenu` z opcjami „Eksportuj jako CSV” / „Eksportuj jako JSON”.
  - **Obsługiwane interakcje**:
    - Kliknięcie opcji eksportu wywołuje `onExport("csv" | "json")`.
    - Gdy eksport trwa, przycisk jest zablokowany i pokazuje spinner/stan `loading`.
  - **Walidacja**:
    - Gdy nie ma danych do eksportu (`items.length === 0` albo hook sygnalizuje brak danych), komponent powinien:
      - dezaktywować przycisk lub
      - po kliknięciu wyświetlić toast „Brak danych do eksportu”.
  - **Typy**:
    - `GenerationErrorLogsExportFormat = "csv" | "json"` (może pozostać lokalnym typem w module).
  - **Propsy**:
    - `disabled: boolean`.
    - `isExporting: boolean`.
    - `onExport(format: "csv" | "json"): void`.

- **ErrorDetailsModal**
  - **Opis**: Modal prezentujący szczegółowe informacje o pojedynczym logu; pomocny w głębszej analizie problemu.
  - **Główne elementy**:
    - Tytuł np. „Szczegóły błędu generowania”.
    - Sekcja metadanych:
      - `userId`, `model`, `createdAt`.
    - Sekcja informacji o błędzie:
      - `errorCode`, `errorMessage`.
    - Sekcja informacji o tekście źródłowym:
      - `sourceTextHash`, `sourceTextLength`.
    - Potencjalnie surowa reprezentacja obiektu z API (cały `GenerationErrorLogDTO`) w collapsible/`<pre>` dla zaawansowanej analizy.
    - Przyciski akcji:
      - „Zamknij”.
      - „Kopiuj jako JSON” – skopiowanie wybranego logu w formacie JSON do schowka.
  - **Obsługiwane interakcje**:
    - Zamknięcie modala (krzyżyk, przycisk, kliknięcie w tło, klawisz Esc).
    - Kopiowanie JSON/hasha z potwierdzeniem w toastach.
  - **Walidacja**:
    - Brak – komponent prezentacyjny.
  - **Typy**:
    - `AdminGenerationErrorLogListItemVM`.
  - **Propsy**:
    - `open: boolean`.
    - `log: AdminGenerationErrorLogListItemVM | null`.
    - `onClose(): void`.

### 5. Typy

- **Istniejące typy (re-use)**:
  - `GenerationErrorLogDTO` / `GenerationErrorLogListResponse` z `src/types.ts` – DTO i odpowiedź API dla `/api/admin/generation-error-logs`.
  - `PaginatedResponse<TData>` i `CursorPage` – struktura paginacji (`data`, `page.next_cursor`, `page.has_more`).
  - `ApiErrorResponse<TCode>` – spójne opakowanie błędów z backendu.

- **Nowe typy DTO/ViewModel (propozycja, w `src/types.ts`)**:

```ts
export interface AdminGenerationErrorLogListItemVM {
  id: string;
  userId: string;
  model: string;
  errorCode: string;
  errorMessage: string;
  sourceTextHash: string;
  sourceTextLength: number;
  createdAt: IsoDateString;
  // Pola wygodnicze do UI:
  createdAtFormatted: string; // np. "2025-12-27 10:34:12"
}
```

```ts
export interface AdminGenerationErrorLogsFilters {
  userId: string; // pusty string = brak filtra
  model: string; // pusty string = brak filtra
  from?: string; // ISO data "YYYY-MM-DD" lub undefined
  to?: string; // ISO data "YYYY-MM-DD" lub undefined
}
```

```ts
export interface AdminGenerationErrorLogsViewState {
  items: AdminGenerationErrorLogListItemVM[];
  loading: boolean;
  error: ApiErrorResponse | null;
  filters: AdminGenerationErrorLogsFilters;
  // Paginacja:
  nextCursor: string | null;
  hasMore: boolean;
  // Autoryzacja:
  authorizationError?: ApiErrorResponse | null;
  lastStatusCode?: number;
  // Walidacja filtrów:
  validationErrors: string[];
  // Eksport:
  isExporting: boolean;
}
```

```ts
export type GenerationErrorLogsExportFormat = "csv" | "json";
```

- **Typ zwracany przez hook (lokalnie lub w `types.ts`)**:

```ts
export interface UseAdminGenerationErrorLogsReturn {
  state: AdminGenerationErrorLogsViewState;
  loadInitial: () => Promise<void>;
  applyFilters: () => Promise<void>;
  setFilters: (updater: (prev: AdminGenerationErrorLogsFilters) => AdminGenerationErrorLogsFilters) => void;
  resetFilters: () => Promise<void>;
  loadMore: () => Promise<void>;
  openDetails: (log: AdminGenerationErrorLogListItemVM) => void;
  closeDetails: () => void;
  exportLogs: (format: GenerationErrorLogsExportFormat) => Promise<void>;
}
```

- **Dodatkowy stan modala (może być częścią hooka lub osobny typ)**:

```ts
export interface AdminGenerationErrorLogsDetailsState {
  open: boolean;
  selectedLog: AdminGenerationErrorLogListItemVM | null;
}
```

### 6. Zarządzanie stanem

- **Custom hook: `useAdminGenerationErrorLogs`**
  - **Lokalizacja**: `src/components/admin/generation-errors/useAdminGenerationErrorLogs.ts`.
  - **Odpowiedzialność**:
    - Przechowywanie stanu widoku (`AdminGenerationErrorLogsViewState` + ewentualnie `AdminGenerationErrorLogsDetailsState`).
    - Budowanie zapytań do API na bazie filtrów i kursora.
    - Mapowanie `GenerationErrorLogDTO` → `AdminGenerationErrorLogListItemVM`.
    - Obsługa błędów (`ApiErrorResponse`, błędy sieciowe).
    - Obsługa eksportu (pobieranie wielu stron, przygotowanie plików CSV/JSON).
  - **Stan**:
    - `state: AdminGenerationErrorLogsViewState` (opis powyżej).
    - `detailsState: AdminGenerationErrorLogsDetailsState` (jeśli nie scalony z `state`).
  - **Akcje**:
    - `loadInitial()`:
      - Resetuje stan listy, ustawia `loading = true`, `error = null`, `nextCursor = null`.
      - Wysyła `GET /api/admin/generation-error-logs` bez filtrów lub z domyślnymi (np. ostatnie N dni – jeśli implementujemy).
      - Po sukcesie:
        - Ustawia `items`, `nextCursor`, `hasMore`.
      - Po błędzie:
        - Ustawia `error`, `authorizationError` (dla 401/403) i wyświetla toast.
    - `applyFilters()`:
      - Waliduje `filters`; jeśli `validationErrors.length > 0`, pokazuje toast i nie wysyła zapytania.
      - Jeśli walidacja OK:
        - Ustawia `loading = true`, resetuje `items`, `nextCursor`, `error`.
        - Buduje `URLSearchParams` na bazie `filters` + `limit`.
        - Wysyła zapytanie i aktualizuje stan jak w `loadInitial`.
    - `setFilters(updater)`:
      - Umożliwia komponentowi `ErrorFilters` modyfikację filtrów (kontrolowany komponent).
      - Resetuje `validationErrors` przy każdej zmianie.
    - `resetFilters()`:
      - Ustawia `filters` do wartości domyślnych (np. puste).
      - Wywołuje `loadInitial()` (lub osobne `loadWithFilters()`).
    - `loadMore()`:
      - Gdy `hasMore === true`, `nextCursor != null`, `!loading`:
        - Wysyła kolejne żądanie z tym samym zestawem filtrów + `cursor`.
        - Dokleja nowe elementy do `items` i aktualizuje `nextCursor`, `hasMore`.
    - `openDetails(log)` / `closeDetails()`:
      - Sterowanie stanem `ErrorDetailsModal`.
    - `exportLogs(format)`:
      - Sprawdza, czy nie ma błędów walidacji i czy jest chociaż jedna strona danych lub aktywne filtry.
      - Ustawia `isExporting = true`.
      - W pętli pobiera kolejne strony z API (z tymi samymi filtrami, rosnącym `cursor`), aż:
        - `has_more === false` lub
        - osiągnięto maksymalną liczbę rekordów (np. 10 000) – zabezpieczenie przed nadmiernym obciążeniem.
      - Generuje plik:
        - **JSON**: `Blob` z `JSON.stringify(allItems, null, 2)`.
        - **CSV**: transformacja tablicy logów do wierszy CSV (nagłówek + wiersze).
      - Tworzy link pobierania (`URL.createObjectURL`) i inicjuje pobieranie jak w `exportData` z `useAdminKpiDashboard`.
      - Na sukces pokazuje toast, resetuje `isExporting`; na błąd ustawia `error` i prezentuje toast z komunikatem.
  - **Integracja z komponentami**:
    - `AdminGenerationErrorsPage` pobiera `state`, `setFilters`, `applyFilters`, `resetFilters`, `loadMore`, `openDetails`, `closeDetails`, `exportLogs` z hooka i przekazuje do odpowiednich podkomponentów.

### 7. Integracja API

- **Endpoint**: `GET /api/admin/generation-error-logs`.
- **Nagłówki**:
  - `Accept: application/json`.
  - `Authorization: Bearer <jwt>` – po stronie przeglądarki zapewniane przez Supabase; dla hooka wystarczy standardowe `fetch`, jak w innych admin hookach.
- **Parametry zapytania (budowane w hooku)**:
  - `user_id` – z `filters.userId`, tylko jeśli niepusty.
  - `model` – z `filters.model`, po `trim()`, tylko jeśli niepusty.
  - `from` – z `filters.from` (ISO `YYYY-MM-DD`), jeśli ustawione.
  - `to` – z `filters.to`.
  - `limit` – np. `20` (stała `DEFAULT_LIMIT`).
  - `cursor` – z `state.nextCursor`, tylko przy ładowaniu kolejnych stron (`loadMore`).
- **Obsługa odpowiedzi**:
  - Sukces (`200`):
    - `const data: GenerationErrorLogListResponse = await response.json();`
    - Mapowanie `data.data` (DTO) → `AdminGenerationErrorLogListItemVM[]`.
    - Aktualizacja stanu paginacji:
      - `nextCursor = data.page.next_cursor`.
      - `hasMore = data.page.has_more`.
  - Błędy:
    - `401 unauthorized` / `403 forbidden`:
      - Odczyt `ApiErrorResponse` (helper `parseApiError` podobny do istniejących hooków admina).
      - Ustawienie `authorizationError` i `lastStatusCode`.
      - Wyświetlenie toast „Insufficient permissions” lub polski odpowiednik.
    - `400 invalid_query`:
      - Z backendu przychodzą szczegóły walidacji (lista `issues`), już logowane przez `recordGenerationErrorLogsEvent`.
      - Hook może:
        - zapisać `error` w stanie,
        - opcjonalnie wyciągnąć `issues` i przemapować na `validationErrors` (np. powiązać z `user_id`/`from`/`to`).
      - UI powinien pokazać czytelny komunikat („Nieprawidłowe parametry filtrowania”).
    - `500 db_error` / `500 unexpected_error`:
      - Ustawienie `error` i toast „Nieoczekiwany błąd serwera podczas pobierania logów”.
    - Błąd sieci / parse:
      - Fallback `ApiErrorResponse` z `network_error` / `parse_error`.
- **Kontrakt typów**:
  - Odpowiedź sukcesu: `GenerationErrorLogListResponse` (patrz `src/types.ts`).
  - Odpowiedzi błędów: `ApiErrorResponse` z kodami z `GENERATION_ERROR_LOGS_ERROR_CODES` (m.in. `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_QUERY`, `DB_ERROR`, `UNEXPECTED_ERROR`).

### 8. Interakcje użytkownika

- **Wejście na widok**:
  - Użytkownik-admin przechodzi do `/admin/generation-errors` z topbara.
  - Widok pokazuje skeleton listy / stan „Ładowanie” i wywołuje `loadInitial()`.
  - Po zakończeniu ładowania pojawia się lista logów lub `EmptyState`.
- **Filtrowanie logów**:
  - Użytkownik wpisuje `userId` (UUID) i/lub wybiera `model` oraz zakres dat.
  - Wciśnięcie „Zastosuj filtry”:
    - Jeśli formularz ma błędy → wyświetlany jest komunikat i żądanie nie jest wysyłane.
    - Jeśli walidacja przejdzie → hook pobiera pierwszą stronę wyników z nowymi filtrami.
  - Wciśnięcie „Wyczyść filtry”:
    - Resetuje inputy do wartości domyślnych.
    - Widok ładuje logi bez filtrów (lub z domyślnym zakresem).
- **Przeglądanie listy**:
  - Użytkownik widzi tabelę logów, może:
    - przewijać,
    - kliknąć „Załaduj więcej”, aby pobrać kolejne strony.
- **Podgląd szczegółów**:
  - Kliknięcie w wiersz lub przycisk „Szczegóły” otwiera `ErrorDetailsModal` z pełnymi informacjami o logu.
  - W modalu użytkownik może:
    - skopiować hash lub cały log jako JSON,
    - zamknąć modal.
- **Eksport danych**:
  - Użytkownik wybiera z `ExportButton` format eksportu (CSV lub JSON).
  - UI informuje o trwającym eksporcie (spinner, disabled).
  - Po zakończeniu eksportu plik jest automatycznie pobierany; wyświetlany jest toast z potwierdzeniem.
- **Stany błędów / brak uprawnień**:
  - Przy `401/403` z API:
    - Pokazany jest komunikat o braku uprawnień.
    - Opcjonalnie redirect do `/auth/login` lub `/403` (zgodnie z globalną polityką aplikacji).

### 9. Warunki i walidacja

- **Walidacja filtrów po stronie UI**:
  - `userId`:
    - Jeśli niepusty → musi być poprawnym UUID.
  - `model`:
    - Maks. długość np. 200 znaków; przycięcie białych znaków.
  - `from` / `to`:
    - Dozwolone kombinacje:
      - oba puste – brak filtra,
      - tylko jedno ustawione – filtr jednostronny (jeśli backend to dopuszcza), inaczej można wymusić oba.
      - oba ustawione – `from <= to`, opcjonalnie maks. 90 dni różnicy.
  - W przypadku niepowodzenia walidacji:
    - `validationErrors` są aktualizowane,
    - przy próbie submitu wyświetlany jest toast „Popraw błędy w filtrach przed wyszukiwaniem”.

- **Warunki wymagane przez API i ich odzwierciedlenie w UI**:
  - `limit` – UI zawsze wysyła prawidłową wartość (np. 20), nie pozwala użytkownikowi jej zmieniać.
  - `cursor` – UI używa wyłącznie wartości otrzymanej z API, nie pozwala na ręczną edycję.
  - `user_id` – UI gwarantuje (po walidacji), że wysyłany format jest prawidłowy → minimalizacja `400 invalid_query`.
  - `from`/`to` – UI wysyła daty w formacie akceptowanym przez backend (ISO string / `YYYY-MM-DD`).

### 10. Obsługa błędów

- **Błędy sieciowe / nieoczekiwane**:
  - Fallback `ApiErrorResponse` z kodem `network_error` / `unexpected_error`.
  - Wyświetlenie toast „Błąd sieci podczas pobierania logów błędów generowania”.
  - `GenerationErrorsList` może pokazać `ErrorState` z przyciskiem „Spróbuj ponownie”.
- **Błędy walidacji zapytania (400 invalid_query)**:
  - Tekst z `error.message` prezentowany w `ErrorState` lub w `FormError` nad filtrami.
  - Jeśli `details.issues` są dostępne, można mapować je na konkretne pola (np. `user_id`, `from`, `to`) i wyświetlać per-field.
- **Błędy autoryzacji (401, 403)**:
  - Zapisane w `authorizationError`, `lastStatusCode`.
  - Komunikat w UI: „Brak uprawnień do przeglądania logów błędów generowania”.
  - Możliwy redirect do `/auth/login` (jak w `useAdminCategories`) lub prezentacja dedykowanego stanu z linkiem powrotnym.
- **Błędy serwera (500 db_error, unexpected_error)**:
  - Toast z komunikatem wysokiego poziomu + zachętą do ponownego spróbowania.
  - Widok listy przechodzi w `ErrorState` (zachowuje ostatnie poprawne dane lub czyści listę w zależności od implementacji).
- **Błędy eksportu**:
  - Jeśli eksport się nie powiedzie (błąd pobierania którejś strony, problem z generacją Blob):
    - `isExporting` ustawione na `false`.
    - Toast „Wystąpił błąd podczas eksportu logów”.
    - Opcjonalnie szczegół z `ApiErrorResponse`.

### 11. Kroki implementacji

1. **Dodanie typów**:
   - Zaktualizuj `src/types.ts`, dodając:
     - `AdminGenerationErrorLogListItemVM`.
     - `AdminGenerationErrorLogsFilters`.
     - `AdminGenerationErrorLogsViewState`.
     - `GenerationErrorLogsExportFormat`.
     - (opcjonalnie) `AdminGenerationErrorLogsDetailsState` i `UseAdminGenerationErrorLogsReturn`.
2. **Przygotowanie struktury plików widoku**:
   - Utwórz katalog `src/components/admin/generation-errors/`.
   - Dodaj pliki:
     - `AdminGenerationErrorsPage.tsx`.
     - `ErrorFilters.tsx`.
     - `GenerationErrorsList.tsx`.
     - `GenerationErrorListItem.tsx`.
     - `ExportButton.tsx`.
     - `ErrorDetailsModal.tsx`.
     - `useAdminGenerationErrorLogs.ts`.
3. **Implementacja hooka `useAdminGenerationErrorLogs`**:
   - Zaimplementuj stan, akcje i integrację z API według sekcji „Zarządzanie stanem” i „Integracja API”.
   - Zadbaj o:
     - użycie `AbortController` do anulowania nadmiarowych żądań przy zmianie filtrów,
     - spójne parsowanie błędów (`parseApiError`),
     - logikę eksportu wielostronicowego.
4. **Implementacja komponentów prezentacyjnych**:
   - `GenerationErrorListItem`:
     - Zaimplementuj layout wiersza z kolumnami i akcjami.
   - `GenerationErrorsList`:
     - Obsłuż stany loading/empty/error/hasMore.
   - `ErrorFilters`:
     - Zaimplementuj formularz filtrów wraz z walidacją klienta.
   - `ExportButton`:
     - Zaimplementuj split-button / dropdown z formatami CSV/JSON.
   - `ErrorDetailsModal`:
     - Użyj komponentu modala z shadcn/ui, zadbaj o a11y (trap focus, `aria-modal`, przywracanie fokusa).
5. **Implementacja `AdminGenerationErrorsPage`**:
   - Podłącz `useAdminGenerationErrorLogs`.
   - Połącz `ErrorFilters`, `GenerationErrorsList`, `ExportButton`, `ErrorDetailsModal`:
     - Przekaż odpowiednie fragmenty stanu i akcje.
     - Podłącz toasty dla kluczowych akcji (błędy, sukces eksportu).
6. **Dodanie strony Astro**:
   - Utwórz `src/pages/admin/generation-errors.astro`:
     - Wykorzystaj `Layout.astro`.
     - Zaimportuj `AdminGenerationErrorsPage` i wyrenderuj go z hydratacją kliencką.
7. **Integracja z nawigacją i gatingiem**:
   - Dodaj link do `/admin/generation-errors` w `AppSidebar`/górnej nawigacji (tylko dla adminów).
   - Upewnij się, że middleware poprawnie obsługuje dostęp do `/admin/generation-errors`.
8. **Stylowanie i dostępność**:
   - Zastosuj Tailwind 4 i komponenty shadcn/ui, spójnie z innymi widokami admina.
   - Zapewnij:
     - focus state na interaktywnych elementach,
     - `aria-label` dla ikon (np. kopiowania),
     - czytelne komunikaty w `aria-live` dla stanów ładowania/błędów.
9. **Testy manualne widoku**:
   - Scenariusze:
     - Brak filtrów + paginacja.
     - Filtr po `userId` (prawidłowy i błędny UUID).
     - Filtr po modelu.
     - Filtr zakresu dat (`from` > `to`, zakres > 90 dni).
     - Brak wyników.
     - Błąd sieciowy.
     - Błąd `400 invalid_query`.
     - Błędy `401/403` (symulacja braku uprawnień).
     - Eksport CSV/JSON przy małej i większej liczbie logów.
10. **Refaktoryzacja/wspólne utilsy (opcjonalnie)**:
    - Jeśli pojawią się duplikaty z innymi hookami admina (np. `parseApiError`, helper eksportu CSV), rozważ wyciągnięcie ich do wspólnych modułów w `src/lib/utils` lub `src/components/hooks`.
