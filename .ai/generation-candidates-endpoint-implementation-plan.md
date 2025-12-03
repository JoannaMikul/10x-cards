## API Endpoint Implementation Plan: POST /api/generation-candidates/:id/accept

### 1. Przegląd punktu końcowego

- Cel: przyjęcie pojedynczego kandydata i utworzenie z niego finalnej fiszki (tabela `flashcards`) wraz z przypisaniem `accepted_card_id` w `generation_candidates`.
- Zakres: mutacja (POST) z atomowym efektem końcowym: utworzona fiszka + zaktualizowany kandydat. Operacja wykonywana jest W TRANSAKCJI w bazie danych (RPC Postgres), dzięki czemu w przypadku niepowodzenia nie powstają żadne trwałe skutki (pełny rollback).
- Reguły:
  - Dozwolone `origin`: tylko `"ai-full"` lub `"ai-edited"`. Domyślnie:
    - `"ai-edited"` gdy kandydat ma status `edited`,
    - w przeciwnym razie `"ai-full"`.
  - Kiedy `accepted_card_id` jest już ustawione → 409 `already_accepted`.
  - Konflikt odcisku (`front_back_fingerprint`) z istniejącą aktywną fiszką użytkownika → 422 `fingerprint_conflict`.

### 2. Szczegóły żądania

- Metoda HTTP: POST
- URL: `/api/generation-candidates/:id/accept`
- Parametry:
  - Wymagane (path):
    - `id` (UUID) – identyfikator kandydata
  - Opcjonalne (body – nadpisania metadanych):
    - `category_id?: number`
    - `tag_ids?: number[]`
    - `content_source_id?: number`
    - `origin?: "ai-full" | "ai-edited"`
- Nagłówki:
  - `Content-Type: application/json`
- Body (przykład):

```json
{ "category_id": 1, "tag_ids": [2], "content_source_id": 5, "origin": "ai-edited" }
```

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `GenerationCandidateDTO`
  - `FlashcardDTO`
  - `AcceptGenerationCandidateCommand`:
    - `category_id?: number`
    - `tag_ids?: number[]`
    - `content_source_id?: number`
    - `origin?: Enums<"card_origin">` (używane wyłącznie z wartościami `"ai-full" | "ai-edited"`)
  - `CreateFlashcardCommand` (wykorzystane przez serwis tworzenia fiszki)
- Nowe/rozszerzone w warstwie walidacji (Zod):
  - `getCandidateParamsSchema`: `{ id: z.string().uuid() }`
  - `acceptGenerationCandidateSchema`:
    - `category_id?: positiveInt`
    - `tag_ids?: array<positiveInt> (unikatowe, max 50)`
    - `content_source_id?: positiveInt`
    - `origin?: z.enum(["ai-full","ai-edited"])`

### 4. Szczegóły odpowiedzi

- 201 Created
  - Treść: `FlashcardDTO` (pełny DTO nowo utworzonej fiszki)
- Błędy:
  - 400 `invalid_body` – nieprawidłowy JSON / niezgodny z Zod
  - 401 `unauthorized` – brak kontekstu użytkownika (docelowo)
  - 404 `not_found` – kandydat nie istnieje lub nie należy do użytkownika
  - 409 `already_accepted` – kandydat ma już ustawione `accepted_card_id` (lub status `accepted`)
  - 422 `fingerprint_conflict` – istnieje aktywna fiszka użytkownika o tym samym odcisku
  - 422 `unprocessable_entity` – niepoprawne referencje (kategoria/źródło/tagi) podczas tworzenia fiszki
  - 500 `db_error` / `unexpected_error` – błąd DB lub inny nieoczekiwany wyjątek

### 5. Przepływ danych

1. Kontekst i walidacja:
   - Pobierz `supabase` z `locals` (fallback do globalnego klienta) i ustal `userId` (na dziś `DEFAULT_USER_ID`).
   - Waliduj `params.id` (UUID) → w przeciwnym wypadku 400.
   - Odczytaj i waliduj body `acceptGenerationCandidateSchema` → w przeciwnym wypadku 400.
2. Pobranie kandydata:
   - `select id, generation_id, owner_id, front, back, status, front_back_fingerprint, accepted_card_id, suggested_category_id, suggested_tags`
   - Filtr: `.eq("id", id).eq("owner_id", userId)` → jeśli brak, 404.
   - Jeśli `accepted_card_id` już ustawione lub `status = 'accepted'` → 409.
3. Wykrycie konfliktu odcisku:
   - Zapytanie do `flashcards`: `.eq("owner_id", userId).eq("front_back_fingerprint", candidate.front_back_fingerprint).is("deleted_at", null).select("id", { head: true, count: "exact" })`
   - Gdy `count > 0` → 422 `fingerprint_conflict` (uniknięcie późniejszego 409 z unikalności).
4. Ustalenie efektywnych metadanych:
   - `effective.origin = body.origin ?? (candidate.status === "edited" ? "ai-edited" : "ai-full")`
   - `effective.category_id = body.category_id ?? candidate.suggested_category_id ?? null`
   - `effective.tag_ids = body.tag_ids ?? (Array.isArray(candidate.suggested_tags) ? candidate.suggested_tags : [])`
   - `effective.content_source_id = body.content_source_id ?? null`
   - `effective.metadata` – obiekt z pochodzeniem: `{ accepted_from_candidate_id: candidate.id, generation_id: candidate.generation_id, candidate_fingerprint: candidate.front_back_fingerprint }`
5. Akceptacja w transakcji (RPC Postgres):
   - Wywołaj funkcję SQL (RPC) np. `accept_generation_candidate` z parametrami:
     - `p_owner_id = userId`,
     - `p_candidate_id = candidate.id`,
     - `p_origin = effective.origin`,
     - `p_category_id = effective.category_id`,
     - `p_tag_ids = effective.tag_ids`,
     - `p_content_source_id = effective.content_source_id`,
     - `p_metadata = effective.metadata`.
   - Wewnątrz funkcji (pojedyncza transakcja):
     - `SELECT ... FOR UPDATE` kandydata właściciela; walidacja statusu/`accepted_card_id`.
     - Weryfikacja konfliktu odcisku z aktywnymi fiszkami (lub poleganie na unikalnym indeksie i mapowanie 23505).
     - Utworzenie rekordu `flashcards` (front/back/origin/kategorie/źródło/metadata).
     - Ewentualne powiązania tagów (jeśli istnieje tabela łącząca).
     - Aktualizacja kandydata: `status = 'accepted'`, `accepted_card_id = newCardId`, `updated_at = now()`.
     - Zwrócenie `newCardId` (lub całego wiersza fiszki).
   - Wszelkie błędy skutkują ROLLBACK – brak osieroconych rekordów.
6. Dociągnięcie `FlashcardDTO`:
   - Po sukcesie RPC pobierz pełny `FlashcardDTO` po `newCardId` (np. z widoku lub przez serwis `getFlashcardById`), w tym tagi.
7. Odpowiedź:
   - 201 z `FlashcardDTO`.
8. Telemetria:
   - Logowanie zdarzeń konsolowych `scope: "api/generation-candidates/:id/accept"` (poziom wg statusu HTTP).

### 6. Względy bezpieczeństwa

- RLS: dostęp do `generation_candidates` i `flashcards` ograniczony do właściciela (`owner_id = auth.uid()`) lub admina.
- Funkcja RPC powinna działać jako `SECURITY INVOKER`, aby respektować RLS. Jeśli endpoint używa klucza service-role (RLS wyłączone), funkcja MUSI jawnie weryfikować `owner_id = p_owner_id` na każdym kroku.
- Walidacja wejścia (Zod) zapobiega nieprawidłowym typom i zbyt długim wartościom.
- Brak ujawniania surowych detali błędów DB – mapowanie do kontrolowanych kodów.
- Docelowo: zamiast `DEFAULT_USER_ID`, użyć `locals.supabase.auth.getUser()` i zwracać 401 przy braku użytkownika.

### 7. Obsługa błędów

| Status | `error.code`           | Sytuacja                                               |
| ------ | ---------------------- | ------------------------------------------------------ |
| 400    | `invalid_body`         | Niepoprawny JSON / niezgodny ze schematem Zod          |
| 401    | `unauthorized`         | Brak kontekstu użytkownika (docelowo)                  |
| 404    | `not_found`            | Kandydat nie istnieje lub nie należy do użytkownika    |
| 409    | `already_accepted`     | Kandydat został już zaakceptowany                      |
| 422    | `fingerprint_conflict` | Istnieje aktywna fiszka z tym samym odciskiem          |
| 422    | `unprocessable_entity` | Nieprawidłowe referencje (FK) podczas tworzenia fiszki |
| 500    | `db_error`             | Błąd bazy (PostgREST/Postgres)                         |
| 500    | `unexpected_error`     | Inny nieoczekiwany błąd                                |

### 8. Rozważania dotyczące wydajności

- Pre-check konfliktu odcisku używa indeksu częściowego `flashcards_owner_fingerprint_unique` (z filtrem `deleted_at is null`).
- Pojedyncze wywołanie RPC redukuje round‑tripy i eliminuje koszt „sprzątania”.
- Unikamy JOINów; pełny DTO dociągamy po sukcesie RPC w osobnym, prostym zapytaniu.
- Minimalna projekcja kolumn dla kandydata i brak zbędnych odczytów.
- Krótkie, deterministyczne ścieżki błędów – wczesne zwroty.

### 9. Etapy wdrożenia

1. Walidacja (rozszerzenie istniejącego lub nowy plik): `src/lib/validation/generation-candidates.schema.ts`
   - `getCandidateParamsSchema` (jeśli nie istnieje)
   - `acceptGenerationCandidateSchema` (positiveInt, tagIds – analogicznie do `flashcards.schema.ts`, ale z `origin` ograniczonym do `"ai-full" | "ai-edited"`)
2. Błędy (rozszerzenie): `src/lib/errors.ts`
   - `CANDIDATE_ACCEPT_ERROR_CODES = { INVALID_BODY, UNAUTHORIZED, NOT_FOUND, ALREADY_ACCEPTED, FINGERPRINT_CONFLICT, UNPROCESSABLE_ENTITY, DB_ERROR, UNEXPECTED_ERROR } as const`
   - (Lokalny handler) `mapAcceptFlashcardDbError(error)` – mapuje:
     - 23505 (unikalność odcisku) → `422 fingerprint_conflict`,
     - 23503 (FK) → `422 unprocessable_entity`,
     - custom `P0001`/`raise exception` z funkcji (np. `already_accepted`) → odpowiedni kod (409/422),
     - pozostałe → `500 db_error`.
3. Serwis (nowe funkcje): `src/lib/services/generation-candidates.service.ts`
   - `getCandidateForOwner(supabase, userId, id)` – pobiera i zwraca wymagane pola kandydata.
   - `hasFingerprintConflict(supabase, userId, fingerprint)` – pre-check konfliktu w `flashcards` (aktywnych) – opcjonalny (dla lepszego UX), nie wymagany dla atomowości.
   - `acceptCandidateForOwner(supabase, userId, id, overrides)`:
     - zbudowanie efektywnych metadanych,
     - wywołanie `rpc("accept_generation_candidate", {...})` (transakcja w DB),
     - odebranie `newCardId` i dociągnięcie `FlashcardDTO` po ID.
4. Baza danych (nowa funkcja RPC):
   - DDL: funkcja `accept_generation_candidate(p_owner_id uuid, p_candidate_id uuid, p_origin text, p_category_id int, p_tag_ids int[], p_content_source_id int, p_metadata jsonb) returns uuid language plpgsql SECURITY INVOKER`.
   - Wewnątrz: `SELECT ... FOR UPDATE` kandydata właściciela; walidacje; tworzenie fiszki; update kandydata; ewentualne powiązania tagów; zwrot `newCardId`. Całość transakcyjnie.
5. Endpoint (nowy plik): `src/pages/api/generation-candidates/[id]/accept.ts`
   - `export const prerender = false;`
   - `POST`:
     - pobranie `supabase` z `locals`, walidacja `params` i `body` (Zod),
     - wywołanie serwisu i mapowanie wyników,
     - obsługa `PostgrestError` przez `mapAcceptFlashcardDbError`,
     - logi konsolowe pod `scope: "api/generation-candidates/:id/accept"`.
6. Testy/moki (opcjonalnie): `src/lib/mocks/generation-candidates.api.mocks.ts`
   - scenariusze: 201, 400 invalid_body, 404 not_found, 409 already_accepted, 422 fingerprint_conflict, 422 unprocessable_entity, 500 db_error.
7. Dokumentacja: zaktualizować `.ai/api-plan.md` odpowiednią sekcją (wymóg „in transaction”).

### 10. Przykładowe wywołanie

```http
POST /api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c/accept
Content-Type: application/json

{ "category_id": 1, "tag_ids": [2], "content_source_id": 5, "origin": "ai-edited" }
```

Odpowiedź 201:

```json
{
  "id": "b5e4a2d9-0a1b-4f2c-8a9d-3c7f1e2b4d6a",
  "front": "What is TCP three-way handshake?",
  "back": "SYN, SYN-ACK, ACK.",
  "origin": "ai-edited",
  "metadata": {
    "accepted_from_candidate_id": "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
    "generation_id": "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
    "candidate_fingerprint": "…"
  },
  "category_id": 1,
  "content_source_id": 5,
  "owner_id": "49e6ead8-c0d5-4747-8b8b-e70d650263b7",
  "created_at": "…",
  "updated_at": "…",
  "deleted_at": null,
  "tags": [
    { "id": 2, "name": "networking", "slug": "networking", "description": "…", "created_at": "…", "updated_at": "…" }
  ]
}
```

## API Endpoint Implementation Plan: GET /api/generation-candidates

### 1. Przegląd punktu końcowego

- Cel: zwrócić listę kandydatów wygenerowanych w ramach konkretnej generacji wraz z „zasugerowaną metadanyą” (np. `suggested_category_id`, `suggested_tags`) i informacjami stronicowania.
- Zakres: wyłącznie odczyt (GET), z filtrami po `generation_id` i `status[]`, wsparcie dla paginacji kursorem i limitu.
- Konsumenci: warstwa UI generatora oraz kolejne kroki akceptacji/edycji kandydatów.

### 2. Szczegóły żądania

- Metoda HTTP: GET
- URL: `/api/generation-candidates`
- Parametry zapytania:
  - Wymagane:
    - `generation_id` (string, UUID): identyfikator generacji, do której należą kandydaci.
  - Opcjonalne:
    - `status[]` (array of enum): lista statusów do filtrowania; dozwolone: `proposed`, `edited`, `accepted`, `rejected`. Przekazywane jako wielokrotne `status[]` w query, np. `?status[]=proposed&status[]=edited`.
    - `limit` (int): liczba rekordów do pobrania; domyślnie 20; min 1, max 100.
    - `cursor` (string): Base64 zakodowany wskaźnik pozycji (UUID kandydata) do stronicowania w przód.
- Body: brak

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `GenerationCandidateDTO` (pola: `id`, `generation_id`, `owner_id`, `front`, `back`, `front_back_fingerprint`, `status`, `accepted_card_id`, `suggested_category_id`, `suggested_tags`, `created_at`, `updated_at`).
  - `GenerationCandidateListResponse` = `PaginatedResponse<GenerationCandidateDTO>` z polem `page` (`next_cursor`, `has_more`).
- Nowe DTO/Command/Query (do dodania w warstwie walidacji):
  - `GenerationCandidatesQuery`:
    - `generationId: string` (UUID)
    - `statuses?: ("proposed" | "edited" | "accepted" | "rejected")[]`
    - `limit: number`
    - `cursor?: string` (UUID kandydata odkodowany z Base64)
  - Schemat Zod: `generationCandidatesQuerySchema` (+ dekoder kursora `decodeCandidateCursor`).

### 4. Szczegóły odpowiedzi

- 200 OK
  - Treść: `GenerationCandidateListResponse`
    - `data: GenerationCandidateDTO[]` (kolumny jw., zawierają „zasugerowaną metadanyę”: `suggested_category_id`, `suggested_tags`)
    - `page: { next_cursor: string | null; has_more: boolean }`
- 400 Bad Request
  - Nieprawidłowe parametry (np. niepoprawny `generation_id`, `limit`, `cursor`, `status[]`).
- 401 Unauthorized
  - Brak dostępnego klienta Supabase w kontekście (lub w przyszłości brak zalogowanego użytkownika).
- 404 Not Found
  - `generation_id` nie istnieje dla użytkownika.
- 500 Internal Server Error
  - Błąd bazy lub niespodziewany wyjątek.

### 5. Przepływ danych

1. Wejście: zapytanie GET z `generation_id`, opcjonalnie `status[]`, `limit`, `cursor`.
2. Walidacja Zod surowych parametrów (stringi/array z `url.searchParams`) + dekodowanie kursora Base64 → UUID.
3. Autoryzacja/kontekst: pobranie `supabase` z `locals` (middleware) i ustalenie `userId` (na dziś `DEFAULT_USER_ID`).
4. Weryfikacja istnienia generacji użytkownika: `getGenerationById(supabase, userId, generationId)`. Brak → 404.
5. Zapytanie do `generation_candidates`:
   - Filtry: `owner_id = userId`, `generation_id = query.generationId`, opcjonalnie `.in("status", query.statuses)`.
   - Porządek: `.order("id", { ascending: true })` (stabilne i proste stronicowanie).
   - Kursor: jeśli `cursor`, to `.gt("id", cursor)`.
   - Limit: `limit + 1` (nadpróbkowanie do wyznaczenia `has_more`).
6. Mapowanie do `GenerationCandidateDTO[]` (projekcja wyłącznie niezbędnych kolumn).
7. Paginacja: jeżeli zwrócono `limit + 1` rekordów → `has_more = true`, `next_cursor = base64(lastVisible.id)`, inaczej `has_more = false`, `next_cursor = null`.
8. Wyjście: 200 OK z `GenerationCandidateListResponse`.

### 6. Względy bezpieczeństwa

- RLS w bazie: `generation_candidates` mają polityki ograniczone do właściciela (`owner_id = auth.uid()`) lub admina; endpoint dodatkowo filtruje po `owner_id` zgodnym z kontekstem.
- Walidacja wejścia (Zod) minimalizuje ryzyko wstrzyknięć i błędów typu.
- Brak bezpośredniego zwracania wewnętrznych komunikatów DB – mapowanie do generycznych błędów 500.
- W przyszłości zamiast `DEFAULT_USER_ID` użyć właściwego uwierzytelnienia (np. `locals.supabase.auth.getUser()`), a przy braku użytkownika zwracać 401.

### 7. Obsługa błędów

- 400: nieprawidłowe `generation_id` (nie-UUID), `limit` spoza zakresu, `cursor` niepoprawne Base64/nie-UUID, `status[]` poza dozwolonym zbiorem.
- 401: brak dostępnego klienta Supabase (błąd środowiska).
- 404: generacja nie istnieje lub nie należy do użytkownika (sprawdzenie `generations` przed listowaniem).
- 500: błąd PostgREST/DB lub niespodziewany błąd; zwróć generyczny komunikat, bez detali DB.

### 8. Rozważania dotyczące wydajności

- Indeksy:
  - `generation_candidates_generation_status_idx (generation_id, status)` – przy filtrze po `generation_id` i `status[]`.
  - Klucz główny `id` – używany do porządkowania i stronicowania.
- Selektor kolumn: zawęzić `select` do wymaganych pól DTO.
- Stronicowanie kursorem z `limit + 1` minimalizuje liczbę zapytań.
- Brak JOINów – `suggested_category_id` i `suggested_tags` zwracamy surowo (szybciej). Ewentualne wzbogacenia (nazwy tagów/kategorii) realizować warstwą UI lub osobnymi zapytaniami.

### 9. Etapy wdrożenia

1. Walidacja i typy (nowy plik):
   - `src/lib/validation/generation-candidates.schema.ts`:
     - Stałe: `CANDIDATE_LIMIT_DEFAULT = 20`, `CANDIDATE_LIMIT_MIN = 1`, `CANDIDATE_LIMIT_MAX = 100`.
     - `CANDIDATE_STATUSES = ["proposed","edited","accepted","rejected"] as const`.
     - `generationCandidatesQuerySchema`:
       - `generation_id`: `z.string().uuid()` (wymagane).
       - `status[]`: `z.array(z.enum(CANDIDATE_STATUSES)).max(4).optional()` (z obsługą `url.searchParams.getAll("status[]")`).
       - `limit`: preprocess (string→int | domyślna wartość), zakres [1..100].
       - `cursor`: `z.string().trim().min(1).optional()` (Base64); dekodowanie:
         - `decodeCandidateCursor(value: string): string` → Base64→UTF-8→walidacja UUID (w razie błędu rzucić `InvalidCandidateCursorError`).
     - `buildGenerationCandidatesQuery(raw)` → `GenerationCandidatesQuery` (dekoduje `cursor` do UUID).

2. Serwis (nowy plik): `src/lib/services/generation-candidates.service.ts`
   - Kolumny do projekcji: `"id, generation_id, owner_id, front, back, front_back_fingerprint, status, accepted_card_id, suggested_category_id, suggested_tags, created_at, updated_at"`.
   - Funkcja `listGenerationCandidates(supabase, userId, query)`:
     - Budowa zapytania: `.from("generation_candidates").select(COLUMNS).eq("owner_id", userId).eq("generation_id", query.generationId).order("id", { ascending: true })`.
     - Jeśli `query.statuses?.length`: `.in("status", query.statuses)`.
     - Jeśli `query.cursor`: `.gt("id", query.cursor)`.
     - `.limit(query.limit + 1)` i obróbka `hasMore`/`nextCursor` (ostatnie widoczne `id` → Base64).
     - Mapowanie do `GenerationCandidateDTO[]`.
     - Zwróć `{ items, hasMore, nextCursorId }` (UUID lub null).

3. Kody błędów (rozszerzenie istniejącego modułu):
   - `src/lib/errors.ts`: dodać `CANDIDATE_ERROR_CODES = { INVALID_QUERY, UNAUTHORIZED, NOT_FOUND, DB_ERROR, UNEXPECTED_ERROR } as const` oraz typ `CandidateErrorCode`.
   - (Opcjonalnie) `mapCandidateDbError(error)` → na dziś wystarczy ogólne `DB_ERROR` (500).

4. Endpoint (nowy plik): `src/pages/api/generation-candidates.ts`
   - `export const prerender = false;`
   - `GET`:
     - Pobierz `supabase` z `locals` (fallback do `supabaseClient`), waliduj obecność – w razie braku 500/401 zgodnie z projektem (preferowane 500 zgodnie z istniejącym wzorcem i logiem powodu).
     - Zbuduj `rawQuery` z `url.searchParams`: `generation_id`, `limit`, `cursor`, `status[]` via `getAll("status[]")`.
     - Walidacja Zod: `generationCandidatesQuerySchema.safeParse(rawQuery)` → błędy → 400 z `INVALID_QUERY` i szczegółami (np. `issues`).
     - Zbuduj `GenerationCandidatesQuery` (`buildGenerationCandidatesQuery` z dekodowaniem kursora).
     - Ustal `userId` (na dziś `DEFAULT_USER_ID`).
     - Sprawdź istnienie generacji: `getGenerationById(supabase, userId, query.generationId)` → jeśli brak 404 `NOT_FOUND`.
     - `listGenerationCandidates(supabase, userId, query)` → zmapuj na `GenerationCandidateListResponse`:
       - `data: items`
       - `page: { has_more, next_cursor: nextCursorId ? encodeBase64(nextCursorId) : null }`
     - Zwróć 200.
     - Obsłuż `PostgrestError` → 500 `DB_ERROR`; inne → 500 `UNEXPECTED_ERROR`.
   - Logowanie zdarzeń (konsola) pod `scope: "api/generation-candidates"` (severity wg statusu).

5. Testy/moki
   - (Opcjonalnie) `src/lib/mocks/generation-candidates.api.mocks.ts` – przykładowe payloady do szybkiej weryfikacji UI.

6. Dokumentacja
   - Uzupełnić api-plan.

### 10. Zgodność z regułami implementacji

- Astro API: `prerender = false`, handler `GET` (wielkie litery), Zod weryfikacja wejścia, logika w serwisie, korzystanie z `locals.supabase`.
- Backend: Supabase row-level security, użycie typów z `src/db/supabase.client.ts`, DTO/typy współdzielone w `src/types.ts`.
- Clean code: wczesne zwroty dla błędów, ograniczanie else, zamknięta projekcja kolumn, spójne logowanie.

### 11. Przykładowe wywołania (UX API)

- Bez filtrów statusu: `/api/generation-candidates?generation_id=<uuid>`
- Z filtrami i paginacją: `/api/generation-candidates?generation_id=<uuid>&status[]=proposed&status[]=edited&limit=50&cursor=<base64(uuid)>`

## API Endpoint Implementation Plan: PATCH /api/generation-candidates/:id

### 1. Przegląd punktu końcowego

- Cel: umożliwić edycję pojedynczego kandydata wygenerowanej fiszki (`front`, `back`) oraz oznaczenie go jako `edited`.
- Zakres: częściowa aktualizacja; dozwolone modyfikacje tylko dla kandydatów w statusach `proposed` lub `edited`. Edycja kandydatów `accepted`/`rejected` jest blokowana.
- Inwarianty: długości pól jak w DB (`front ≤ 200`, `back ≤ 500`), unikalność odcisku `front_back_fingerprint` w zakresie właściciela dla statusów `proposed|edited` (wymuszana indeksem).
- Inwarianty: długości pól jak w DB (`front 1..200`, `back 1..500`), unikalność odcisku `front_back_fingerprint` w zakresie właściciela dla statusów `proposed|edited` (wymuszana indeksem).

### 2. Szczegóły żądania

- Metoda HTTP: PATCH
- URL: `/api/generation-candidates/:id`
- Parametry:
  - Wymagane (path):
    - `id` (UUID) – identyfikator kandydata.
  - Opcjonalne (body – co najmniej jedno pole wymagane):
    - `front` (string, 1..200, trimmed)
    - `back` (string, 1..500, trimmed)
    - `status` (enum) – dozwolone wyłącznie `"edited"`. Jeżeli `front/back` są dostarczone bez `status`, serwer implicitnie ustawia `status: "edited"`.
- Nagłówki:
  - `Content-Type: application/json`
- Body (przykład):

```json
{ "front": "OSI model?", "back": "7 layers ...", "status": "edited" }
```

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `GenerationCandidateDTO`
  - `UpdateGenerationCandidateCommand`:
    - `front?: string`
    - `back?: string`
    - `status?: "edited"`
- Nowe typy/DTO (walidacja Zod):
  - `getCandidateParamsSchema`: `{ id: z.string().uuid() }`
  - `updateGenerationCandidateSchema`:
    - kształt: `{ front?: string (trim, 1..200), back?: string (trim, 1..500), status?: z.literal("edited") }`
    - reguła: co najmniej jedno z pól `front|back|status` wymagane
- Nowe kody błędów (w `src/lib/errors.ts`):
  - `CANDIDATE_ERROR_CODES = { INVALID_PARAMS, INVALID_BODY, UNAUTHORIZED, NOT_FOUND, DUPLICATE_CANDIDATE, DB_ERROR, UNEXPECTED_ERROR }`
  - `mapCandidateDbError(error)` – mapuje naruszenie indeksu `generation_candidates_owner_fingerprint_unique` na `400 DUPLICATE_CANDIDATE`

### 4. Szczegóły odpowiedzi

- 200 OK
  - Treść:
    ```json
    {
      "candidate": {
        "id": "uuid",
        "generation_id": "uuid",
        "owner_id": "uuid",
        "front": "updated",
        "back": "updated",
        "front_back_fingerprint": "…",
        "status": "edited",
        "accepted_card_id": null,
        "suggested_category_id": 1,
        "suggested_tags": [1, 2],
        "created_at": "…",
        "updated_at": "…"
      }
    }
    ```
- Błędy:
  - 400 `invalid_params` – nie-UUID w ścieżce
  - 400 `invalid_body` – zła struktura JSON / długości pól / puste zgłoszenie bez pól do aktualizacji
  - 409 `duplicate_candidate` – konflikt odcisku `front_back_fingerprint` w zakresie właściciela (status `proposed|edited`)
  - 401 `unauthorized` – brak kontekstu/autoryzacji (docelowo JWT)
  - 404 `not_found` – kandydat nie istnieje, nie należy do użytkownika lub ma status `accepted|rejected`
  - 500 `db_error` / `unexpected_error` – błąd bazy lub inny wyjątek

### 5. Przepływ danych

1. Parsowanie i walidacja `id` z `params` (`getCandidateParamsSchema`).
2. Odczyt i walidacja body (`updateGenerationCandidateSchema`), sprawdzenie że dostarczono przynajmniej jedno pole.
3. Pobranie `supabase` z `locals` (fallback do klienta globalnego), ustalenie `userId` (tymczasowo `DEFAULT_USER_ID`).
4. Zbudowanie `updatePayload`:
   - `front/back` po `trim()`, odrzucone jeśli przekraczają limity.
   - jeśli `front/back` są obecne a `status` nie – ustawić `status: "edited"`.
   - zawsze ustawić `updated_at = now()`.
5. Aktualizacja atomowa:
   - `.from("generation_candidates").update(updatePayload)`
   - `.eq("id", id).eq("owner_id", userId).in("status", ["proposed", "edited"])`
   - `.select("id, generation_id, owner_id, front, back, front_back_fingerprint, status, accepted_card_id, suggested_category_id, suggested_tags, created_at, updated_at").single()`
6. Mapowanie wyników:
   - brak rekordu → `404 not_found`
   - sukces → `200 OK` z `candidate`
7. Obsługa wyjątków:
   - `PostgrestError 23505` z podpisem `generation_candidates_owner_fingerprint_unique` → `409 duplicate_candidate`
   - inne błędy DB → `500 db_error`
   - pozostałe wyjątki → `500 unexpected_error`
8. Telemetria: zdarzenia konsolowe `scope: "api/generation-candidates/:id"`, poziom wg statusu HTTP.

### 6. Względy bezpieczeństwa

- RLS w tabeli `generation_candidates` ogranicza widoczność i mutacje do `owner_id = auth.uid()` (lub admin); endpoint dodatkowo filtruje po `owner_id` i statusach edytowalnych.
- Walidacja Zod eliminuje nieprawidłowe typy i nadmiarowe pola (`.strict()`).
- Brak wycieku surowych szczegółów DB – kody i komunikaty są ogólne.
- Docelowo: walidacja JWT (`locals.supabase.auth.getUser()`); przy braku użytkownika zwracaj `401`.

### 7. Obsługa błędów

| Status | `error.code`          | Sytuacja                                                               |
| ------ | --------------------- | ---------------------------------------------------------------------- |
| 400    | `invalid_params`      | Parametr ścieżki `:id` nie-UUID                                        |
| 400    | `invalid_body`        | Puste body lub niespełnione limity długości                            |
| 409    | `duplicate_candidate` | Naruszenie unikalności odcisku w obrębie właściciela                   |
| 401    | `unauthorized`        | Brak (lub nieważny) kontekst autoryzacji                               |
| 404    | `not_found`           | Rekord nie istnieje / nie należy do użytkownika / status nieedytowalny |
| 500    | `db_error`            | Błąd Supabase/Postgres                                                 |
| 500    | `unexpected_error`    | Inny nieoczekiwany błąd                                                |

### 8. Rozważania dotyczące wydajności

- Minimalna projekcja kolumn w `select` po `update` (bez JOINów).
- Indeks unikalny `generation_candidates_owner_fingerprint_unique` zapewnia szybkie wykrywanie duplikatów.
- Brak dodatkowych zapytań przed aktualizacją – rely on upsert/unikalność po stronie DB.

### 9. Etapy wdrożenia

1. Walidacja (nowy plik): `src/lib/validation/generation-candidates.schema.ts`
   - `getCandidateParamsSchema`
   - `updateGenerationCandidateSchema` (trim, zakresy, `.strict()`, reguła co najmniej jednego pola)
2. Błędy (rozszerzenie): `src/lib/errors.ts`
   - `CANDIDATE_ERROR_CODES` + `mapCandidateDbError` (23505 → `duplicate_candidate`)
3. Serwis (nowy plik): `src/lib/services/generation-candidates.service.ts`
   - `updateCandidateForOwner(supabase, userId, id, payload)` – implementacja zapytania z pkt 5
4. Endpoint (nowy plik): `src/pages/api/generation-candidates/[id].ts`
   - `export const prerender = false`
   - `PATCH`:
     - wzorzec obsługi błędów jak w `src/pages/api/generations/[id].ts` (budowa descriptorów, `jsonResponse`, logger)
     - walidacja `params` i `body` (Zod), budowa `updatePayload`
     - wywołanie serwisu, mapowanie wyników/kontroli błędów
5. Moki/testy kontraktowe (opcjonalnie):
   - `src/lib/mocks/generation-candidates.api.mocks.ts`: scenariusze 200/400 invalid_body/400 duplicate/404/500
6. Dokumentacja:
   - Uzupełnić `.ai/api-plan.md` sekcję `Generation Candidates` o detale kontraktu PATCH

### 10. Przykładowe wywołania

```http
PATCH /api/generation-candidates/6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c
Content-Type: application/json

{ "front": "What is TCP three-way handshake?", "back": "SYN, SYN-ACK, ACK.", "status": "edited" }
```

Odpowiedź 200:

```json
{
  "candidate": {
    "id": "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
    "generation_id": "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
    "owner_id": "49e6ead8-c0d5-4747-8b8b-e70d650263b7",
    "front": "What is TCP three-way handshake?",
    "back": "SYN, SYN-ACK, ACK.",
    "front_back_fingerprint": "…",
    "status": "edited",
    "accepted_card_id": null,
    "suggested_category_id": 1,
    "suggested_tags": [2],
    "created_at": "…",
    "updated_at": "…"
  }
}
```

## API Endpoint Implementation Plan: POST /api/generation-candidates/:id/reject

### 1. Przegląd punktu końcowego

- Cel: oznaczyć kandydata jako `rejected` i zapisać znacznik czasu (wykorzystujemy `updated_at`).
- Zakres: mutacja stanu kandydata. Operacja jest idempotentna dla statusu `rejected` (powtarzane wywołanie zwróci 200 z tym samym stanem). Przejście z `accepted` na `rejected` jest niedozwolone.
- Reguły:
  - Dozwolone przejścia: `proposed` → `rejected`, `edited` → `rejected`.
  - Niedozwolone przejścia: `accepted` → `rejected` (zwraca konflikt przejścia), `rejected` → `rejected` (idempotentnie 200).

### 2. Szczegóły żądania

- Metoda HTTP: POST
- URL: `/api/generation-candidates/:id/reject`
- Parametry:
  - Wymagane (path):
    - `id` (UUID) – identyfikator kandydata
- Body: brak lub puste `{}` (zgodne z `RejectGenerationCandidateCommand`)
- Nagłówki:
  - `Content-Type: application/json` (opcjonalny – żądanie nie wymaga body)

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `GenerationCandidateDTO`
  - `RejectGenerationCandidateCommand = Record<string, never>`
- Nowe/rozszerzone w warstwie błędów:
  - `CANDIDATE_ERROR_CODES = { INVALID_PARAMS, INVALID_BODY, UNAUTHORIZED, NOT_FOUND, INVALID_TRANSITION, DB_ERROR, UNEXPECTED_ERROR } as const`
  - `type CandidateErrorCode = (typeof CANDIDATE_ERROR_CODES)[keyof typeof CANDIDATE_ERROR_CODES]`
- Walidacja (Zod):
  - `getCandidateParamsSchema`: `{ id: z.string().uuid() }`
  - `rejectGenerationCandidateSchema`: `z.object({}).strict()` (akceptuje wyłącznie puste body lub brak body)

### 4. Szczegóły odpowiedzi

- 200 OK
  - Treść:
    ```json
    {
      "candidate": {
        "id": "uuid",
        "generation_id": "uuid",
        "owner_id": "uuid",
        "front": "string",
        "back": "string",
        "front_back_fingerprint": "string",
        "status": "rejected",
        "accepted_card_id": null,
        "suggested_category_id": 1,
        "suggested_tags": [1, 2],
        "created_at": "…",
        "updated_at": "…"
      }
    }
    ```
- Błędy:
  - 400 `invalid_params` – `:id` nie-UUID
  - 400 `invalid_body` – niepoprawny JSON (niepuste/niezgodne body)
  - 401 `unauthorized` – brak kontekstu użytkownika (docelowo)
  - 404 `not_found` – kandydat nie istnieje lub nie należy do użytkownika
  - 409 `invalid_transition` – kandydat ma status `accepted` (niedozwolone przejście)
  - 500 `db_error` / `unexpected_error` – błąd bazy lub inny nieoczekiwany

Uwaga o idempotencji: jeśli kandydat ma już status `rejected`, endpoint zwraca 200 z aktualnym stanem (bez zmian).

### 5. Przepływ danych

1. Kontekst i walidacja:
   - Pobierz `supabase` z `locals` (fallback do globalnego klienta) i ustal `userId` (na dziś `DEFAULT_USER_ID`).
   - Waliduj `params.id` (UUID); w przeciwnym wypadku 400 `invalid_params`.
   - Jeśli `Content-Length > 0`, spróbuj sparsować JSON; waliduj `rejectGenerationCandidateSchema`:
     - niepuste lub niezgodne body → 400 `invalid_body`.
2. Atomowa aktualizacja:
   - Zapytanie:
     ```ts
     .from("generation_candidates")
       .update({ status: "rejected", updated_at: now })
       .eq("id", id)
       .eq("owner_id", userId)
       .is("accepted_card_id", null)
       .in("status", ["proposed", "edited"])
       .select("id, generation_id, owner_id, front, back, front_back_fingerprint, status, accepted_card_id, suggested_category_id, suggested_tags, created_at, updated_at")
       .single()
     ```
   - Jeśli aktualizacja się powiedzie → 200 z `candidate`.
3. Brak dopasowanego rekordu po próbie aktualizacji:
   - Dodatkowe sprawdzenie:
     - Pobierz kandydata po `id` i `owner_id`.
     - Jeżeli brak → 404 `not_found`.
     - Jeżeli istnieje i `status = 'accepted'` → 409 `invalid_transition`.
     - Jeżeli `status = 'rejected'` → idempotentnie 200 z aktualnym stanem (bez zmiany).
4. Telemetria:
   - Strukturalne logi konsolowe `scope: "api/generation-candidates/:id/reject"`, z polami: `status`, `userId`, `candidateId`, `outcome` (`rejected` | `invalid_transition` | kod błędu).

### 6. Względy bezpieczeństwa

- RLS ogranicza mutacje do `owner_id = auth.uid()` albo admina; endpoint dodatkowo filtruje po `owner_id`.
- Warunek `.is("accepted_card_id", null)` zapobiega odrzuceniu już zaakceptowanego kandydata.
- Walidacja Zod eliminuje nieprawidłowe body (tylko puste `{}` lub brak).
- W przyszłości: zastąpić `DEFAULT_USER_ID` realnym użytkownikiem z `locals.supabase.auth.getUser()`, zwracając 401 przy braku.

### 7. Obsługa błędów

| Status | `error.code`         | Sytuacja                                               |
| ------ | -------------------- | ------------------------------------------------------ |
| 400    | `invalid_params`     | `:id` nie-UUID                                         |
| 400    | `invalid_body`       | Nieprawidłowy JSON / niedozwolone pola w body          |
| 401    | `unauthorized`       | Brak kontekstu/autoryzacji (docelowo JWT)              |
| 404    | `not_found`          | Rekord nie istnieje lub nie należy do użytkownika      |
| 409    | `invalid_transition` | Kandydat ma status `accepted` (niedozwolone przejście) |
| 500    | `db_error`           | Błąd Supabase/Postgres                                 |
| 500    | `unexpected_error`   | Inny nieoczekiwany błąd                                |

### 8. Rozważania dotyczące wydajności

- Pojedyncza, warunkowa aktualizacja bez JOINów; minimalna projekcja kolumn.
- Indeksy:
  - Klucz główny `id` – szybkie dopasowanie.
  - `generation_candidates_generation_status_idx (generation_id, status)` – przy analizach (nie wymagane tutaj).
- Wczesne zwroty błędów skracają ścieżki wykonania.

### 9. Etapy wdrożenia

1. Walidacja (rozszerzenie istniejącego/nowy plik): `src/lib/validation/generation-candidates.schema.ts`
   - `getCandidateParamsSchema` (jeśli brak)
   - `rejectGenerationCandidateSchema = z.object({}).strict()`
2. Błędy (rozszerzenie): `src/lib/errors.ts`
   - Dodać `CANDIDATE_ERROR_CODES` i `CandidateErrorCode` (zawiera `INVALID_TRANSITION`)
   - Funkcja pomocnicza `buildCandidateErrorResponse(status, code, message, details?)` (opcjonalnie) lub użyć ogólnego `buildErrorResponse`
3. Serwis (nowe funkcje): `src/lib/services/generation-candidates.service.ts`
   - `getCandidateForOwner(supabase, userId, id)` – minimalna projekcja
   - `rejectCandidateForOwner(supabase, userId, id)` – implementuje punkt 2 (atomowa aktualizacja + selekcja)
4. Endpoint (nowy plik): `src/pages/api/generation-candidates/[id]/reject.ts`
   - `export const prerender = false;`
   - `export const POST: APIRoute = async ({ locals, params, request }) => { ... }`
   - Wzorzec obsługi błędów i `jsonResponse` jak w `src/pages/api/generations/[id].ts`
   - Logi konsolowe w `scope: "api/generation-candidates/:id/reject"`
5. (Opcjonalnie) Moki/testy kontraktowe: `src/lib/mocks/generation-candidates.api.mocks.ts`
   - Scenariusze: 200 (nowo odrzucony), 200 (idempotentnie odrzucony), 400 invalid_params, 400 invalid_body, 404 not_found, 409 invalid_transition, 500 db_error.
6. Dokumentacja: uzupełnić `.ai/api-plan.md` sekcję „Generation Candidates / reject”.
