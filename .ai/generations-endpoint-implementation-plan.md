## API Endpoint Implementation Plan: POST /api/generations

### 1. Przegląd punktu końcowego

- Cel: Rozpoczęcie asynchronicznego zadania generowania propozycji fiszek przez AI na podstawie dostarczonego, uprzednio oczyszczonego (sanitized) tekstu wejściowego.
- Charakter: Asynchroniczny – tworzy rekord w `generations` i zwraca natychmiast status przyjęcia żądania.
- Ograniczenia biznesowe:
  - Dokładnie jedno aktywne żądanie na użytkownika (status ∈ {pending, running}).
  - Limit 5 utworzeń w ciągu 1 godziny na użytkownika.
- Autoryzacja: Wymagana – użytkownik musi być zalogowany (RLS).
- Dane krytyczne: Tekst wejściowy 1000–10000 znaków, normalizacja i haszowanie dla deduplikacji/audytu.

### 2. Szczegóły żądania

- Metoda HTTP: POST
- Struktura URL: `/api/generations`
- Nagłówki:
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt>` (preferowane) lub sesja przez cookies jeżeli w projekcie zostanie wdrożone SSR-owe ładowanie sesji.
- Parametry:
  - Wymagane (body):
    - `model: string` – identyfikator modelu, np. `openrouter/gpt-4.1-mini`
    - `sanitized_input_text: string` – treść po sanityzacji; długość 1000–10000 znaków
  - Opcjonalne (body):
    - `temperature?: number` – zakres [0, 2], precyzja zgodna z `numeric(3,2)`
- Przykład body:

```json
{
  "model": "openrouter/gpt-4.1-mini",
  "sanitized_input_text": "Sanitized text ...",
  "temperature": 0.7
}
```

### 3. Wykorzystywane typy

- Command modele i DTO (z `src/types.ts`):
  - `CreateGenerationCommand` – request input
  - `GenerationDTO` – reprezentacja rekordu w `generations` (odczyty)
  - `ApiErrorResponse<TCode>` – zunifikowany kształt błędów
- Dodatkowy typ odpowiedzi tego endpointu (lokalny dla handlera):
  - `StartGenerationAccepted`:
    - `id: string` (uuid generacji)
    - `status: "pending"`
    - `enqueued_at: string (ISO)`
    - Uwaga: zwracamy “minimalny” payload potwierdzający przyjęcie – pełny `GenerationDTO` nie jest wymagany.

### 4. Szczegóły odpowiedzi

- 202 Accepted
  - Body:
    ```json
    { "id": "uuid", "status": "pending", "enqueued_at": "2025-11-30T12:34:56.000Z" }
    ```
- Kody błędów:
  - 400 Bad Request: nieprawidłowe dane wejściowe (np. długość/typy)
  - 401 Unauthorized: brak prawidłowego JWT/sesji
  - 409 Conflict: istnieje już aktywne żądanie użytkownika
  - 429 Too Many Requests: przekroczono limit 5/h
  - 500 Internal Server Error: nieoczekiwany błąd serwera/integracji
- Kształt błędów (przykład):
  ```json
  {
    "error": { "code": "active_request_exists", "message": "Active generation already in progress." }
  }
  ```

### 5. Przepływ danych

1. Uwierzytelnienie
   - Pobierz token JWT z `Authorization: Bearer` lub użyj sesji z cookies (jeżeli istnieje SSR integracja).
   - Zweryfikuj użytkownika przez `locals.supabase.auth.getUser(jwt?)`.
   - Brak użytkownika → 401.
2. Walidacja i sanityzacja
   - Zwaliduj body przez Zod (`CreateGenerationCommand`-compatible).
   - Sanityzacja tekstu wejściowego (idempotentna): ujednolicenie końców linii, zbijanie wielokrotnych spacji, trywialne usunięcie niewidocznych znaków kontrolnych; bez modyfikacji semantyki.
   - Zweryfikuj po sanityzacji długość 1000–10000 (spójna z CHECK w DB).
   - Oblicz `sha256` oraz `length` do celów logowania błędów (gdyby insert się nie powiódł).
3. Wczesne sprawdzenia (opcjonalne, “optimistic”)
   - SELECT istniejącej aktywnej generacji (pending/running) dla usera → jeśli jest, zwróć 409 (redukuje koszty, ale DB pozostaje źródłem prawdy).
4. Wstawienie rekordu w `generations`
   - Użyj `locals.supabase` (nie importuj klienta bezpośrednio).
   - Wstaw: `user_id`, `status='pending'`, `model`, `sanitized_input_text`, `temperature?`.
   - Pola generowane przez DB: `sanitized_input_length`, `sanitized_input_sha256`, `created_at`, `updated_at`.
   - Ograniczenia i polityki:
     - RLS wymaga dopasowania `user_id = auth.uid()`.
     - Częściowy UNIQUE index wymusza 1 aktywne żądanie.
     - BEFORE INSERT trigger ogranicza 5 wstawek/h.
   - Mapowanie naruszeń constraintów do 409/429 (szczegóły w sekcji “Obsługa błędów”).
5. “Enqueue” pracy
   - Model przetwarzania asynchronicznego oparty o obserwację nowych rekordów w `generations` o statusie `pending` przez proces “worker” (poza zakresem endpointu).
   - Endpoint nie wywołuje zewnętrznego API synchronizacyjnie.
6. Odpowiedź
   - Zwróć 202 Accepted z `{ id, status: "pending", enqueued_at }`.

### 6. Względy bezpieczeństwa

- Uwierzytelnienie i RLS:
  - Wymagane JWT. Użyj `locals.supabase` i `auth.getUser(jwt?)`.
  - Brak uprawnień → 401. DB RLS zapewnia, że operacje dotyczą zalogowanego użytkownika.
- Walidacja danych:
  - Zod + dodatkowe strażniki długości po sanityzacji.
  - Temperaturę obciąć do [0, 2] i ograniczyć precyzję (np. do 2 miejsc po przecinku).
- Ochrona przed nadużyciami:
  - Limit DB (5/h) + opcjonalny app-level precheck.
  - Rozważ WAF/ratelimiter (np. IP-based) na poziomie reverse proxy w przyszłości.
- Prywatność i logowanie:
  - Do `generation_error_logs` zapisuj hash i długość, a nie pełny tekst (jeśli to możliwe).
  - Nie loguj surowych treści żądań w logach aplikacyjnych.
- Konfiguracja:
  - `export const prerender = false` w pliku endpointu.
  - Sekrety tylko przez `import.meta.env`.

### 7. Obsługa błędów

- Walidacja (400):
  - `length_out_of_range` – tekst po sanityzacji poza 1000–10000.
  - `invalid_payload` – inne naruszenia schematu (np. typy).
- Autoryzacja (401):
  - `unauthorized` – brak/niepoprawny token.
- Konflikt (409):
  - `active_request_exists` – częściowy UNIQUE (status ∈ {pending, running}).
- Limit (429):
  - `hourly_quota_reached` – BEFORE INSERT trigger limitu 5/h.
- Serwer (500):
  - `db_error` – nieznany błąd bazy.
  - `unexpected_error` – nieprzewidziany wyjątek.
- Logowanie błędów (best effort):
  - Przy 409/429/500 zapis do `generation_error_logs`:
    - `user_id`, `model`, `source_text_hash` (sha256 bytes), `source_text_length`, `error_code`, `error_message`.
  - Nie przerywaj odpowiedzi, jeśli logowanie same w sobie zawiedzie.

### 8. Rozważania dotyczące wydajności

- Brak pracy synchronicznej – natychmiast 202 po wstawieniu rekordu.
- Indeksy z planu DB pokrywają najczęstsze operacje; nie dublować sprawdzeń w aplikacji.
- Minimalizacja I/O: jedno INSERT; wczesny SELECT jest opcjonalny.
- Teksty 10k znaków – nie wykonujemy dodatkowych kosztownych transformacji poza sanityzacją i sha256.

### 9. Etapy wdrożenia

1. Walidacja i schematy

- Utwórz `src/lib/validation/generations.schema.ts`:
  - `createGenerationSchema = z.object({ model: z.string().min(1), sanitized_input_text: z.string().min(1000).max(10000), temperature: z.number().min(0).max(2).optional() })`
  - Eksportuj typy inferowane dla użycia w handlerze.

2. Serwisy

- Utwórz `src/lib/services/generations.service.ts`:
  - `sanitizeSourceText(input: string): string` – unifikacja CRLF → LF, trim, zbijanie whitespace, filtr nie-drukowalnych.
  - `startGeneration(supabase, user_id, cmd): Promise<{ id: string; created_at: string }>` – wykonuje INSERT do `generations`.
- Utwórz `src/lib/services/error-logs.service.ts`:
  - `logGenerationError(supabase, payload)` – bezpieczny insert do `generation_error_logs` (bez rzucania wyjątków na błąd logowania).

3. Pomocnicze

- `src/lib/errors.ts` – stałe kodów błędów i funkcje mapujące błędy DB:
  - Mapuj `23505` + nazwa indeksu aktywnej generacji → 409 `active_request_exists`.
  - Mapuj wyjątek triggera limitu 5/h → 429 `hourly_quota_reached` (np. po komunikacie z `message`).
  - Inne kody → 500 `db_error`.

4. Endpoint

- Utwórz `src/pages/api/generations.ts`:
  - `export const prerender = false;`
  - `export async function POST(context) { ... }`
  - Kroki:
    1. Pobierz JWT (Authorization) i `user` przez `locals.supabase.auth.getUser(jwt?)`; brak → 401.
    2. Parsuj body JSON, waliduj Zod; jeśli błąd → 400 `invalid_payload` / `length_out_of_range`.
    3. Sanityzuj tekst; sprawdź długość po sanityzacji (guard).
    4. Opcjonalny precheck aktywnej generacji (SELECT 1 …) → 409.
    5. `INSERT` do `generations` (status `pending`), z `user_id`, `model`, `sanitized_input_text`, `temperature?`.
    6. Na błąd INSERT: zmapuj kod do 409/429/500 i spróbuj logowania do `generation_error_logs` (hash/length/model/user).
    7. Zwróć 202 z `{ id, status: "pending", enqueued_at }`.
  - Zwracaj JSON i ustawiaj `Content-Type: application/json`.

5. Observability

- Minimalne metryki: liczba 202/409/429, histogram długości wejścia, czas INSERT.
- Logi aplikacyjne bez treści użytkownika; dopuszczalne `hash` i `length`.

6. Dokumentacja

- Uzupełnij README lub `/api-plan.md` o realny przykład odpowiedzi 202.
- Opisz oczekiwany bearer JWT i RLS.

7. Zgodność ze stackiem i regułami

- Astro API route z `POST`, `prerender=false`, Zod, użycie `context.locals.supabase`.
- Brak importu `supabaseClient` bezpośrednio w handlerze (zgodnie z zasadami backend).
- Logika w `src/lib/services/*`, a nie w handlerze.

## API Endpoint Implementation Plan: GET /api/generations/:id

### 1. Przegląd punktu końcowego

- Cel: Pobranie statusu pojedynczej generacji AI wraz z metadanymi czasu, zużyciem tokenów oraz zwięzłym podsumowaniem kandydatów (liczności per status).
- Charakter: Odczyt tylko dla właściciela generacji (RLS), dane wrażliwe (pełny tekst wejściowy) nie są ujawniane.
- Autoryzacja: Wymagana – użytkownik musi być zalogowany (RLS). W środowisku dev dopuszczalny fallback `DEFAULT_USER_ID`.

### 2. Szczegóły żądania

- Metoda HTTP: GET
- Struktura URL: `/api/generations/:id`
- Parametry:
  - Wymagane (params):
    - `id: uuid` – identyfikator generacji
  - Opcjonalne (query): brak
- Nagłówki:
  - `Accept: application/json`
  - `Authorization: Bearer <jwt>` (docelowo); w dev możliwy fallback.
- Body: brak

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `GenerationDTO` – pełny kształt encji (do wewnętrznego użycia; nie zwracamy wszystkich pól)
- Nowe DTO (lokalne dla endpointu):
  - `GetGenerationResponse`:
    - `generation`: ograniczona projekcja pól:
      - `id`, `model`, `status`, `temperature`, `prompt_tokens`, `sanitized_input_length`,
      - `started_at`, `completed_at`, `created_at`, `updated_at`,
      - `error_code`, `error_message`
    - `candidates_summary`:
      - `total: number`
      - `by_status: { proposed: number; edited: number; accepted: number; rejected: number }`
  - `GetGenerationParams`:
    - `id: string` (UUID)
- Kody błędów: rozszerzenie `GENERATION_ERROR_CODES` o:
  - `NOT_FOUND: "generation_not_found"`
  - `INVALID_PARAMS: "invalid_params"`

### 4. Szczegóły odpowiedzi

- 200 OK:
  - Body:
    ```json
    {
      "generation": {
        "id": "uuid",
        "model": "openrouter/gpt-4.1-mini",
        "status": "running",
        "temperature": 0.7,
        "prompt_tokens": 1234,
        "sanitized_input_length": 4321,
        "started_at": "2025-12-01T12:00:00.000Z",
        "completed_at": null,
        "created_at": "2025-12-01T11:59:00.000Z",
        "updated_at": "2025-12-01T12:01:00.000Z",
        "error_code": null,
        "error_message": null
      },
      "candidates_summary": {
        "total": 8,
        "by_status": {
          "proposed": 6,
          "edited": 1,
          "accepted": 1,
          "rejected": 0
        }
      }
    }
    ```
- Błędy:
  - 400 Bad Request – `invalid_params` (np. `id` nie jest UUID)
  - 401 Unauthorized – `unauthorized` (brak/nieprawidłowa sesja/JWT)
  - 404 Not Found – `generation_not_found` (brak rekordu dla użytkownika)
  - 500 Internal Server Error – `db_error`/`unexpected_error`

### 5. Przepływ danych

1. Walidacja parametrów
   - Odczytaj `params.id` i zweryfikuj UUID (Zod).
   - Nieprawidłowe `id` → 400 `invalid_params`.
2. Klient Supabase
   - Pobierz klienta z `locals.supabase`. Dla dev fallback: `supabaseServiceClient ?? locals.supabase ?? supabaseClient` (spójnie z POST).
3. Ustalenie użytkownika
   - Docelowo: `locals.supabase.auth.getUser()`/sesja.
   - Dev: `userId = DEFAULT_USER_ID`.
4. Pobranie generacji (projekcja pól)
   - `from("generations").select("id, user_id, model, status, temperature, prompt_tokens, sanitized_input_length, sanitized_input_sha256, started_at, completed_at, created_at, updated_at, error_code, error_message")`
   - Filtry: `.eq("id", id).eq("user_id", userId).maybeSingle()`
   - Brak danych → 404 `generation_not_found`.
5. Podsumowanie kandydatów
   - `from("generation_candidates").select("status").eq("generation_id", id).eq("owner_id", userId)`
   - Złóż agregację po stronie aplikacji do `by_status` i `total`.
6. Odpowiedź 200
   - Zwróć `generation` (bez `sanitized_input_text` ani SHA) oraz `candidates_summary`.
7. Rejestrowanie 500 (opcjonalnie)
   - Jeśli błąd wystąpi po pobraniu generacji, zapisz wpis w `generation_error_logs` używając `sanitized_input_sha256` i `sanitized_input_length`.

### 6. Względy bezpieczeństwa

- RLS: selekcje ograniczone do właściciela. Nawet przy kliencie service-role dodatkowo filtrujemy `.eq("user_id", userId)`/`.eq("owner_id", userId)` aby uniknąć wycieku danych.
- Prywatność: nie zwracamy pola `sanitized_input_text` ani surowego hash-a; tylko `sanitized_input_length` i statusy/kody błędów.
- Autoryzacja: bez ważnej sesji/JWT – 401.
- Nagłówki: `Content-Type: application/json` na odpowiedzi, brak danych wrażliwych w logach.

### 7. Obsługa błędów

- 400 `invalid_params`: nieprawidłowy UUID.
- 401 `unauthorized`: brak sesji/JWT (po wdrożeniu auth).
- 404 `generation_not_found`: rekord nie istnieje lub nie należy do użytkownika.
- 500:
  - `db_error`: błąd PostgREST/PostgreSQL (mapowanie generyczne).
  - `unexpected_error`: inny wyjątek runtime.
- Logowanie:
  - Dla 500 – jeśli znamy rekord generacji: `logGenerationError(supabase, { user_id, model, error_code, error_message, source_text_hash: sanitized_input_sha256, source_text_length: sanitized_input_length })`.
  - W przeciwnym wypadku – tylko log aplikacyjny (bez PII).

### 8. Rozważania dotyczące wydajności

- Pojedynczy SELECT po generacji + jeden SELECT po kandydatach; indeksy (`generations_user_created_idx`, `generation_candidates_generation_status_idx`) pokrywają przypadek.
- Minimalna projekcja kolumn – brak transferu długich pól tekstowych.
- Agregacja kandydatów po stronie aplikacji (mała kardynalność statusów) – tani koszt.

### 9. Etapy wdrożenia

1. Walidacja parametrów
   - Rozszerz `src/lib/validation/generations.schema.ts`:
     ```ts
     export const getGenerationParamsSchema = z.object({ id: z.string().uuid("Invalid generation id") });
     export type GetGenerationParams = z.infer<typeof getGenerationParamsSchema>;
     ```
2. Kody błędów
   - Rozszerz `src/lib/errors.ts` (sekcja `GENERATION_ERROR_CODES`) o:
     - `NOT_FOUND: "generation_not_found"`
     - `INVALID_PARAMS: "invalid_params"`
   - Dodać helper `buildNotFoundGenerationResponse()` (opcjonalnie) lub użyć `buildErrorResponse(404, GENERATION_ERROR_CODES.NOT_FOUND, "...")`.
3. Serwisy
   - Rozszerz `src/lib/services/generations.service.ts`:
     - `getGenerationById(supabase, userId, id)` – pobiera rekord z projekcją oraz pola do logowania (hash/length).
     - `getCandidatesStatuses(supabase, userId, generationId)` – zwraca tablicę `status` i agreguje do `{ total, by_status }`.
4. Endpoint
   - Utwórz `src/pages/api/generations/[id].ts`:
     - `export const prerender = false;`
     - `export const GET: APIRoute = async (context) => { ... }`
     - Kroki:
       1. Validacja `params.id` (Zod) → 400 przy błędzie.
       2. Klient Supabase: `const supabase = supabaseServiceClient ?? locals.supabase ?? supabaseClient;`
       3. Ustalenie `userId` (dev: `DEFAULT_USER_ID`).
       4. `const gen = await getGenerationById(...)` → 404 jeśli brak.
       5. `const summary = await getCandidatesStatuses(...)`.
       6. `return jsonResponse(200, { generation: project(gen), candidates_summary: summary });`
       7. `catch`:
          - Jeśli PostgREST – 500 `db_error`.
          - Inaczej – 500 `unexpected_error`.
          - Jeśli `gen` istnieje – spróbuj `logGenerationError(...)`.
     - Nagłówki: `Content-Type: application/json`.
5. Telemetria i logi
   - Dodać lokalny `recordGenerationEvent` (analogicznie do POST) ze `scope: "api/generations/:id"`, poziomy `info/error`.
6. Mocks i dokumentacja
   - Rozszerz `src/lib/mocks/generations.api.mocks.ts` o przypadki:
     - 200 OK (zróżnicowane statusy kandydatów),
     - 400 invalid_params,
     - 404 not_found,
     - 500 unexpected_error.
   - Uaktualnij `.ai/api-plan.md` sekcję `GET /api/generations/:id` przykładową odpowiedzią 200.
