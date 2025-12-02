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
