## API Endpoint Implementation Plan: GET /api/categories

### 1. Przegląd punktu końcowego

Lista kategorii do filtrów i metadanych (chips). Publiczny odczyt z RLS (SELECT dla wszystkich), paginacja kursorem, wyszukiwanie case-insensitive, proste sortowanie.

### 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **URL**: `/api/categories`
- **Parametry zapytania**:
  - **Wymagane**: brak
  - **Opcjonalne**:
    - `search`: string (case-insensitive), szukane w `name` oraz `slug` (przez ILIKE `%term%`)
    - `limit`: int, domyślnie 20, minimalnie 1, maksymalnie 100
    - `cursor`: string, nieprzezroczysty (Base64 zakodowane `id` ostatniego rekordu z poprzedniej strony)
    - `sort`: enum `name | created_at` (domyślnie `name`, rosnąco). Dodatkowy tie-breaker po `id ASC`.
- **Request Body**: brak
- **Nagłówki**: `Content-Type: application/json` w odpowiedzi

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `CategoryDTO`
  - `CategoryListResponse`
  - `ApiErrorResponse<TCode>`
- Nowe (wewnętrzne dla endpointu):
  - `CategoriesQuery` (typ wejścia po walidacji)
  - `CATEGORIES_ERROR_CODES` (lokalny enum kodów błędów w pliku endpointu)

### 4. Szczegóły odpowiedzi

- **Sukces – 200 OK**
  - Struktura:
    ```json
    {
      "data": [
        {
          "id": 12,
          "name": "Networking",
          "slug": "networking",
          "description": "...",
          "color": "#3366FF",
          "created_at": "...",
          "updated_at": "..."
        }
      ],
      "page": { "next_cursor": "MTI=", "has_more": true }
    }
    ```
  - `next_cursor`: Base64 z `String(id)` ostatniego rekordu zwróconego na stronie; `null` jeśli brak kolejnej strony.
- **Błędy**
  - 400 `invalid_query`
  - 401 `unauthorized` (teoretycznie rzadkie dla publicznych danych, ale zwracane, gdy token jest nieprawidłowy i klient wymusza autoryzację)
  - 429 `rate_limit_exceeded`
  - 500 `db_error` / `unexpected_error`

### 5. Przepływ danych

1. Middleware (`src/middleware/index.ts`) dołącza `locals.supabase`.
2. Handler `GET` w `src/pages/api/categories.ts`:
   - `export const prerender = false`
   - Pobranie `supabase` z `context.locals.supabase` (fallback: `supabaseClient`)
   - Parsowanie i walidacja parametrów przez Zod
   - Wywołanie serwisu `listCategories` z przetworzonym `query`
   - Zbudowanie odpowiedzi `CategoryListResponse`
3. Serwis `src/lib/services/categories.service.ts`:
   - Buduje zapytanie z filtrami (`search` przez `ilike` na `name` i `slug`)
   - Paginacja kursorem: jeśli `cursor` → `gt("id", lastId)`
   - Sortowanie: `order(sort, { ascending: true }).order("id", { ascending: true })`
   - `limit + 1` rekordów do detekcji `has_more`
   - Mapowanie do `CategoryDTO`
4. Zwrócenie JSON z nagłówkiem `Content-Type: application/json`

### 6. Względy bezpieczeństwa

- RLS dla `categories`: `SELECT USING (true)` – publiczny odczyt. Brak wymogu autoryzacji dla tego endpointu.
- Uwierzytelnianie: jeśli w przyszłości wymagane (np. do metryk użytkownika), handler powinien zwrócić 401 przy braku ważnego JWT.
- Walidacja danych wejściowych Zod, wczesne zwracanie 400 przy nieprawidłowych parametrach (np. zły `cursor`, `limit` poza zakresem).
- Ochrona przed SQL injection: zapytania przez Supabase query builder; brak interpolacji surowych stringów do SQL.
- Rate limiting: lekki limiter per-IP w pamięci procesu dla `GET /api/categories` (np. 60 żądań/min). W środowiskach wieloinstancyjnych konieczny współdzielony store (Redis) – poza zakresem tej iteracji.
- CORS: korzystamy z domyślnych ustawień Astro; w razie potrzeby doprecyzować nagłówki w middleware.

### 7. Obsługa błędów

- 400 – `invalid_query`:
  - Niepoprawny `limit`/`cursor`/`sort`/`search` (np. Base64 niepoprawne lub `cursor` nie jest liczbą dodatnią).
- 401 – `unauthorized`:
  - Jeżeli w przyszłości endpoint będzie wymagał autoryzacji i brak poprawnego JWT.
- 429 – `rate_limit_exceeded`:
  - Przekroczenie limitu zapytań per-IP (lokalny limiter).
- 500 – `db_error` / `unexpected_error`:
  - Błędy PostgREST/Supabase lub inne nieprzewidziane wyjątki.
- Kształt odpowiedzi błędów: `ApiErrorResponse<TCode>` poprzez `buildErrorResponse(...)` z `src/lib/errors.ts`.
- Logowanie:
  - Brak wpisów do `generation_error_logs` (nieadekwatne dla kategorii).
  - Minimalne logi serwerowe `console.info` dla 4xx oraz `console.error` dla 5xx (z kontekstem żądania, bez PII).

### 8. Rozważania dotyczące wydajności

- Indeksy:
  - `categories.slug` jest unikalny; dla `search` sugerowany GIN `pg_trgm` na `lower(name)` i `lower(slug)` przy wzroście wolumenu (dla ILIKE). Na start – brak konieczności (mała tabela).
- Paginacja kursorem:
  - Keyset po `id` zapewnia stały koszt stronicowania; `has_more` przez `limit + 1`.
  - Sort: `name`/`created_at` z tie-breakerem po `id` utrzymuje deterministyczną kolejność stron.
- Limit maks. 100; domyślne 20.
- Brak dołączania ciężkich powiązań – zwracamy wyłącznie kolumny kategorii.

### 9. Etapy wdrożenia

1. Przygotowanie walidacji zapytania
   - Zdefiniuj schemat walidacji parametrów zapytania obejmujący: `search`, `limit`, `cursor`, `sort`.
   - Zapewnij domyślne wartości i ograniczenia zakresów (limit: 1–100, domyślnie 20).
   - Zaimplementuj bezpieczne dekodowanie kursora (Base64 → id) oraz obsłuż przypadki pustego/niepoprawnego kursora.
   - Kryteria akceptacji: błędne parametry skutkują statusem 400 z kodem `invalid_query` oraz zrozumiałym komunikatem.

2. Warstwa serwisowa dla bazy danych
   - Utwórz serwis odpowiedzialny za budowę zapytania do tabeli `categories`.
   - Zaimplementuj filtrowanie `search` (case-insensitive) po `name` i `slug`.
   - Wdróż paginację keyset (po `id`) z logiką `limit + 1` do ustalenia `has_more`.
   - Wprowadź sortowanie po `name` lub `created_at` z tie-breakerem `id` (deterministyczność wyników).
   - Zwracaj wyłącznie wymagane kolumny oraz metadane paginacji (`hasMore`, `nextCursor`).
   - Błędy bazy danych propaguj do warstwy API (bez ich maskowania).

3. Endpoint API
   - Utwórz handler `GET` zgodny z konwencją Astro (SSR, `prerender = false`).
   - Korzystaj z `context.locals.supabase`; jeśli niedostępny, zwróć 500.
   - Odczytaj i zweryfikuj parametry zapytania za pomocą walidatora z kroku 1.
   - W przypadku niepoprawnego kursora lub limitu zwróć 400 (`invalid_query`).
   - Wywołaj serwis z kroku 2 i zmapuj wynik do `CategoryListResponse`.
   - Ustaw nagłówek `Content-Type: application/json` i zwróć 200.

4. Jakość, zgodność i dokumentacja
   - Uruchom lintery/typy; usuń ostrzeżenia i błędy.
   - Sprawdź zgodność z zasadami clean code (wczesne zwroty, brak zbędnych `else`).
   - Uzupełnij dokumentację API (opis parametrów, kody odpowiedzi, przykłady zapytań).

5. Obserwowalność i logowanie
   - Dodaj lekkie, ustrukturyzowane logi: żądania 4xx (info) i 5xx (error) z minimalnym kontekstem.
