## API Endpoint Implementation Plan: Categories API (`/api/categories`)

Dokument opisuje wdrożenie i utrzymanie endpointów REST dla zasobu **categories** w 10x-cards (Astro 5 + TypeScript + Supabase + Zod).

### 1. Przegląd punktu końcowego

Zasób `categories` służy do:

- filtrowania kart i prezentacji metadanych (chips),
- zarządzania słownikiem kategorii (admin – planowane).

W bazie (`categories`):

- `id` (bigserial, PK),
- `name` (citext, UNIQUE, NOT NULL),
- `slug` (text, UNIQUE, regex `^[a-z0-9-]+$`, NOT NULL),
- `description` (nullable),
- `color` (nullable, regex `^#[0-9A-Fa-f]{6}$`),
- `created_at`, `updated_at` (timestamptz).

RLS:

- **SELECT**: `USING (true)` – publiczny odczyt,
- **INSERT/UPDATE/DELETE**: tylko admin (`WITH CHECK (is_admin())`).

---

## GET `/api/categories`

### 1. Przegląd punktu końcowego

Publiczna lista kategorii do filtrów/metadanych. Endpoint jest już zaimplementowany w `src/pages/api/categories.ts` i korzysta z:

- walidacji Zod (`src/lib/validation/categories.schema.ts`),
- serwisu DB (`src/lib/services/categories.service.ts`),
- ustrukturyzowanych odpowiedzi błędów (`src/lib/errors.ts`),
- ustrukturyzowanych logów zdarzeń (lokalnie w pliku endpointu; scope `api/categories`).

### 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/categories`
- **Parametry**:
  - **Wymagane**: brak
  - **Opcjonalne** (zgodnie z `categoriesQuerySchema` i specyfikacją):
    - `search` (string, max 200): trim; pusty string traktowany jak brak; wyszukiwanie case-insensitive przez `ILIKE` po `name` i `slug`
    - `limit` (int, domyślnie 20, zakres 1..100)
    - `cursor` (string): Base64 kodujące dodatnie `id` ostatniego rekordu z poprzedniej strony
    - `sort` (enum: `name|created_at`, domyślnie `name`)
- **Request Body**: brak

**Wymóg “publiczności” wg specyfikacji**: middleware (`src/middleware/index.ts`) nie powinien przekierowywać na login dla tego endpointu. Zalecane podejście:

- dodać `/api/categories` do `PUBLIC_PATHS`, **albo** (preferowane długofalowo)
- zawsze tworzyć `locals.supabase` w middleware, a redirect wykonywać tylko dla ścieżek wymagających sesji (UI i prywatne API).

### 3. Wykorzystywane typy

- **DTO**: `CategoryDTO`
- **Response**: `CategoryListResponse` (`PaginatedResponse<CategoryDTO>`)
- **Błędy**: `ApiErrorResponse<CategoryErrorCode>`
- **Walidacja**: `CategoriesQuery` / `CategoriesQuerySchema` (z `src/lib/validation/categories.schema.ts`)

### 4. Szczegóły odpowiedzi

- **200 OK**: `CategoryListResponse`
  - `page.next_cursor` = Base64 z `String(id)` ostatniego elementu strony, albo `null`
  - `page.has_more` = `true`, jeśli znaleziono więcej rekordów niż `limit` (logika `limit + 1`)
- **400 Bad Request**: `invalid_query`
- **500 Internal Server Error**:
  - `db_error` (błędy PostgREST / Supabase)
  - `unexpected_error` (inne wyjątki)

> Uwaga: `CATEGORY_ERROR_CODES` zawiera również `unauthorized` i `rate_limit_exceeded`, ale GET obecnie ich nie używa (rate-limit nie jest wdrożony w kodzie).

### 5. Przepływ danych

1. Handler `GET` pobiera surowe query paramy jako stringi.
2. Zod `categoriesQuerySchema.safeParse(...)` waliduje/normalizuje wartości (np. domyślny `limit`, domyślny `sort`).
3. `buildCategoriesQuery(...)` dekoduje `cursor` (Base64 → dodatni int) lub rzuca `InvalidCategoryCursorError`.
4. `listCategories(supabase, query)` buduje zapytanie Supabase:
   - `order(query.sort ASC).order(id ASC)`
   - `search` przez `or(name.ilike...,slug.ilike...)` z `escapeIlikePattern`
   - cursor przez `gt("id", cursor)`
   - `limit(query.limit + 1)`
5. Handler mapuje wynik na `CategoryListResponse` i zwraca JSON.
6. Przy błędach – zwraca `ApiErrorResponse` i zapisuje event (`recordCategoriesEvent`) do stdout (JSON).

### 6. Względy bezpieczeństwa

- **RLS** zapewnia publiczny odczyt, ale middleware nie może blokować endpointu redirectem.
- **Walidacja wejścia**: pełna walidacja przez Zod (łącznie z ograniczeniem długości `search` i zakresem `limit`).
- **Pattern injection**: `escapeIlikePattern` ogranicza ryzyko “dzikich kart” w `ILIKE`.
- **Brak logowania PII**: logi zdarzeń zawierają wyłącznie metadane techniczne (kody, statusy, zanonimizowane parametry).

### 7. Obsługa błędów

- **400** `invalid_query`:
  - `limit` nie-int / poza zakresem
  - `sort` spoza enum
  - `cursor` nie-Base64 lub nie dekoduje się do dodatniego int
- **500**:
  - `db_error`: `PostgrestError` (np. błąd query)
  - `unexpected_error`: każdy inny błąd wykonania (np. błąd dekodowania kursora poza znanymi przypadkami)

Rejestrowanie błędów w tabeli `generation_error_logs` **nie dotyczy** (to endpoint bez AI).

### 8. Wydajność

- **Paginacja**: `limit + 1` i `has_more` bez kosztownych COUNT.
- **Indeksy**: dla małej tabeli OK; przy wzroście i częstym `ILIKE` rozważyć `pg_trgm` na `name`/`slug`.
- **Istotne ograniczenie** (do rozważenia w przyszłości):
  - cursor bazuje tylko na `id`, a sortowanie może być po `name` lub `created_at`. W skrajnych przypadkach przy danych “przeplatanych” może prowadzić do pominięć/duplikacji między stronami.
  - Jeśli to stanie się problemem, rekomendacja: zmienić format kursora na Base64 kodujące parę `(sort_value, id)` (keyset po dwóch kolumnach).

### 9. Kroki implementacji

1. Dostosować middleware do publicznego GET (brak redirect dla `/api/categories`).
2. Utrzymać walidację i logikę kursora w `src/lib/validation/categories.schema.ts`.
3. Utrzymać query builder w `src/lib/services/categories.service.ts` (w tym `escapeIlikePattern`).
4. Utrzymać spójność odpowiedzi błędów przez `buildErrorResponse`.
5. (Opcjonalnie) dodać realny rate limit i wtedy użyć `rate_limit_exceeded`.

---

## POST `/api/categories` (admin – planned)

### 1. Przegląd punktu końcowego

Utworzenie nowej kategorii. Dostęp wyłącznie dla admina (RLS + jawna autoryzacja po stronie API).

Implementacja docelowo w `src/pages/api/categories.ts` jako `export const POST`.

### 2. Szczegóły żądania

- **Metoda HTTP**: POST
- **Struktura URL**: `/api/categories`
- **Parametry**:
  - **Wymagane**: brak
  - **Opcjonalne**: brak
- **Request Body (JSON)**:
  - `name` (string, wymagane, <= 255; zalecenie: min 1, trim)
  - `slug` (string, wymagane, regex `^[a-z0-9-]+$`)
  - `description` (string, opcjonalne)
  - `color` (string, opcjonalne, regex `^#[0-9A-Fa-f]{6}$`)

### 3. Wykorzystywane typy

- **Command**: `CreateCategoryCommand` (z `src/types.ts`)
- **DTO**: `CategoryDTO`
- **Błędy**: `ApiErrorResponse<...>` (zalecane rozszerzenie `CategoryErrorCode` o kody dla CRUD)

### 4. Szczegóły odpowiedzi

- **201 Created**: `CategoryDTO` nowo utworzonej kategorii
- **400 Bad Request**:
  - `invalid_body` (niepoprawny JSON / naruszenie walidacji Zod)
- **401 Unauthorized**: brak sesji
- **403 Forbidden**: użytkownik nie jest adminem
- **409 Conflict**:
  - `slug_taken` / `name_taken` (unikalność)
  - alternatywnie: `constraint_violation` (gdy nie da się precyzyjnie rozpoznać constraintu)
- **500 Internal Server Error**:
  - `db_error` / `unexpected_error`

### 5. Przepływ danych

1. Handler pobiera `locals.supabase` (bez fallbacku do anon klienta) i wymusza sesję (`locals.user`).
2. Autoryzacja admina:
   - `supabase.rpc("is_admin")` → jeśli `false`, zwrócić 403.
3. Walidacja body przez Zod (nowy schema – patrz “Kroki implementacji”).
4. Serwis DB `createCategory(supabase, payload)`:
   - `insert(...)` do `categories`, najlepiej z `.select(CATEGORY_COLUMNS).single()` aby zwrócić w jednym round-tripie rekord DTO
5. Mapowanie rekord → `CategoryDTO`.
6. Mapowanie błędów DB do 409/500 (zalecane dodać `mapCategoryDbError` analogicznie do `mapFlashcardDbError`).

### 6. Względy bezpieczeństwa

- **CSRF**: jeżeli endpoint będzie wywoływany z przeglądarki cookie-based, rozważyć token CSRF lub sprawdzanie `Origin`/`SameSite` (w zależności od modelu auth).
- **RLS**: nawet przy błędzie w kodzie, DB zablokuje zapis dla nie-admina; API powinno zwracać czytelne 403.
- **Walidacja slug i color**: w API (Zod) + w DB (CHECK) – podwójna obrona.

### 7. Obsługa błędów

- Zod → 400 `invalid_body` z listą issues w `details`
- PostgREST:
  - `23505` (unique) → 409 (`slug_taken`/`name_taken`)
  - inne → 500 `db_error`

### 8. Wydajność

- INSERT + RETURNING (`.select(...).single()`) ogranicza liczbę zapytań.
- Dla małej tabeli brak wąskich gardeł; ważne jest tylko unikanie dodatkowych “pre-checków” unikalności, które i tak wyścigują (race condition).

### 9. Kroki implementacji

1. Dodać schema walidacji body, np. w `src/lib/validation/categories.schema.ts`:
   - `createCategoryBodySchema`
2. Rozszerzyć `src/lib/services/categories.service.ts` o `createCategory(...)`.
3. Rozszerzyć `src/lib/errors.ts`:
   - nowe kody błędów kategorii (CRUD),
   - `mapCategoryDbError(error: PostgrestError)` (unikalność/constrainty → 409, reszta → 500).
4. Dodać `POST` do `src/pages/api/categories.ts`:
   - `prerender = false`,
   - wymuszenie `locals.supabase` i `locals.user`,
   - `is_admin` przez RPC,
   - walidacja JSON body,
   - wywołanie serwisu,
   - log eventów (scope `api/categories`).
5. Dodać mocki kontraktowe w `src/lib/mocks/categories.api.mocks.ts` (201/400/401/403/409/500).

---

## PATCH `/api/categories/:id` (admin – planned)

### 1. Przegląd punktu końcowego

Częściowa aktualizacja kategorii po ID (bigint). Dostęp admin-only.

Docelowy plik: `src/pages/api/categories/[id].ts` z handlerem `PATCH`.

### 2. Szczegóły żądania

- **Metoda HTTP**: PATCH
- **Struktura URL**: `/api/categories/:id`
- **Parametry**:
  - **Wymagane**: `id` (path, dodatni int)
  - **Opcjonalne**: brak
- **Request Body (JSON)**: co najmniej jedno z pól:
  - `name?`
  - `slug?`
  - `description?`
  - `color?` (może być `null`, jeśli chcemy “wyczyścić” kolor – do decyzji kontraktu)

### 3. Wykorzystywane typy

- **Command**: `UpdateCategoryCommand`
- **DTO**: `CategoryDTO`
- **Błędy**: `ApiErrorResponse<...>`

### 4. Szczegóły odpowiedzi

- **200 OK**: zaktualizowany `CategoryDTO`
- **400 Bad Request**: `invalid_body` / `invalid_query` (np. złe `id`)
- **401 Unauthorized**: brak sesji
- **403 Forbidden**: brak uprawnień admin
- **404 Not Found**: `not_found`
- **409 Conflict**: `constraint_violation` / `slug_taken` / `name_taken`
- **500 Internal Server Error**: `db_error` / `unexpected_error`

### 5. Przepływ danych

1. Walidacja param `id` przez Zod (np. `z.object({ id: z.string().regex(/^\d+$/) ... })` + parseInt > 0).
2. Wymuszenie sesji + `is_admin`.
3. Walidacja body (schema “partial”, z warunkiem “min 1 field”).
4. Serwis `updateCategoryById(supabase, id, patch)`:
   - `.update(patch).eq("id", id).select(CATEGORY_COLUMNS).maybeSingle()`
   - jeśli brak rekordu → 404
5. Mapowanie błędów DB do 409/500.

### 6. Względy bezpieczeństwa

- Brak masowych update’ów: update zawsze ograniczony przez `.eq("id", id)`.
- Walidacja `slug`/`color` i ograniczeń tekstu.
- Logowanie bez PII.

### 7. Obsługa błędów

- 404: brak rekordu o danym `id`
- 409: konflikty unikalności / check constraint
- 500: błędy Supabase/PostgREST

### 8. Wydajność

- pojedynczy UPDATE + RETURNING; brak dodatkowych round-tripów.

### 9. Kroki implementacji

1. Dodać schema `categoryIdParamSchema` oraz `updateCategoryBodySchema` (partial + “at least one field”).
2. Dodać `updateCategoryById(...)` w `categories.service.ts`.
3. Dodać `src/pages/api/categories/[id].ts`:
   - `PATCH` + wspólne helpery (jsonResponse, isPostgrestError, event logger).
4. Rozszerzyć mocki.

---

## DELETE `/api/categories/:id` (admin – planned)

### 1. Przegląd punktu końcowego

Usunięcie kategorii po ID. Dostęp admin-only. Usuwanie jest “hard delete”, ale może być zablokowane przez FK (np. karty z `category_id`).

### 2. Szczegóły żądania

- **Metoda HTTP**: DELETE
- **Struktura URL**: `/api/categories/:id`
- **Parametry**:
  - **Wymagane**: `id` (path, dodatni int)
- **Request Body**: brak

### 3. Wykorzystywane typy

- **Błędy**: `ApiErrorResponse<...>`

### 4. Szczegóły odpowiedzi

- **204 No Content**: usunięto
- **400 Bad Request**: `invalid_query` (złe `id`)
- **401 Unauthorized**: brak sesji
- **403 Forbidden**: brak uprawnień admin
- **404 Not Found**: `not_found`
- **409 Conflict**: `category_in_use` (FK)
- **500 Internal Server Error**: `db_error` / `unexpected_error`

### 5. Przepływ danych

1. Walidacja `id`.
2. Wymuszenie sesji + `is_admin`.
3. Serwis `deleteCategoryById(supabase, id)`:
   - `.delete().eq("id", id).select("id").maybeSingle()`
   - jeśli brak → 404
4. Jeśli DB zwróci FK violation (`23503`) → 409 `category_in_use`.

### 6. Względy bezpieczeństwa

- Tylko admin.
- Brak możliwości usunięcia “wszystkiego” – zawsze po `id`.

### 7. Obsługa błędów

- 23503 (foreign key violation) → 409 `category_in_use`
- inne PostgREST → 500 `db_error`

### 8. Wydajność

- Jedno zapytanie DELETE; brak dodatkowych joinów.

### 9. Kroki implementacji

1. Dodać `deleteCategoryById(...)` do `categories.service.ts`.
2. Rozszerzyć `mapCategoryDbError` o obsługę `23503` → 409 `category_in_use`.
3. Dodać `DELETE` handler w `src/pages/api/categories/[id].ts`.
4. Rozszerzyć mocki kontraktowe (204/400/401/403/404/409/500).
