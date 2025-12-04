## API Endpoint Implementation Plan: POST /api/flashcards

### 1. Przegląd punktu końcowego

- Tworzy nową fiszkę (manualną lub po edycji AI) dla uwierzytelnionego użytkownika.
- Wymusza limity długości pól, poprawność referencji (FK), zgodność z RLS (owner_id = auth.uid()) oraz unika duplikatów przez odcisk `front_back_fingerprint` generowany w DB.
- Zwraca pełny rekord karty (z tagami) po pomyślnym utworzeniu.

### 2. Szczegóły żądania

- Metoda HTTP: POST
- URL: `/api/flashcards`
- Nagłówki:
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt>` (wymagane; RLS egzekwuje właściciela)
- Parametry:
  - Wymagane w body:
    - `front` (string, ≤200)
    - `back` (string, ≤500)
    - `origin` (enum `card_origin`: `ai-full|ai-edited|manual`)
  - Opcjonalne w body:
    - `category_id` (int > 0)
    - `content_source_id` (int > 0)
    - `tag_ids` (array<int> unikalnych, >0)
    - `metadata` (JSON)
- Request Body (przykład):

```json
{
  "front": "Explain TCP handshake",
  "back": "SYN, SYN-ACK, ACK ...",
  "category_id": 1,
  "content_source_id": 5,
  "tag_ids": [3, 4],
  "origin": "manual",
  "metadata": { "language": "PL" }
}
```

### 3. Wykorzystywane typy

- DTO/Command z `src/types.ts`:
  - `CreateFlashcardCommand` (wejście)
  - `FlashcardDTO` (wyjście)
  - `ApiErrorResponse` (błędy)
- Typy DB z `src/db/database.types.ts` (tabela `flashcards`, `card_tags`, enum `card_origin`, funkcja `normalize_flashcard_text`).
- Dodatkowe: `TagDTO` (w tablicy `FlashcardDTO.tags`), opcjonalnie `ReviewStatsSnapshotDTO` (nie dotyczy tworzenia).

### 4. Szczegóły odpowiedzi

- Sukces: `201 Created`
  - Body: `FlashcardDTO` (w tym `tags` zaktualizowane zgodnie z `tag_ids`)
- Błędy i kody stanu:
  - `400 invalid_body` – niepoprawny JSON/schemat (Zod)
  - `401 unauthorized` – brak/niepoprawny JWT
  - `404 category_not_found` / `404 source_not_found` / `404 tag_not_found` – referencje do nieistniejących zasobów
  - `409 duplicate_flashcard` – kolizja odcisku (`owner_id, front_back_fingerprint`), DB `23505`
  - `422 unprocessable_entity` – naruszenia CHECK/FK, które nie zostały wyłapane walidacją
  - `500 db_error` – błędy PostgREST/PG
  - `500 unexpected_error` – inne błędy wykonania

### 5. Przepływ danych

1. Wejście i auth
   - Odczyt `locals.supabase` (Astro middleware) oraz weryfikacja użytkownika (`getUser`/sesja). Brak użytkownika ⇒ 401.
2. Walidacja body (Zod)
   - Trimming, limity znaków, `origin ∈ card_origin`, `tag_ids` unikalne dodatnie ints, `metadata` jako JSON.
3. Weryfikacja referencji
   - Jeżeli `category_id` podane: HEAD/COUNT na `categories` (id).
   - Jeżeli `content_source_id` podane: HEAD/COUNT na `sources` (id).
   - Jeżeli `tag_ids` podane: `in('id', tag_ids)` i porównanie liczby rekordów.
   - Brakujące ⇒ 404 odpowiedni `*_not_found`.
4. Insert fiszki
   - `INSERT INTO flashcards` z polami: `owner_id = auth.uid()`, `front`, `back`, `origin`, `metadata`, `category_id?`, `content_source_id?`.
   - Unikalność: jeśli `23505` (unikalny indeks na `(owner_id, front_back_fingerprint)` z filtrem `deleted_at IS NULL`) ⇒ `409 duplicate_flashcard`.
5. Insert tagów (batch)
   - Jeśli `tag_ids` istnieje: batch `INSERT INTO card_tags (card_id, tag_id)`.
   - W przypadku błędu przy tagach: spróbuj kompensować `DELETE FROM flashcards WHERE id = <new_id>` (best-effort, zgodnie z RLS). Jeśli delete się nie powiedzie, zwróć `500 db_error` i zaloguj zdarzenie.
6. Select DTO
   - Pobierz świeżo utworzoną kartę + dołącz tagi (drugi SELECT) i zmapuj do `FlashcardDTO`.
7. Odpowiedź
   - `201` z `FlashcardDTO`.
   - Wszystkie 4xx/5xx – konsekwentny envelope `ApiErrorResponse` i log zdarzenia.

### 6. Względy bezpieczeństwa

- Wymagany JWT; supabase klient musi działać w kontekście użytkownika, aby RLS egzekwował `owner_id = auth.uid()`.
- Zod broni długości i typów; DB CHECK broni dodatkowo (podejście „belt and suspenders”). Unikamy przepełnienia `metadata` – ewentualny limit rozmiaru w schemacie.
- Brak zaufania do `tag_ids`/FK – jawna weryfikacja istnienia przed insertem.
- Brak operacji dynamicznego SQL – używamy supabase-js (parametryzacja).
- Logowanie zdarzeń do stdout (JSON) ze `scope: "api/flashcards"`, bez danych wrażliwych.

### 7. Obsługa błędów

- Walidacja (Zod) ⇒ `400 invalid_body` + szczegóły issues w `details` (nie echo całego payloadu).
- Auth brak/nieważny ⇒ `401 unauthorized`.
- FK brakujące ⇒ `404 *_not_found`.
- Unikalność fingerprint ⇒ `409 duplicate_flashcard` (kod DB `23505`).
- Inne naruszenia DB (`CHECK`, `FK`) ⇒ `422 unprocessable_entity`.
- PostgREST/PG awarie ⇒ `500 db_error` (z `{ code, message }`).
- Pozostałe ⇒ `500 unexpected_error`.
- Każdy błąd emituje `recordFlashcardsEvent({ severity, status, code, details })` do stdout.

### 8. Rozważania dotyczące wydajności

- Indeksy: korzystamy z istniejących na `flashcards` (`owner_id, created_at`, GIN trgm na `front/back`) – brak dodatkowych wymagań dla POST.
- Minimalizacja round-tripów: jedna wstawka fiszki + batch insert tagów + pojedynczy SELECT dto.
- Brak transakcji w supabase-js: stosujemy kompensację przy błędzie tagów; w przyszłości można rozważyć funkcję SQL łączącą insert + tagi w transakcji.
- Odciski i CHECK w DB zapewniają tanią deduplikację/obronę bez dodatkowych zapytań.

### 9. Etapy wdrożenia

1. Walidacja (Zod)
   - Utwórz `src/lib/validation/flashcards.schema.ts`:
     - `createFlashcardSchema` dla `CreateFlashcardCommand` (trim, limity, enum `card_origin`, `tag_ids` unikalne, dodatnie).
     - Eksport typu `CreateFlashcardPayload = z.infer<typeof createFlashcardSchema>`.
   - Reużyj `Constants.public.Enums.card_origin` z `database.types.ts` dla bezpiecznej listy wartości lub zdefiniuj lokalną stałą na bazie tych wartości.
2. Błędy/kontrakty
   - Rozszerz `src/lib/errors.ts` o:
     - `FLASHCARD_ERROR_CODES = { INVALID_BODY, UNAUTHORIZED, CATEGORY_NOT_FOUND, SOURCE_NOT_FOUND, TAG_NOT_FOUND, DUPLICATE_FLASHCARD, DB_ERROR, UNEXPECTED_ERROR, UNPROCESSABLE_ENTITY }`.
     - `mapFlashcardDbError(error: PostgrestError)` – rozpoznaj `23505` ⇒ `409 duplicate_flashcard`, w pozostałych przypadkach `500 db_error`; opcjonalnie rozpoznaj `23503` ⇒ `422 unprocessable_entity`.
3. Serwis
   - Dodaj `src/lib/services/flashcards.service.ts` z funkcjami:
     - `createFlashcard(supabase, userId, cmd: CreateFlashcardCommand): Promise<FlashcardDTO>`:
       - Walidacja referencji (HEAD/COUNT) dla `category_id`, `content_source_id`, `tag_ids`.
       - Insert do `flashcards` (z `owner_id: userId`), obsłuż 23505 ⇒ rzuć `PostgrestError` do mapowania.
       - Jeśli `tag_ids`: batch insert do `card_tags`.
       - Pobranie DTO (SELECT + JOIN tagów) i mapowanie do `FlashcardDTO`.
     - Funkcje pomocnicze: `mapFlashcardRowToDto`, `fetchTagsForCard`, `validateReferences`.
4. Endpoint
   - Utwórz `src/pages/api/flashcards.ts`:
     - `export const prerender = false`.
     - `POST`: pobierz `locals.supabase`, zweryfikuj obecność klienta i użytkownika.
     - `safeParse` body przez `createFlashcardSchema`; na error ⇒ `400 invalid_body`.
     - Wywołaj `createFlashcard`; mapuj znane błędy: `PostgrestError` przez `mapFlashcardDbError`, inne ⇒ `500 unexpected_error`.
     - Zwróć `201` z `FlashcardDTO`.
     - Funkcja `recordFlashcardsEvent` (analogiczna do `recordSourcesEvent`) dla 4xx/5xx.
5. Testy/mocks/kontrakty
   - Dodaj `src/lib/mocks/flashcards.api.mocks.ts`:
     - Scenariusze: 201 success, 400 invalid_body, 401 unauthorized, 404 category_not_found, 409 duplicate_flashcard, 422 unprocessable_entity, 500 db_error.
6. Middleware/Auth (jeśli potrzebne)
   - Upewnij się, że middleware wstrzykuje klienta supabase z kontekstem użytkownika (JWT z nagłówka `Authorization`) tak, aby `auth.uid()` było dostępne przy RLS.
7. Observability
   - Konsekwentne logowanie JSON (stdout) z `scope: "api/flashcards"` i `userId` (z JWT lub `DEFAULT_USER_ID` w dev).

### Załączniki do wdrożenia (naming i kontrakty)

- Pliki/ścieżki:
  - `src/pages/api/flashcards.ts` – handler `POST`.
  - `src/lib/validation/flashcards.schema.ts` – Zod schema.
  - `src/lib/services/flashcards.service.ts` – logika DB.
  - `src/lib/errors.ts` – rozszerzenie o kody flashcards i mapowanie błędów.
  - `src/lib/mocks/flashcards.api.mocks.ts` – przykładowe payloady/response.
- Kody statusu:
  - `201` dla pomyślnego utworzenia
  - `400` dla nieprawidłowych danych wejściowych
  - `401` dla nieautoryzowanego dostępu
  - `404` dla brakujących FK
  - `409` dla duplikatu
  - `422` dla naruszeń CHECK/FK
  - `500` dla błędów serwera

## API Endpoint Implementation Plan: GET /api/flashcards

### 1. Przegląd punktu końcowego

- Zwraca listę fiszek uwierzytelnionego użytkownika, domyślnie z wykluczeniem rekordów miękko usuniętych (`deleted_at is null`).
- Admin (wg RLS `is_admin()`) może dodatkowo uwzględniać usunięte przez `include_deleted=true`.
- Obsługuje filtrowanie po `category_id`, `content_source_id`, `origin`, `tag_ids[]` (dopasowanie ANY), prosty full‑text (ILIKE) po `front/back`.
- Paginacja typu keyset z nieprzezroczystym kursorem opartym o `created_at#id` (Base64).
- Sortowanie po: `created_at`, `-created_at`, `updated_at`, `next_review_at` (dla `next_review_at` wykorzystywany jest LEFT JOIN do `review_stats`).
- Zwraca również agregaty: `total` (po filtrach) oraz `by_origin`.

### 2. Szczegóły żądania

- Metoda HTTP: GET
- URL: `/api/flashcards`
- Nagłówki:
  - `Authorization: Bearer <jwt>` (wymagane; w dev możliwy fallback do `DEFAULT_USER_ID` do czasu pełnego Auth)
- Parametry:
  - Wymagane: —
  - Opcjonalne (query):
    - `limit` – int, domyślnie `20`, zakres `1..100`
    - `cursor` – string, nieprzezroczysty Base64 `"<created_at_iso>#<id>"`; niepoprawny ⇒ `400 invalid_query`
    - `category_id` – int > 0
    - `content_source_id` – int > 0
    - `origin` – enum: `ai-full | ai-edited | manual`
    - `tag_ids[]` – tablica int > 0, unikalne, max 50 (dopasowanie ANY)
    - `search` – string po trim, 1..200; dopasowanie `ILIKE` do `front/back` (indeksy GIN pg_trgm)
    - `sort` – `created_at | -created_at | updated_at | next_review_at` (domyślnie `-created_at`)
    - `include_deleted` – bool; brane pod uwagę tylko dla adminów (w przeciwnym razie ignorowane przez RLS)

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `FlashcardDTO`, `FlashcardAggregatesDTO`, `FlashcardListResponse`
- Nowe (walidacja zapytań):
  - `FlashcardsQuery` (interfejs runtime w warstwie usługi)
  - `flashcardsQuerySchema` / `buildFlashcardsQuery` / `decodeFlashcardsCursor` w `src/lib/validation/flashcards.schema.ts`
- Dodatkowe:
  - `ApiErrorResponse<FlashcardErrorCode>`

### 4. Szczegóły odpowiedzi

- Sukces: `200 OK`
  - Body: `FlashcardListResponse`:
    - `data: FlashcardDTO[]`
    - `page: { next_cursor: string | null, has_more: boolean }`
    - `aggregates?: { total: number, by_origin: Partial<Record<card_origin, number>> }`
- Błędy:
  - `400 invalid_query` – niepoprawny/niezgodny z schematem zestaw parametrów
  - `401 unauthorized` – brak/niepoprawny JWT (docelowo)
  - `500 db_error` – błąd zapytania do bazy
  - `500 unexpected_error` – inny błąd wykonania

### 5. Przepływ danych

1. Auth i kontekst
   - Użyj `locals.supabase` (zgodnie z zasadą „backend”); w dev można użyć `DEFAULT_USER_ID` do identyfikacji użytkownika do czasu pełnego JWT.
   - Brak sesji/użytkownika ⇒ `401 unauthorized`.
2. Walidacja query (Zod)
   - `flashcardsQuerySchema` normalizuje/ogranicza: `limit`, `sort`, `search`, `origin`, `category_id`, `content_source_id`, `tag_ids[]`, `include_deleted`, `cursor`.
   - `decodeFlashcardsCursor(base64)` → `{ createdAt: string, id: string }` lub błąd `InvalidFlashcardsCursorError`.
   - `buildFlashcardsQuery` zamienia payload na wewnętrzny `FlashcardsQuery` (parsuje kursory, domyśla sort).
3. Pobranie stronowanej listy
   - `listFlashcards(supabase, userId, query)`:
     - Buduje selekcję z kolumn: `id, front, back, origin, metadata, category_id, content_source_id, owner_id, created_at, updated_at, deleted_at`.
     - Filtry:
       - `category_id`, `content_source_id`, `origin` → `.eq(...)`
       - `tag_ids` (ANY): `select("..., card_tags!inner(tag_id)")` + `.in("card_tags.tag_id", tagIds)`
       - `search`: `or("front.ilike.%term%,back.ilike.%term%")` z escapowaniem wzorca
       - `include_deleted=false`: jawnie `.is("deleted_at", null)` aby admin domyślnie też nie widział skasowanych (chyba że `include_deleted=true`)
     - Sort:
       - `created_at`: `.order("created_at", { ascending: true })` + `.order("id", { ascending: true })` (deterministyczność)
       - `-created_at`: `.order("created_at", { ascending: false })` + `.order("id", { ascending: false })` (deterministyczność)
       - `updated_at`: `.order("updated_at", { ascending })` + `.order("id", { ascending: true })`
       - `next_review_at`: LEFT JOIN `review_stats` i `.order("review_stats.next_review_at", { nullsFirst: true, ascending })`, następnie `.order("id", { ascending: true })`
     - Paginacja (keyset):
       - Kursor Base64 `"<created_at_iso>#<id>"`. Dla `-created_at` użyj `lt(created_at, c.createdAt)` OR `(eq(created_at,c.createdAt) AND lt(id,c.id))`.
       - Dla `created_at` użyj `gt(created_at, c.createdAt)` OR `(eq(created_at,c.createdAt) AND gt(id,c.id))`.
       - Implementacja OR w PostgREST: `or=(and(created_at.<op>.<val>,id.<op2>.<val2>),created_at.<op>.<val>)`.
     - Limituj `limit + 1`, aby policzyć `has_more`.
   - Po pobraniu stronowanego zestawu:
     - Dociągnij tagi dla wszystkich `card_id` jednym zapytaniem na `card_tags` z JOIN do `tags`.
     - Zmapuj wynik do `FlashcardDTO[]`.
4. Agregaty
   - `total`: osobne zapytanie liczące (HEAD + `count: "exact"`) ze wszystkimi filtrami poza paginacją.
   - `by_origin`: 3 oddzielne zapytania z `.eq("origin", <value>)` i wspólnymi filtrami (tagi, search, include_deleted).
5. Odpowiedź i logowanie
   - Zwróć `200` z `{ data, page: { next_cursor, has_more }, aggregates }`.
   - Każdy 4xx/5xx loguj przez `recordFlashcardsEvent({ scope: "api/flashcards" })`.

### 6. Względy bezpieczeństwa

- Używaj wyłącznie `locals.supabase` (kontekst użytkownika) – dzięki temu RLS egzekwuje `owner_id = auth.uid()` i filtr `deleted_at` (z wyjątkami admina).
- Nie korzystaj z klienta serwisowego do odczytu użytkownika (ominąłby RLS).
- Waliduj/normalizuj wszystkie parametry query (w szczególności `cursor`, `limit`, `sort`, `search`).
- Nie ujawniaj danych wrażliwych w logach (payloady ograniczyć do metadanych i kodów).
- Dla `include_deleted`: honoruj wyłącznie, jeśli RLS rozpoznaje admina (dla zwykłych użytkowników i tak zostanie zignorowane).

### 7. Obsługa błędów

- `400 invalid_query`:
  - Pusty/za długi `search`, niepoprawny `sort`, `limit` poza zakresem, niepoprawny `cursor`, niepoprawne `tag_ids[]`.
- `401 unauthorized`:
  - Brak ważnej sesji; w dev dopuszczalny fallback do `DEFAULT_USER_ID`.
- `500 db_error`:
  - Błędy Supabase/PostgREST podczas listowania (mapowane ogólnie).
- `500 unexpected_error`:
  - Inne wyjątki w runtime (np. serializacja odpowiedzi).
- Wszystkie błędy przechodzą przez wspólny builder (`buildErrorResponse`) i są logowane `recordFlashcardsEvent`.

### 8. Rozważania dotyczące wydajności

- Indeksy: `flashcards_owner_created_idx`, GIN trgm na `front/back`, indeksy na FK i `review_stats.next_review_at`.
- Paginacja keyset (bez `offset`) – stabilna i skalowalna.
- Agregaty liczone osobnymi, prostymi zapytaniami (3× `by_origin`); można później scalić w RPC dla redukcji round‑tripów.
- Dociąganie tagów batchem (`in(card_id, ids)`) zamiast N+1.
- Ewentualne ograniczenie maks. długości `search` i liczby `tag_ids` już na schemacie Zod.

### 9. Etapy wdrożenia

1. Walidacja zapytań
   - Rozszerz `src/lib/validation/flashcards.schema.ts` o:
     - Stałe: LIMIT_DEFAULT/MIN/MAX, SORT_FIELDS, domyślne sortowanie `-created_at`.
     - `flashcardsQuerySchema` (origin enum, category_id/content_source_id > 0, tag_ids[] ≤ 50 unikalnych, search 1..200, include_deleted bool).
     - `decodeFlashcardsCursor(value: string): { createdAt: string; id: string }` (Base64 z separatorem `#`).
     - `buildFlashcardsQuery(payload): FlashcardsQuery`.
2. Kody błędów
   - Dodaj do `src/lib/errors.ts` w `FLASHCARD_ERROR_CODES`: `INVALID_QUERY`.
3. Serwis listowania
   - Dodaj do `src/lib/services/flashcards.service.ts`:
     - `listFlashcards(supabase, userId, query): Promise<{ items: FlashcardDTO[]; hasMore: boolean; nextCursor: string | null; aggregates: FlashcardAggregatesDTO }>`
     - Helpery: `applyFlashcardsFilters`, `applyFlashcardsSortingAndCursor`, `fetchTagsForCards(ids)`, `computeAggregates`.
4. Endpoint
   - Zaktualizuj `src/pages/api/flashcards.ts`:
     - `export const GET: APIRoute = async ({ locals, url }) => { ... }`
     - Pobierz `locals.supabase` i użytkownika; brak ⇒ `401`.
     - Zparsuj query przez Zod; błędne ⇒ `400 invalid_query`.
     - Wywołaj `listFlashcards`; zwróć `200` z payloadem.
     - Błędy DB mapuj do `db_error`, inne ⇒ `unexpected_error`. Loguj poprzez `recordFlashcardsEvent`.
5. Mocks/kontrakty
   - Rozszerz `src/lib/mocks/flashcards.api.mocks.ts` o scenariusze: 200 (pierwsza strona), 200 (z kursorami i filtrami), 400 invalid_query, 401 unauthorized.
6. QA i obserwowalność
   - Sprawdź paginację przy duplikatach `created_at` (tie‑breaker `id`).
   - Zweryfikuj zachowanie `include_deleted` dla admina vs zwykłego użytkownika (RLS).
   - Przejrzyj logi `recordFlashcardsEvent` pod kątem spójności pól.

### Załączniki do wdrożenia (naming i kontrakty)

- Pliki/ścieżki:
  - `src/pages/api/flashcards.ts` – handler `GET`.
  - `src/lib/validation/flashcards.schema.ts` – schematy zapytań i kursor.
  - `src/lib/services/flashcards.service.ts` – logika listowania/aggregatów.
  - `src/lib/errors.ts` – `FLASHCARD_ERROR_CODES.INVALID_QUERY`.
  - `src/lib/mocks/flashcards.api.mocks.ts` – przypadki 200/400/401.
- Kody statusu:
  - `200` dla pomyślnego odczytu
  - `400` dla nieprawidłowych parametrów
  - `401` dla nieautoryzowanego dostępu
  - `500` dla błędów serwera

## API Endpoint Implementation Plan: GET /api/flashcards/:id

### 1. Przegląd punktu końcowego

- Zwraca pojedynczą fiszkę o wskazanym `id` dla uwierzytelnionego właściciela lub administratora.
- Payload zawiera pełny `FlashcardDTO` (łącznie z `tags`) oraz dołączony snapshot statystyk przeglądów `review_stats` jako `review_stats` (jeśli istnieje).
- Domyślnie rekordy miękko usunięte (`deleted_at is not null`) są niewidoczne dla zwykłych użytkowników; admin widzi również usunięte.

### 2. Szczegóły żądania

- Metoda HTTP: GET
- URL: `/api/flashcards/:id`
- Nagłówki:
  - `Authorization: Bearer <jwt>` (docelowo wymagane; w dev dopuszczalny fallback do `DEFAULT_USER_ID`)
- Parametry:
  - Wymagane (path):
    - `id` – UUID fiszki
  - Opcjonalne: —
- Request Body: —

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `FlashcardDTO`
  - `ReviewStatsSnapshotDTO` (osadzane jako `FlashcardDTO.review_stats`)
  - `ApiErrorResponse<FlashcardErrorCode>`
- Z `src/db/database.types.ts`:
  - Tabele: `flashcards`, `card_tags`, `review_stats`
- Nowe (walidacja/serwis):
  - `flashcardIdParamSchema` (Zod) – walidacja `id` jako UUID

### 4. Szczegóły odpowiedzi

- Sukces: `200 OK`
  - Body: `FlashcardDTO` z wypełnionymi `tags` i opcjonalnym `review_stats`
- Błędy:
  - `400 invalid_query` – niepoprawny identyfikator (`id` nie jest UUID)
  - `401 unauthorized` – brak/niepoprawny JWT (stan docelowy)
  - `404 not_found` – brak zasobu lub brak dostępu (zaszyte przez RLS; nie ujawniamy istnienia)
  - `500 db_error` – błąd zapytania do bazy
  - `500 unexpected_error` – inny błąd wykonania

### 5. Przepływ danych

1. Auth i kontekst
   - Pobierz `locals.supabase` (zgodnie z zasadą backend). W obecnym DEV fallback możliwy do `supabaseServiceClient`/`supabaseClient`, ale patrz uwagi bezpieczeństwa.
   - Ustal `userId` (docelowo z sesji Supabase; w dev `DEFAULT_USER_ID`).
2. Walidacja parametru
   - Z `flashcardIdParamSchema` zweryfikuj `params.id` jako UUID. Błąd ⇒ `400 invalid_query`.
3. Pobranie rekordu i relacji
   - Serwis `getFlashcardById(supabase, userId, cardId)`:
     - Pobierz wiersz z `flashcards` po `id` (kolumny: `id, front, back, origin, metadata, category_id, content_source_id, owner_id, created_at, updated_at, deleted_at`).
     - Zachowanie RLS:
       - Przy `locals.supabase` RLS wymusi `(owner_id = auth.uid() or is_admin())` oraz widoczność `deleted_at` tylko dla admina.
       - Jeśli używasz fallback (serwisowy/publiczny klient) w DEV, zawsze dołóż filtry `.eq("owner_id", userId)` oraz `.is("deleted_at", null)` dla zwykłego użytkownika.
     - Jeśli brak rekordu ⇒ `404 not_found`.
   - Równolegle:
     - `fetchTagsForCard(supabase, cardId)` – już istniejący helper (JOIN do `tags`).
     - `fetchReviewStatsSnapshot(supabase, userId, cardId)` – SELECT z `review_stats` po `(user_id, card_id)`; jeśli brak – pole `review_stats` zostaw puste.
   - Zmapuj do `FlashcardDTO` (re-use `mapFlashcardRowToDto(row, tags)`), następnie dołącz `review_stats` (jeśli istnieje).
4. Odpowiedź i logowanie
   - Zwróć `200` z `FlashcardDTO`.
   - Każdy 4xx/5xx loguj przez `recordFlashcardsEvent({ scope: "api/flashcards" })`.

### 6. Względy bezpieczeństwa

- Preferuj wyłącznie `locals.supabase`, aby działał RLS. W trybie DEV przy ewentualnym fallbacku do klienta serwisowego/publikowalnego zawsze filtruj po `owner_id = userId` i (dla nie-admina) `deleted_at is null`.
- Brak ujawnienia istnienia zasobów: dla nie-właściciela zwracaj `404 not_found` (RLS i tak ukryje rekord).
- Waliduj UUID już na wejściu (`invalid_query`), aby uniknąć niepoprawnych zapytań i obniżyć koszt DB.
- Nie loguj danych wrażliwych (treści fiszki) – w logach wyłącznie `status`, `code`, `userId`, `cardId`, ewentualnie `db_code`.

### 7. Obsługa błędów

- `400 invalid_query` – niepoprawny `id` (nie-UUID).
- `401 unauthorized` – brak sesji (stan docelowy; obecnie dev fallback).
- `404 not_found` – brak rekordu lub brak uprawnień (scalony komunikat).
- `500 db_error` – błędy Supabase/PostgREST (mapowane ogólnie).
- `500 unexpected_error` – inne wyjątki runtime.
- Wszystkie błędy przechodzą przez wspólne funkcje (`buildErrorResponse`, `mapFlashcardDbError`) i są logowane przez `recordFlashcardsEvent`.

### 8. Rozważania dotyczące wydajności

- Minimalizuj round‑tripy: pobranie fiszki + równolegle tagów i `review_stats` (Promise.all).
- Wybieraj tylko wymagane kolumny; istnieją indeksy: `flashcards_owner_created_idx`, `review_stats_card_next_review_idx`, indeksy na FK i GIN trgm dla tekstów (tu nieużywane).
- Brak potrzeby paginacji/cursorów; endpoint dotyczy pojedynczego rekordu.

### 9. Etapy wdrożenia

1. Kody błędów
   - Rozszerz `src/lib/errors.ts` → `FLASHCARD_ERROR_CODES` o:
     - `INVALID_QUERY = "invalid_query"` (jeśli nie dodano wcześniej przy liście)
     - `NOT_FOUND = "not_found"`
2. Walidacja parametru
   - Rozszerz `src/lib/validation/flashcards.schema.ts`:
     - `flashcardIdParamSchema = z.object({ id: z.string().uuid() })`
     - Eksport helpera `parseFlashcardId(params): string`
3. Serwis
   - Rozszerz `src/lib/services/flashcards.service.ts`:
     - `export async function getFlashcardById(supabase, userId, cardId): Promise<FlashcardDTO>`:
       - Pobierz wiersz z `flashcards` (z RLS); w DEV fallback dołóż filtry `owner_id`/`deleted_at`.
       - Pobierz `tags` przez istniejące `fetchTagsForCard`.
       - Pobierz `review_stats` przez nowy helper:
         - `fetchReviewStatsSnapshot(supabase, userId, cardId): Promise<ReviewStatsSnapshotDTO | undefined>`
       - Złóż DTO przez `mapFlashcardRowToDto` i dołącz `review_stats` (jeśli jest).
4. Endpoint
   - Utwórz `src/pages/api/flashcards/[id].ts`:
     - `export const prerender = false`
     - `export const GET: APIRoute = async ({ locals, params }) => { ... }`
     - Waliduj `params.id` (Zod), ustal `userId` (dev: `DEFAULT_USER_ID`), wywołaj `getFlashcardById`, zwróć `200`.
     - Błędy: `invalid_query` (400), `not_found` (404), DB (mapuj `db_error`), inne `unexpected_error` (500). Loguj `recordFlashcardsEvent`.
5. Mocks/kontrakty
   - Rozszerz `src/lib/mocks/flashcards.api.mocks.ts` o scenariusze:
     - 200 success (z/bez `review_stats`)
     - 400 invalid_query (zły UUID)
     - 404 not_found
     - 500 db_error
6. QA i obserwowalność
   - Zweryfikuj zachowanie dla: właściciel, nie-właściciel, admin; rekord `deleted_at` (niewidoczny dla usera).
   - Sprawdź logi `recordFlashcardsEvent` (spójne pola i brak wrażliwych danych).

### Załączniki do wdrożenia (naming i kontrakty)

- Pliki/ścieżki:
  - `src/pages/api/flashcards/[id].ts` – handler `GET`
  - `src/lib/validation/flashcards.schema.ts` – `flashcardIdParamSchema`
  - `src/lib/services/flashcards.service.ts` – `getFlashcardById`, `fetchReviewStatsSnapshot`
  - `src/lib/errors.ts` – `FLASHCARD_ERROR_CODES.INVALID_QUERY`, `FLASHCARD_ERROR_CODES.NOT_FOUND`
  - `src/lib/mocks/flashcards.api.mocks.ts` – przypadki 200/400/404/500
- Kody statusu:
  - `200` dla pomyślnego odczytu
  - `400` dla nieprawidłowych parametrów
  - `401` dla nieautoryzowanego dostępu
  - `404` dla nie znalezionych zasobów
  - `500` dla błędów serwera

## API Endpoint Implementation Plan: PATCH /api/flashcards/:id

### 1. Przegląd punktu końcowego

- Aktualizuje istniejącą fiszkę użytkownika częściowo (front/back/origin/metadata/kategorie/źródło) oraz zastępuje pełny zestaw tagów, jeśli podano `tag_ids`.
- Ustawia `updated_at` (zaufane po stronie DB – trigger) i opcjonalnie wykonuje miękkie usunięcie rekordu, jeśli żądanie zawiera sygnał soft‑delete (`deleted_at`).
- Zwraca kompletny `FlashcardDTO` po aktualizacji (łącznie z tagami; oraz ewentualnie `deleted_at` ≠ null po soft‑delete).

### 2. Szczegóły żądania

- Metoda HTTP: PATCH
- URL: `/api/flashcards/:id`
- Nagłówki:
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt>` (docelowo wymagane; w dev może używać `DEFAULT_USER_ID`)
- Parametry:
  - Wymagane (path):
    - `id` – UUID fiszki
  - Opcjonalne (body; wszystkie pola są opcjonalne, co umożliwia częściową aktualizację):
    - `front` (string, trim, 1..200)
    - `back` (string, trim, 1..500)
    - `origin` (enum `ai-full|ai-edited|manual`)
    - `category_id` (int > 0)
    - `content_source_id` (int > 0)
    - `metadata` (JSON)
    - `tag_ids` (array<int> unikalnych > 0; do 50; zastępuje cały zestaw tagów; pusta tablica czyści tagi)
    - `deleted_at` (opcjonalny „sygnał” soft‑delete; patrz walidacja/serwis)
- Przykład – aktualizacja treści i tagów:

```json
{
  "front": "What is TCP three-way handshake?",
  "back": "SYN -> SYN/ACK -> ACK.",
  "tag_ids": [3, 7],
  "metadata": { "language": "EN" }
}
```

- Przykład – soft‑delete:

```json
{
  "deleted_at": true
}
```

### 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `UpdateFlashcardCommand` (wejście)
  - `FlashcardDTO` (wyjście)
  - `ApiErrorResponse<FlashcardErrorCode>`
- Z `src/db/database.types.ts`:
  - Tabele: `flashcards`, `card_tags`, `categories`, `sources`, `tags`
- Z `src/lib/errors.ts`:
  - `FLASHCARD_ERROR_CODES` (`INVALID_BODY`, `UNAUTHORIZED`, `CATEGORY_NOT_FOUND`, `SOURCE_NOT_FOUND`, `TAG_NOT_FOUND`, `DUPLICATE_FLASHCARD`, `UNPROCESSABLE_ENTITY`, `DB_ERROR`, `UNEXPECTED_ERROR`)

### 4. Szczegóły odpowiedzi

- Sukces: `200 OK`
  - Body: `FlashcardDTO` po aktualizacji
- Błędy i kody stanu:
  - `400 invalid_body` – niepoprawny JSON/schemat (Zod)
  - `400 invalid_query` – niepoprawny `id` (nie‑UUID); walidacja parametru ścieżki
  - `401 unauthorized` – brak/niepoprawny JWT (stan docelowy)
  - `404 not_found` – karta nie istnieje lub RLS ukrywa zasób; brak dostępu
  - `404 category_not_found` / `404 source_not_found` / `404 tag_not_found` – brak wskazanych referencji
  - `409 duplicate_flashcard` – naruszenie unikalności odcisku przy zmianie `front/back` (DB `23505`)
  - `422 unprocessable_entity` – inne naruszenia CHECK/FK (`23503`)
  - `500 db_error` – błędy PostgREST/PG
  - `500 unexpected_error` – inne błędy wykonania

### 5. Przepływ danych

1. Auth i kontekst
   - Pobierz `locals.supabase` (preferowane). W aktualnym DEV dopuszczalny fallback do `supabaseServiceClient`/`supabaseClient`, jednak preferuj kontekst użytkownika ze względu na RLS.
   - Ustal `userId` (docelowo z sesji Supabase; w dev `DEFAULT_USER_ID`).
2. Walidacja parametru
   - `flashcardIdParamSchema` (`id` jest UUID). Błąd ⇒ `400 invalid_query`.
3. Walidacja body (Zod)
   - `updateFlashcardSchema` (pola opcjonalne; te same limity co dla tworzenia).
   - `tag_ids` – unikalne, dodatnie ints; pusta tablica dozwolona (czyści tagi).
   - `deleted_at` – traktowane jako sygnał soft‑delete (np. `true` lub poprawny string daty). W warstwie serwisu realnie ustawiamy `deleted_at = now()`; wartość od klienta ignorowana.
4. Weryfikacja referencji (tylko dla pól przekazanych)
   - Jeśli podano `category_id`: istnieje? ⇒ inaczej `404 category_not_found`.
   - Jeśli podano `content_source_id`: istnieje? ⇒ inaczej `404 source_not_found`.
   - Jeśli podano `tag_ids`: wszystkie istnieją? ⇒ inaczej `404 tag_not_found` (z `details.missing_tag_ids`).
5. Aktualizacja rekordu
   - Zbuduj `updatePayload` z przekazanych pól (bez `tag_ids`).
   - Jeśli żądanie zawiera sygnał soft‑delete (`deleted_at` w payloadzie): nadpisz `updatePayload.deleted_at = now()`.
   - `UPDATE flashcards SET ... WHERE id = :id` (RLS egzekwuje właściciela/admina). Jeśli brak trafionych wierszy ⇒ `404 not_found`.
   - Konflikt unikalności fingerprint przy zmianie `front/back` ⇒ DB `23505` → `409 duplicate_flashcard` (przez `mapFlashcardDbError`).
6. Zastąpienie zestawu tagów (jeśli przekazano `tag_ids`)
   - Usuń istniejące relacje: `DELETE FROM card_tags WHERE card_id = :id`.
   - Jeśli `tag_ids.length > 0`: batch `INSERT INTO card_tags (card_id, tag_id) VALUES ...`.
7. Pobranie DTO
   - Równolegle:
     - `fetchFlashcardRow(id)` (z kolumnami: `id, front, back, origin, metadata, category_id, content_source_id, owner_id, created_at, updated_at, deleted_at`)
     - `fetchTagsForCard(id)` (JOIN z `tags`)
   - Zmapuj przez `mapFlashcardRowToDto(row, tags)`.
8. Odpowiedź i logowanie
   - `200` z `FlashcardDTO`.
   - Każdy 4xx/5xx loguj przez `recordFlashcardsEvent({ scope: "api/flashcards" })` z `status`, `code`, `userId`, ewentualnie `details`.

### 6. Względy bezpieczeństwa

- Preferuj `locals.supabase` (RLS: właściciel = `auth.uid()`; admin wg polityk).
- Nie polegaj na `deleted_at` z klienta – zawsze ustawiaj `now()` po stronie serwera.
- Waliduj UUID i body przez Zod; przycinaj teksty, narzucaj zakresy długości.
- Nie loguj treści fiszek ani innych danych wrażliwych – tylko kody, statusy, identyfikatory.
- Zależnie od stanu auth w projekcie, dodaj kontrolę nagłówka `Authorization` (docelowo `401` przy braku).

### 7. Obsługa błędów

- `400 invalid_query` – niepoprawny `id` (nie‑UUID).
- `400 invalid_body` – błędny JSON/schemat.
- `401 unauthorized` – brak sesji/JWT (stan docelowy).
- `404 not_found` – karta nie istnieje lub brak uprawnień (RLS).
- `404 category_not_found` / `source_not_found` / `tag_not_found` – brakujące referencje.
- `409 duplicate_flashcard` – naruszenie unikalności fingerprint (zmiana `front/back`).
- `422 unprocessable_entity` – `23503` (FK/CHECK).
- `500 db_error` – inne błędy PostgREST/PG (mapowane).
- `500 unexpected_error` – niesklasyfikowane wyjątki runtime.

### 8. Rozważania dotyczące wydajności

- Minimalizuj round‑tripy: jedna aktualizacja + opcjonalny zestaw operacji na tagach + pojedynczy SELECT DTO (tags + row równolegle).
- Walidacja referencji wykonywana warunkowo (tylko dla faktycznie zmienianych pól).
- Batch insert tagów, brak N+1 przy pobieraniu tagów (po aktualizacji).
- Indeksy: wykorzystaj istniejące (`flashcards_owner_created_idx`, FK, GIN trgm dla tekstów – tu nieużywany bezpośrednio).

### 9. Etapy wdrożenia

1. Walidacja (Zod)
   - Rozszerz `src/lib/validation/flashcards.schema.ts` o:
     - `flashcardIdParamSchema = z.object({ id: z.string().uuid() })` oraz `parseFlashcardId(params)`.
     - `updateFlashcardSchema = z.object({ front?: string(1..200), back?: string(1..500), origin?: enum, category_id?: positiveInt, content_source_id?: positiveInt, metadata?: Json, tag_ids?: number[] (unikalne, ≤50), deleted_at?: z.union([z.literal(true), z.string().datetime()]).optional() })`.
     - `export type UpdateFlashcardPayload = z.infer<typeof updateFlashcardSchema>`.
2. Serwis
   - Rozszerz `src/lib/services/flashcards.service.ts`:
     - `export async function updateFlashcard(supabase, userId: string, cardId: string, cmd: UpdateFlashcardCommand): Promise<FlashcardDTO>`
       - Waliduj referencje warunkowo `ensureCategoryExists`, `ensureContentSourceExists`, `ensureTagsExist`.
       - Zbuduj `updatePayload` (pomijaj nieprzekazane klucze).
       - Jeśli `cmd.deleted_at` jest ustawione: `updatePayload.deleted_at = new Date().toISOString()`.
       - `UPDATE ... WHERE id = :cardId` (po RLS). Gdy brak rekordu ⇒ rzuć błąd „not found”.
       - Jeśli `cmd.tag_ids` !== undefined:
         - `deleteCardTags(supabase, cardId)`, a następnie jeśli `cmd.tag_ids.length > 0` → `upsertCardTags(supabase, cardId, cmd.tag_ids)`.
       - Pobierz `row` i `tags` równolegle; `return mapFlashcardRowToDto(row, tags)`.
     - Nowe pomocnicze:
       - `deleteCardTags(supabase, cardId: string): Promise<void>`
       - (re‑use) `upsertCardTags`, `fetchFlashcardRow`, `fetchTagsForCard`, `mapFlashcardRowToDto`.
3. Endpoint
   - Utwórz/zaktualizuj `src/pages/api/flashcards/[id].ts`:
     - `export const prerender = false`
     - `export const PATCH: APIRoute = async ({ locals, params, request }) => { ... }`
       - Pobierz `supabase` z `locals` (fallback dev jak w `POST`).
       - Waliduj `params.id` przez Zod; na błąd ⇒ `400 invalid_query`.
       - `readJsonBody(request)` → `safeParse(updateFlashcardSchema)`; błąd ⇒ `400 invalid_body`.
       - Zbuduj `UpdateFlashcardCommand` (zamień `deleted_at` sygnał na `now()`).
       - Wywołaj `updateFlashcard`; zwróć `200` z DTO.
       - Mapowanie błędów: `FlashcardReferenceError` → `404 *not_found`, `PostgrestError` → `mapFlashcardDbError` (409/422/500), inne → `500 unexpected_error`.
       - Logi przez `recordFlashcardsEvent`.
4. Kody błędów/kontrakty
   - W `src/lib/errors.ts` brak zmian w kodach (zestaw już zawiera wymagane pozycje).
5. Mocks/kontrakty
   - Rozszerz `src/lib/mocks/flashcards.api.mocks.ts`:
     - 200 – częściowa aktualizacja treści
     - 200 – zastąpienie tagów (pusta tablica → wyczyszczenie)
     - 200 – soft‑delete (body: `{ "deleted_at": true }`)
     - 400 invalid_body (np. `front: ""`)
     - 404 not_found (nieistniejące `id`)
     - 409 duplicate_flashcard (kolizja fingerprint po zmianie `front/back`)
     - 422 unprocessable_entity (FK)
     - 500 db_error
6. QA i obserwowalność
   - Sprawdź ścieżki: właściciel vs nie‑właściciel vs admin (RLS), rekord `deleted_at` (niewidoczny dla zwykłego użytkownika przy GET).
   - Zweryfikuj, że `deleted_at` zawsze ustawiane przez serwer (ignoruj wartość z body).
   - Przejrzyj logi `recordFlashcardsEvent` – brak danych wrażliwych, spójne `status/code`.

### Załączniki do wdrożenia (naming i kontrakty)

- Pliki/ścieżki:
  - `src/pages/api/flashcards/[id].ts` – handler `PATCH`
  - `src/lib/validation/flashcards.schema.ts` – `flashcardIdParamSchema`, `updateFlashcardSchema`
  - `src/lib/services/flashcards.service.ts` – `updateFlashcard`, `deleteCardTags`
  - `src/lib/errors.ts` – re‑use `mapFlashcardDbError`, `FLASHCARD_ERROR_CODES`
  - `src/lib/mocks/flashcards.api.mocks.ts` – przypadki 200/400/404/409/422/500 (PATCH)
- Kody statusu:
  - `200` dla pomyślnej aktualizacji (w tym soft‑delete)
  - `400` dla nieprawidłowych danych wejściowych/parametru `id`
  - `401` dla nieautoryzowanego dostępu
  - `404` dla brakującej karty lub referencji (odpowiednie kody)
  - `409` dla duplikatu (fingerprint)
  - `422` dla naruszeń CHECK/FK
  - `500` dla błędów serwera
