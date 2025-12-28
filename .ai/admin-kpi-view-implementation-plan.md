## Plan implementacji widoku Dashboard KPI (admin)

Widok służy do prezentacji kluczowych metryk dotyczących generowania fiszek przez AI oraz ich wykorzystania w stosunku do fiszek tworzonych ręcznie. Dane są pobierane z endpointu `GET /api/admin/kpi` i dostępne wyłącznie dla użytkowników z rolą administratora.

### 1. Przegląd

- **Cel widoku**: Zapewnienie administratorowi/PM-owi wglądu w:
  - **AI acceptance rate** – odsetek zaakceptowanych kandydatów AI względem wszystkich wygenerowanych.
  - **AI share** – udział fiszek generowanych przez AI względem manualnych.
  - **Trend w czasie** – jak zmienia się liczba fiszek AI/manual i zaakceptowanych AI w zadanym okresie.
- **Źródło danych**: Endpoint `GET /api/admin/kpi`, zwracający strukturę `AnalyticsKpiResponse`.
- **Dostęp**: Tylko użytkownicy z rolą admin; brak dostępu dla zwykłych użytkowników (obsługa stanu 401/403).
- **UX**:
  - Ręczne odświeżanie poprzez przycisk **„Odśwież”** (brak automatycznego pollingu w MVP).
  - Filtr czasowy (7 dni, 30 dni, zakres własny).
  - Czytelne karty KPI, prosty wykres trendu, stany pusty/błędu, toasty z informacjami zwrotnymi.

### 2. Routing widoku

- **Ścieżka URL**: `/admin/kpi`.
- **Plik strony**: `src/pages/admin/kpi.astro`.
  - Korzysta z istniejącego layoutu aplikacyjnego (np. `Layout.astro` / layout z panelem bocznym).
  - Osadza główny komponent React: `KpiDashboardPage` z `src/components/admin/kpi/KpiDashboardPage.tsx`.
- **Ochrona dostępu**:
  - Warstwa RLS i funkcja `is_admin` egzekwują uprawnienia po stronie backendu.
  - Middleware / logika frontendu powinna:
    - Zostawić routę dostępną dla zalogowanego użytkownika.
    - Na błędach 401/403 z endpointu pokazać odpowiedni stan informacyjny (bez ręcznego zarządzania sesją na poziomie tej strony).

### 3. Struktura komponentów

- **`KpiDashboardPage` (root React component)**
  - Odpowiada za:
    - Inicjalne pobranie danych KPI.
    - Utrzymanie stanu zapytania (`range`, ewentualnie `from`/`to`, `group_by`).
    - Utrzymanie stanu ładowania, błędów, daty ostatniego odświeżenia.
    - Renderowanie odpowiednich stanów: ładowanie, błąd, brak danych, dane OK.
  - Kompozycja:
    - `KpiHeader`
    - `KpiControlsBar`
      - `KpiRangePicker`
      - `KpiRefreshButton`
      - (opcjonalnie) `KpiExportButton`
    - `KpiContent`:
      - `KpiErrorState` / `KpiEmptyState` / (`KpiCards` + `KpiTrendChart`)

- **`KpiHeader`**
  - Prezentuje tytuł widoku („Dashboard KPI”), krótki opis i ewentualną ikonę.

- **`KpiControlsBar`**
  - Pasek narzędzi nad treścią z filtrami czasu i przyciskami akcji.
  - Zawiera:
    - `KpiRangePicker`
    - `KpiRefreshButton`
    - (opcjonalnie) `KpiExportButton`

- **`KpiRangePicker`**
  - Umożliwia wybór zakresu czasu: `7 dni`, `30 dni`, `Zakres własny`.
  - Dla zakresu własnego pozwala wybrać daty `from` i `to`.

- **`KpiRefreshButton`**
  - Wywołuje ponowne pobranie danych z API na podstawie aktualnie ustawionych filtrów.

- **`KpiExportButton` (opcjonalne rozszerzenie dla pełnego pokrycia US‑010)**
  - Eksportuje aktualnie wyświetlane dane KPI:
    - Do pliku **CSV** lub **JSON** wygenerowanego po stronie klienta z `AnalyticsKpiResponse`.

- **`KpiCards`**
  - Zestaw kart z głównymi wskaźnikami:
    - AI acceptance rate (np. w %).
    - AI share (udział AI vs manual).
    - Suma fiszek AI i manualnych (`totals`).

- **`KpiTrendChart`**
  - Wykres trendu w czasie na podstawie `trend: AnalyticsTrendPointDTO[]`.
  - Prosty wykres liniowy lub słupkowy, przedstawiający:
    - liczbę fiszek AI vs manual dla daty,
    - liczbę zaakceptowanych AI (`accepted_ai`).

- **`KpiEmptyState`**
  - Pokazywany, gdy brak danych (np. `totals.ai + totals.manual === 0` lub `trend.length === 0`).

- **`KpiErrorState`**
  - Pokazywany, gdy wystąpił błąd z API.
  - Rozróżnia:
    - `401` – problem z autentykacją.
    - `403` – brak uprawnień admina.
    - Inne błędy (400, 500, sieć).

- **System toastów (`Toasts`)**
  - Wykorzystuje istniejące w projekcie mechanizmy (np. `sonner` / `useToast` z Shadcn/ui).
  - Wyświetla komunikaty:
    - Sukces odświeżenia.
    - Błędy sieci/serwera.
    - Ostrzeżenia przy niepoprawnych filtrach.

### 4. Szczegóły komponentów

#### `KpiDashboardPage`

- **Opis**:
  - Główny komponent widoku pod `/admin/kpi`.
  - Łączy stan (hook `useAdminKpiDashboard`) z komponentami prezentacyjnymi.
- **Główne elementy**:
  - Kontener (`<div>` / sekcja) z klasami Tailwind dla układu.
  - Dzieci:
    - `KpiHeader`
    - `KpiControlsBar`
    - Sekcja treści z `KpiErrorState` / `KpiEmptyState` / `KpiCards` + `KpiTrendChart`.
- **Obsługiwane interakcje**:
  - Przekazuje `onRangeChange`, `onCustomRangeChange`, `onRefresh`, `onExport` do dzieci.
  - Reaguje na zmianę filtrów poprzez aktualizację stanu zapytania (bez automatycznego odświeżania).
  - Na `onRefresh` wywołuje `fetchKpi()` z aktualnymi parametrami.
- **Obsługiwana walidacja**:
  - Weryfikacja, że:
    - `range` jest jednym z: `"7d" | "30d" | "custom"`.
    - Dla `range = "custom"`:
      - `from` i `to` są ustawione.
      - `from <= to`.
      - Różnica nie przekracza 90 dni (zgodnie z ograniczeniem w backendzie).
  - Przy niespełnieniu warunków:
    - Dezaktywacja przycisku „Odśwież”.
    - Wyświetlenie komunikatu błędu nad/pod kontrolkami.
- **Typy**:
  - `AnalyticsKpiResponse`, `ApiErrorResponse` (z `src/types.ts`).
  - Nowe typy (ViewModel):
    - `AdminKpiRange`.
    - `AdminKpiQueryParams`.
    - `AdminKpiState`.
- **Propsy**:
  - Komponent rootowy na poziomie tej strony nie musi przyjmować propsów (dane pobiera sam).
  - Opcjonalnie: `initialRange?: AdminKpiRange` (na przyszłość).

#### `KpiHeader`

- **Opis**:
  - Prezentacyjny nagłówek widoku.
- **Główne elementy**:
  - `<header>` zawierający:
    - Tytuł (`<h1>` z klasami Tailwind + komponent typografii Shadcn).
    - Krótką notkę opisową (np. `<p>`).
    - (opcjonalnie) ikonę lub badge „Admin”.
- **Obsługiwane interakcje**:
  - Brak (komponent statyczny).
- **Walidacja**:
  - Brak logiki walidacyjnej.
- **Typy**:
  - Brak niestandardowych typów (ew. prosty interfejs `KpiHeaderProps` z polami tekstowymi).
- **Propsy**:
  - `title?: string` (domyślnie „Dashboard KPI”).
  - `description?: string`.

#### `KpiControlsBar`

- **Opis**:
  - Pasek sterujący filtrami i akcjami (odświeżanie, eksport).
- **Główne elementy**:
  - `<section>` zawierająca:
    - `KpiRangePicker`.
    - `KpiRefreshButton`.
    - (opcjonalnie) `KpiExportButton`.
- **Obsługiwane interakcje**:
  - Zmiana zakresu (`onRangeChange`, `onCustomRangeChange`).
  - Kliknięcie „Odśwież”.
  - Kliknięcie „Eksportuj”.
- **Walidacja**:
  - Przekazuje w dół informację o błędach walidacji zakresu (np. `rangeError`) do `KpiRangePicker`.
  - Ustawia flagę `disabled` dla `KpiRefreshButton`, gdy zakres jest nieprawidłowy.
- **Typy**:
  - `AdminKpiRange`, `AdminKpiQueryParams` (do opisu propsów).
- **Propsy**:
  - `range: AdminKpiRange`.
  - `customFrom?: Date | null`.
  - `customTo?: Date | null`.
  - `isRangeValid: boolean`.
  - `isLoading: boolean`.
  - `lastUpdatedAt?: string`.
  - `onRangeChange(range: AdminKpiRange): void`.
  - `onCustomRangeChange(from: Date | null, to: Date | null): void`.
  - `onRefresh(): void`.
  - `onExport?(): void`.

#### `KpiRangePicker`

- **Opis**:
  - Komponent do wyboru zakresu czasu analizy.
- **Główne elementy**:
  - Grupa przycisków / `SegmentedControl` lub `Select` z opcjami:
    - „Ostatnie 7 dni”
    - „Ostatnie 30 dni”
    - „Zakres własny”
  - Dwa pola daty (np. `DatePicker` z Shadcn/ui lub natywne `<input type="date">`):
    - `from` – data początkowa.
    - `to` – data końcowa.
- **Obsługiwane interakcje**:
  - Zmiana opcji zakresu.
  - Wybór dat `from` i `to` dla zakresu własnego.
- **Walidacja**:
  - Syntaktyczna walidacja dat:
    - Jeśli `range === "custom"`:
      - Oba pola muszą być uzupełnione.
      - `from <= to`.
      - Różnica dat ≤ 90 dni (można policzyć w milisekundach i zamienić na dni).
  - Błędy przekazywane w postaci:
    - `rangeError?: string`.
  - UI:
    - Pokazanie komunikatu błędu w `FormMessage`.
    - Podświetlenie pól dat na czerwono w razie problemu.
- **Typy**:
  - `AdminKpiRange`.
  - Prostego typu pomocniczego:
    - `AdminKpiRangeValidation = { isValid: boolean; errors: string[] }` (głównie w stanie hooka).
- **Propsy**:
  - `range: AdminKpiRange`.
  - `customFrom?: Date | null`.
  - `customTo?: Date | null`.
  - `rangeError?: string`.
  - `onRangeChange(range: AdminKpiRange): void`.
  - `onCustomRangeChange(from: Date | null, to: Date | null): void`.

#### `KpiRefreshButton`

- **Opis**:
  - Przycisk do ręcznego odświeżania danych KPI.
- **Główne elementy**:
  - Komponent Shadcn/ui `Button` z ikoną odświeżania (np. `Loader2` / `RefreshCw`).
  - Tooltip „Odśwież dane”.
- **Obsługiwane interakcje**:
  - Kliknięcie powoduje wywołanie `onClick` w rodzicu.
- **Walidacja / zasady**:
  - Guzik jest:
    - **disabled**, gdy:
      - Trwa ładowanie (`isLoading === true`).
      - Zakres jest nieprawidłowy (`!isRangeValid`).
  - W przypadku błędnych filtrów nie wywołuje zapytania.
- **Typy**:
  - Prosty interfejs:
    - `KpiRefreshButtonProps = { isLoading: boolean; isRangeValid: boolean; onClick: () => void; }`.
- **Propsy**:
  - `isLoading: boolean`.
  - `isRangeValid: boolean`.
  - `onClick(): void`.

#### `KpiExportButton` (opcjonalny)

- **Opis**:
  - Akcja eksportu aktualnie zwizualizowanych danych do pliku CSV lub JSON (pokrycie kryterium z US‑010).
- **Główne elementy**:
  - `DropdownMenu` lub przycisk z menu:
    - „Eksportuj jako CSV”
    - „Eksportuj jako JSON”
- **Obsługiwane interakcje**:
  - Kliknięcie konkretnej opcji wywołuje callback eksportu.
- **Walidacja / zasady**:
  - Gdy brak danych (`data === undefined` lub `trend.length === 0`), przycisk:
    - Jest disabled, lub
    - Pokazuje toast „Brak danych do eksportu”.
- **Typy**:
  - `KpiExportFormat = "csv" | "json"`.
  - `KpiExportButtonProps = { hasData: boolean; onExport: (format: KpiExportFormat) => void; }`.
- **Propsy**:
  - `hasData: boolean`.
  - `onExport(format: KpiExportFormat): void`.

#### `KpiCards`

- **Opis**:
  - Prezentacja głównych liczb i wskaźników w formie kart.
- **Główne elementy**:
  - Siatka (`grid`) kart:
    - Karta „AI acceptance rate” – wartość procentowa, opis.
    - Karta „Udział AI” – wartość procentowa, opis.
    - Karta „Łączna liczba fiszek” – liczby AI / manual / suma.
  - Wykorzystanie komponentów Shadcn/ui (`Card`, `CardHeader`, `CardContent`).
- **Obsługiwane interakcje**:
  - Brak interakcji modyfikujących stan (tylko hover, focus).
- **Walidacja**:
  - Bez dodatkowej walidacji (przyjmuje już zweryfikowane dane).
  - Ewentualne zabezpieczenie przed `NaN`:
    - Fallback do `0` lub `"-"` w razie niepoprawnych danych.
- **Typy**:
  - `AnalyticsKpiResponse`.
  - ViewModel:
    - `KpiCardsViewModel = { aiAcceptanceRatePercent: number; aiSharePercent: number; totalAi: number; totalManual: number; totalAll: number; }`.
- **Propsy**:
  - `data: AnalyticsKpiResponse`.

#### `KpiTrendChart`

- **Opis**:
  - Wykres trendu wartości w czasie.
- **Główne elementy**:
  - Kontener z osią X (daty) i Y (liczba fiszek).
  - Prosty wykres (np. `<svg>` + ścieżki, lub lekka biblioteka chartów jeśli projekt to dopuszcza).
  - Legenda (np. kolory: AI, manual, accepted AI).
- **Obsługiwane interakcje**:
  - Hover nad punktem – tooltip z wartościami `ai`, `manual`, `accepted_ai` dla danej daty.
  - (opcjonalnie) możliwość ukrycia jednej z serii w legendzie.
- **Walidacja**:
  - Filtracja / sortowanie danych:
    - Zapewnienie, że punkty są posortowane po dacie rosnąco.
    - Fallback dla pustej listy (komponent nie jest renderowany, gdy `trend.length === 0`).
- **Typy**:
  - `AnalyticsTrendPointDTO` z `src/types.ts`.
  - ViewModel:
    - `KpiTrendPointViewModel = { date: Date; label: string; ai: number; manual: number; acceptedAi: number; }`.
- **Propsy**:
  - `trend: AnalyticsTrendPointDTO[]`.
  - `range: AdminKpiRange`.

#### `KpiEmptyState`

- **Opis**:
  - Informuje, że dla wybranego zakresu czasowego brak danych.
- **Główne elementy**:
  - Ikona „pustej” listy.
  - Tekst informacyjny.
  - Przyciski:
    - „Zresetuj filtry” (ustawia domyślny zakres `7d`).
    - (opcjonalnie) „Odśwież”.
- **Obsługiwane interakcje**:
  - Kliknięcie „Zresetuj filtry”.
- **Walidacja**:
  - Warunek wejścia: `!loading && !error && (trend.length === 0 || total === 0)`.
- **Typy**:
  - Prosty interfejs:
    - `KpiEmptyStateProps = { range: AdminKpiRange; onResetFilters: () => void; }`.
- **Propsy**:
  - `range: AdminKpiRange`.
  - `onResetFilters(): void`.

#### `KpiErrorState`

- **Opis**:
  - Prezentuje błąd związany z pobieraniem danych lub brakiem uprawnień.
- **Główne elementy**:
  - Komponent alertu (np. Shadcn `Alert`).
  - Tekst:
    - Osobne komunikaty dla:
      - 401 – poprosić o ponowne logowanie.
      - 403 – informacja „Tylko administratorzy mają dostęp do tego widoku”.
      - 4xx/5xx/nieznane – ogólny komunikat z możliwością ponowienia.
  - Przycisk „Spróbuj ponownie” (dla błędów sieci/500).
- **Obsługiwane interakcje**:
  - Kliknięcie „Spróbuj ponownie” wywołuje callback `onRetry`.
- **Walidacja**:
  - Komponent przyjmuje już znormalizowany obiekt błędu.
- **Typy**:
  - `ApiErrorResponse` (z `src/types.ts`).
  - `KpiErrorStateProps = { error: ApiErrorResponse | null; statusCode?: number; onRetry?: () => void; }`.
- **Propsy**:
  - `error: ApiErrorResponse | null`.
  - `statusCode?: number`.
  - `onRetry?(): void`.

### 5. Typy

- **Typy istniejące (z `src/types.ts`)**:
  - **`AnalyticsTrendPointDTO`**:
    - `date: string` – ISO date string (dzień agregacji).
    - `ai: number` – liczba fiszek utworzonych przez AI danego dnia.
    - `manual: number` – liczba fiszek utworzonych ręcznie danego dnia.
    - `accepted_ai: number` – liczba kandydatów AI zaakceptowanych danego dnia.
  - **`AnalyticsTotalsDTO`**:
    - `ai: number` – łączna liczba fiszek AI w zadanym okresie.
    - `manual: number` – łączna liczba fiszek manualnych.
  - **`AnalyticsKpiResponse`**:
    - `ai_acceptance_rate: number` – wartość z przedziału `0..1`, udział zaakceptowanych kandydatów AI.
    - `ai_share: number` – wartość z przedziału `0..1`, udział fiszek AI względem manualnych.
    - `totals: AnalyticsTotalsDTO` – agregaty dla AI/manual.
    - `trend: AnalyticsTrendPointDTO[]` – punkty trendu w czasie.
  - **`ApiErrorResponse<TCode>`**:
    - `error.code: TCode` – kod błędu (np. `invalid_query`, `forbidden`, `unexpected_error`).
    - `error.message: string` – komunikat błędu.
    - `error.details?: Json` – dodatkowe dane diagnostyczne.

- **Nowe typy dla widoku KPI**:
  - **`type AdminKpiRange = "7d" | "30d" | "custom";`**
    - Symboliczny typ reprezentujący wybór zakresu czasu w UI.

  - **`interface AdminKpiQueryParams`**

    ```ts
    interface AdminKpiQueryParams {
      range: AdminKpiRange; // '7d' | '30d' | 'custom'
      group_by: "day"; // na razie tylko 'day', twardo zakodowane po stronie frontu
      from?: string; // ISO date string dla zakresu własnego
      to?: string; // ISO date string dla zakresu własnego
    }
    ```

    - Używany do budowania URL-a zapytania HTTP (parametry `searchParams`).

  - **`interface AdminKpiState`**

    ```ts
    interface AdminKpiState {
      query: AdminKpiQueryParams;
      data?: AnalyticsKpiResponse;
      loading: boolean;
      error?: ApiErrorResponse | null;
      lastUpdatedAt?: string; // ISO date/time string ostatniego udanego odświeżenia
      isPristine: boolean; // czy użytkownik jeszcze nie uruchomił ręcznego odświeżenia
      validationErrors: string[];
      lastStatusCode?: number; // ostatni status HTTP (do różnicowania 401/403/500)
    }
    ```

  - **`interface KpiCardsViewModel`**

    ```ts
    interface KpiCardsViewModel {
      aiAcceptanceRatePercent: number;
      aiSharePercent: number;
      totalAi: number;
      totalManual: number;
      totalAll: number;
    }
    ```

    - Ułatwia formatowanie liczb dla `KpiCards` (np. zaokrąglenia).

  - **`interface KpiTrendPointViewModel`**

    ```ts
    interface KpiTrendPointViewModel {
      date: Date;
      label: string; // np. '2025-12-01'
      ai: number;
      manual: number;
      acceptedAi: number;
    }
    ```

    - Wygodny typ dla `KpiTrendChart` (można go zbudować z `AnalyticsTrendPointDTO`).

  - **`type KpiExportFormat = "csv" | "json";`**
    - Określa docelowy format eksportu.

### 6. Zarządzanie stanem

- **Podejście**:
  - Zarządzanie stanem lokalnym na poziomie widoku poprzez dedykowany hook:
    - `useAdminKpiDashboard` w `src/components/hooks/useAdminKpiDashboard.ts`.
  - Brak konieczności korzystania z globalnego store (Redux/Zustand) – stan jest izolowany do tej strony.

- **Hook `useAdminKpiDashboard`**:
  - **Stan**:
    - `state: AdminKpiState`.
  - **API hooka**:
    - `state` – bieżący stan (dane, ładowanie, błędy).
    - `setRange(range: AdminKpiRange)` – ustawia wartość `range` w `state.query`.
    - `setCustomRange(from: Date | null, to: Date | null)` – aktualizuje daty, przelicza walidację.
    - `refresh()` – wywołuje zapytanie GET `GET /api/admin/kpi` z aktualnymi parametrami, aktualizuje `loading`, `data`, `lastUpdatedAt`, `error`.
    - `export(format: KpiExportFormat)` – generuje plik CSV/JSON z `state.data` (jeśli dostępne).
  - **Zachowanie**:
    - Inicjalny stan:
      - `range: "7d"`, `group_by: "day"`, brak `from`/`to`.
      - `isPristine: true`, `data: undefined`, `loading: false`, `error: null`.
    - Po zamontowaniu komponentu:
      - Opcja 1 (rekomendowana): od razu wywołać `refresh()` (pokazanie danych domyślnych dla `7d`).
      - Opcja 2: czekać na pierwsze kliknięcie „Odśwież” (jeśli chcemy stricte manualne odpalenie).
    - Przy `refresh()`:
      - Ustawia `loading: true`, czyści `error`, waliduje query; przy błędach walidacji nie odpala requestu, tylko aktualizuje `validationErrors`.
      - Po sukcesie:
        - `data = response`, `lastUpdatedAt = new Date().toISOString()`, `isPristine = false`.
      - Po błędzie:
        - `error` ustawione na `ApiErrorResponse` sparsowane z odpowiedzi.
        - `lastStatusCode` na kod HTTP.
        - Wysyła toast z krótką informacją.

### 7. Integracja API

- **Endpoint**: `GET /api/admin/kpi`.
- **Parametry zapytania**:
  - `range`:
    - `"7d"` (domyślne).
    - `"30d"`.
    - `"custom"` – wymaga pól `from` i `to`.
  - `group_by`:
    - `"day"` – w MVP jedyna obsługiwana wartość, powinna być wysyłana zawsze.
  - Dla `range = "custom"`:
    - `from` – ISO string daty początkowej (np. `2025-12-01T00:00:00.000Z` lub `2025-12-01`).
    - `to` – ISO string daty końcowej.

- **Funkcja serwisowa**:

  ```ts
  async function fetchAdminKpi(params: AdminKpiQueryParams): Promise<AnalyticsKpiResponse> {
    const url = new URL("/api/admin/kpi", window.location.origin);
    url.searchParams.set("range", params.range);
    url.searchParams.set("group_by", params.group_by);
    if (params.range === "custom") {
      if (params.from) url.searchParams.set("from", params.from);
      if (params.to) url.searchParams.set("to", params.to);
    }

    const res = await fetch(url.toString(), { method: "GET" });

    const json = await res.json();

    if (!res.ok) {
      throw { status: res.status, body: json } as { status: number; body: ApiErrorResponse };
    }

    return json as AnalyticsKpiResponse;
  }
  ```

  - Obsługa błędów:
    - Zwraca strukturalny błąd, który hook przemapuje na `ApiErrorResponse` + `statusCode`.

- **Mapowanie odpowiedzi**:
  - `AnalyticsKpiResponse` trafia bezpośrednio do:
    - `KpiCards` (po uproszczeniu/zaokrągleniu liczb).
    - `KpiTrendChart` (po przekształceniu na `KpiTrendPointViewModel`).

- **Kody błędów**:
  - `400 invalid_query` – błąd walidacji zapytania (np. niepoprawne daty).
  - `401 unauthorized` – brak sesji (front pokazuje komunikat i proponuje logowanie).
  - `403 forbidden` – użytkownik nie jest adminem (front pokazuje stan „brak uprawnień”).
  - `500 db_error` / `unexpected_error` – błędy serwera/bazy (front pokazuje ogólny komunikat i przycisk „Spróbuj ponownie”).

### 8. Interakcje użytkownika

- **Wybór zakresu czasu**:
  - Użytkownik wybiera `7 dni`, `30 dni` lub `Zakres własny`.
  - Zmiana zakresu:
    - Aktualizuje `state.query.range`.
    - Dla `Zakres własny` odblokowuje pola dat.

- **Ustawienie zakresu własnego**:
  - Użytkownik wybiera daty `from` i `to`.
  - UI na bieżąco waliduje:
    - Oba pola wypełnione.
    - `from <= to`.
    - Różnica ≤ 90 dni.
  - W przypadku błędu:
    - Pokazuje komunikat błędu pod polami.
    - Dezaktywuje `KpiRefreshButton`.

- **Odświeżenie danych**:
  - Użytkownik klika „Odśwież”.
  - Widok:
    - Ustawia `loading: true`, wyświetla spinner w przycisku i ewentualnie skeletony zamiast treści.
    - Po sukcesie:
      - Aktualizuje karty i wykres.
      - Ustawia `lastUpdatedAt` i pokazuje toast typu „Dane zostały odświeżone”.
    - Po błędzie:
      - Pokazuje `KpiErrorState` oraz toast z krótkim komunikatem.

- **Eksport danych (jeśli w zakresie)**:
  - Użytkownik wybiera „Eksportuj jako CSV/JSON”.
  - Front generuje plik na podstawie `state.data`:
    - CSV – jedna sekcja dla `totals`, druga dla `trend`.
    - JSON – zapisuje `AnalyticsKpiResponse` w całości.

- **Obsługa błędów uprawnień**:
  - W przypadku `403`:
    - Widok informuje, że dostęp mają tylko administratorzy.
    - Filtry i przyciski mogą być zdezaktywowane lub ukryte.
  - W przypadku `401`:
    - Widok pokazuje komunikat „Sesja wygasła, zaloguj się ponownie”.
    - (opcjonalnie) przycisk „Przejdź do logowania”.

### 9. Warunki i walidacja

- **Walidacja zakresu dat po stronie UI**:
  - `range`:
    - Musi być w dozwolonym enumie.
  - `from`/`to`:
    - Dla `range !== "custom"` nie wysyłamy ich w ogóle.
    - Dla `range === "custom"`:
      - Oba muszą być ustawione.
      - `from <= to`.
      - `(to - from) / (1000 * 60 * 60 * 24) <= 90`.
  - Jeśli walidacja zawiedzie:
    - `validationErrors` w stanie hooka jest niepuste.
    - `KpiRefreshButton` jest disabled.

- **Walidacja odpowiedzi z API**:
  - Zakładamy, że backend zwraca poprawną strukturę (walidacja po stronie Supabase/Zod).
  - Dodatkowe sanity checki na froncie:
    - Wartości procentowe muszą być w zakresie `0..1` – w razie odchyleń clampujemy do tego przedziału.
    - Liczniki (`ai`, `manual`, `accepted_ai`) muszą być `>= 0`.

- **Warunki dla stanów UI**:
  - **Loading**:
    - `state.loading === true` – pokazujemy skeletony, przyciski disabled.
  - **Empty**:
    - `!state.loading && !state.error && (!state.data || state.data.totals.ai + state.data.totals.manual === 0)`.
  - **Error**:
    - `!!state.error` – renderujemy `KpiErrorState`.
  - **Normalny widok**:
    - `state.data` dostępne i niepuste – renderujemy `KpiCards` + `KpiTrendChart`.

### 10. Obsługa błędów

- **Błędy walidacji zapytania (400)**:
  - Powód: niepoprawne parametry (`range`, `from`, `to`).
  - UI:
    - Pokazuje komunikat o niepoprawnym zakresie dat.
    - Wyświetla szczegóły, jeśli są w `error.details.issues`.
    - Zostawia użytkownika na tym samym formularzu z możliwością korekty.

- **Brak autentykacji (401)**:
  - UI:
    - Komunikat: „Twoja sesja wygasła lub nie jesteś zalogowany.”
    - (opcjonalnie) przycisk przekierowujący do widoku logowania.

- **Brak uprawnień (403)**:
  - UI:
    - Komunikat: „Tylko administratorzy mają dostęp do dashboardu KPI.”
    - Ukrycie danych (żadnych kart/wykresów).

- **Błędy serwera/bazy (500)**:
  - UI:
    - Ogólny komunikat „Wystąpił błąd podczas pobierania metryk KPI.”
    - Przycisk „Spróbuj ponownie”.
    - Toast z krótką informacją o niepowodzeniu.

- **Błędy sieci (fetch)**:
  - Traktowane podobnie do 500 (brak odpowiedzi).
  - Dodatkowy komunikat „Sprawdź połączenie z internetem”.

### 11. Kroki implementacji

1. **Przygotowanie typów i serwisu API**
   - **Dodać** nowe typy:
     - `AdminKpiRange`, `AdminKpiQueryParams`, `AdminKpiState`, `KpiCardsViewModel`, `KpiTrendPointViewModel`, `KpiExportFormat`.
   - **Umiejscowienie**:
     - Albo w `src/types.ts` (jeśli mają być używane szerzej),
     - Albo w dedykowanym pliku `src/lib/analytics-kpi.types.ts` (zalecane dla separacji).
   - **Stworzyć** funkcję `fetchAdminKpi` w `src/lib/services/admin-kpi.service.ts` wykorzystującą `fetch` i typ `AnalyticsKpiResponse`.

2. **Implementacja hooka `useAdminKpiDashboard`**
   - Plik: `src/components/hooks/useAdminKpiDashboard.ts`.
   - Zaimplementować:
     - Stan `AdminKpiState` z wartościami domyślnymi.
     - Funkcje `setRange`, `setCustomRange`, `refresh`, `export`.
     - Walidację zakresu dat przed wysłaniem zapytania.
     - Obsługę błędów i ustawianie `lastStatusCode`.
   - Zaimplementować integrację z systemem toastów (np. `useToast` / `sonner`).

3. **Struktura komponentów widoku**
   - Utworzyć folder: `src/components/admin/kpi/`.
   - Dodać pliki:
     - `KpiDashboardPage.tsx`
     - `KpiHeader.tsx`
     - `KpiControlsBar.tsx`
     - `KpiRangePicker.tsx`
     - `KpiRefreshButton.tsx`
     - `KpiExportButton.tsx` (opcjonalny, ale warto zaplanować interfejs)
     - `KpiCards.tsx`
     - `KpiTrendChart.tsx`
     - `KpiEmptyState.tsx`
     - `KpiErrorState.tsx`

4. **Implementacja `KpiDashboardPage`**
   - Zaimportować `useAdminKpiDashboard`.
   - Na podstawie `state` renderować odpowiednie komponenty stanu:
     - `KpiHeader` zawsze.
     - `KpiControlsBar` zawsze (z podpiętymi callbackami).
     - Treść:
       - `KpiErrorState` gdy `error`.
       - `KpiEmptyState` gdy brak danych.
       - `KpiCards` + `KpiTrendChart` gdy dane są dostępne.
   - Zaimplementować skeleton/loader (np. używając istniejących komponentów `Skeleton`).

5. **Implementacja komponentów prezentacyjnych**
   - `KpiHeader` – prosty layout na bazie Shadcn/ui (typografia).
   - `KpiControlsBar` – układ flex/grid, przekazywanie propsów do:
     - `KpiRangePicker`,
     - `KpiRefreshButton`,
     - `KpiExportButton`.
   - `KpiRangePicker` – logika UI dla zakresu, integracja z walidacją.
   - `KpiRefreshButton` – stan ładowania i disabled według propsów.
   - `KpiExportButton` – menu eksportu + wywołanie `onExport`.
   - `KpiCards` – przemapowanie `AnalyticsKpiResponse` na `KpiCardsViewModel` i wyświetlenie w kartach.
   - `KpiTrendChart` – prosty wykres na podstawie `KpiTrendPointViewModel`.
   - `KpiEmptyState` i `KpiErrorState` – stany informacyjne z przyciskami akcji.

6. **Dodanie strony Astro**
   - Plik: `src/pages/admin/kpi.astro`.
   - Użyć layoutu aplikacji.
   - Zaimportować i osadzić komponent `KpiDashboardPage` w trybie klientowym (np. `client:load` lub `client:visible`).

7. **Integracja z nawigacją**
   - Jeśli istnieje globalny sidebar/topbar:
     - Dodać link do `/admin/kpi` widoczny tylko dla adminów (lub z ikoną „Admin”).
   - Zadbaj o jasne oznaczenie, że to widok administracyjny.

8. **Testy i weryfikacja**
   - Ręcznie przetestować scenariusze:
     - Admin z danymi w różnych zakresach (7d, 30d, custom, >90d).
     - Brak danych.
     - Błędy 400/401/403/500 (np. wymuszając w środowisku testowym).

9. **Dopracowanie UX i dostępności**
   - Upewnić się, że:
     - Kontrasty, rozmiary czcionek i odstępy są zgodne z resztą aplikacji.
     - Elementy sterujące mają focus states i aria-labels tam, gdzie potrzebne.
     - Komunikaty błędów i stanów pustych są jasne i zrozumiałe.
