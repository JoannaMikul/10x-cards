## API Endpoint Implementation Plan: GET /api/tags

## 1. Przegląd punktu końcowego

Endpointy Tags odzwierciedlają funkcjonalnie Categories, służąc do zarządzania metadanymi tagów używanymi przy fiszkach. Publiczne pobieranie listy tagów służy filtrom i chipom metadanych w UI. Dodatkowa walidacja domenowa względem kategorii: `name` musi mieć długość ≤ 64 znaki (spójnie z CHECK w DB).

Zakres wdrożenia: listowanie (`GET /api/tags`). Endpoint stosuje standardową obwiednię błędów API i paginację kursorem.

## 2. Szczegóły żądania

- Metoda HTTP: GET
- Struktura URL: `/api/tags`
- Parametry (query):
  - Wymagane: —
  - Opcjonalne:
    - `search` (string) – trymerowane, case-insensitive `ILIKE` po `name` i `slug`, 1..200 znaków; pusty string jest odrzucany.
    - `limit` (int) – domyślnie `20`, zakres `1..100`. Backend pobiera `limit + 1` w celu wykrycia `has_more`.
    - `cursor` (string) – Base64 zakodowany dodatni identyfikator `id` ostatniego rekordu z poprzedniej strony. Błędna Base64 lub ID ≤ 0 → `400`.
    - `sort` (enum) – `name|created_at`, domyślnie `name`. Zawsze dodatkowe sortowanie `id ASC` dla deterministyczności.
- Request Body: —

## 3. Wykorzystywane typy

- DTO (z `src/types.ts`):
  - `TagDTO` – `{ id, name, slug, description, created_at, updated_at }`
  - `TagListResponse` – `PaginatedResponse<TagDTO>`
- Struktury wspólne:
  - `PaginatedResponse<T>`, `CursorPage`
  - (Nowe, w ramach wdrożenia) `TagsQuery`, `TagsQuerySchema`, `InvalidTagCursorError`
  - (Nowe, w ramach wdrożenia) `TAG_ERROR_CODES`, `TagErrorCode` (analogicznie do `CATEGORY_ERROR_CODES`)

## 4. Szczegóły odpowiedzi

- Sukces `200 OK` (GET):

```json
{
  "data": [
    {
      "id": 3,
      "name": "docker",
      "slug": "docker",
      "description": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "page": { "next_cursor": "MTA=", "has_more": true }
}
```

- Kody statusu i błędów:
  - `200 OK` – poprawne pobranie.
  - `400 Bad Request` – nieprawidłowe parametry zapytania (np. pusty `search`, błędny `cursor`, przekroczone limity).
  - `500 Internal Server Error` – błąd bazy (mapowane jako `db_error`) lub nieoczekiwany błąd środowiska.

## 5. Przepływ danych

1. Klient wywołuje `GET /api/tags` z parametrami `search?`, `limit?`, `cursor?`, `sort?`.
2. Astro endpoint (`src/pages/api/tags.ts`):
   - `export const prerender = false`
   - Pobiera `supabase` z `locals.supabase` (fallback do `supabaseClient`), zgodnie z zasadami backend.
   - Waliduje query przez Zod (`tagsQuerySchema`), w tym dekodowanie kursora Base64 -> `number` z obsługą `InvalidTagCursorError`.
3. Serwis (`src/lib/services/tags.service.ts`) buduje zapytanie PostgREST:
   - `from("tags").select("id, name, slug, description, created_at, updated_at")`
   - `order(sort, { ascending: true }).order("id", { ascending: true })`
   - `or("name.ilike.%...%,slug.ilike.%...%")` z bezpiecznym escapowaniem wzorca (analogicznie do categories).
   - `gt("id", cursor)` dla stronicowania.
   - `limit(limit + 1)`, oblicza `has_more`, `next_cursor`.
4. Mapowanie do `TagDTO[]`, enkodowanie kursora Base64, zwrot `TagListResponse`.
5. Logowanie zdarzeń (console JSON) w przypadku 4xx/5xx: `scope: "api/tags"`, `userId: DEFAULT_USER_ID` (do czasu spięcia Auth w middleware).

## 6. Względy bezpieczeństwa

- RLS: `tags` – publiczny SELECT (`anon`/`authenticated`) analogicznie do `categories`.
- Autoryzacja w API:
  - Odczyt (GET) – publiczny (RLS dopuszcza SELECT).
- Walidacja wejścia:
  - Zod: długości, zakresy, regex `slug`, dekodowanie kursora, trimming `search`.
  - `name` ≤ 64 – odzwierciedla CHECK w DB, zapobiega 500 z tytułu naruszenia constraintu.
- Odporność na wstrzyknięcia:
  - Użycie buildera PostgREST; escapowanie wzorca `ILIKE` (%, \_ , \, ,) – ten sam helper co przy kategoriach.
- Ograniczanie ujawniania informacji:
  - Mapowanie błędów DB do ustandaryzowanych kodów (`db_error`) bez ujawniania szczegółów SQL.
- Rate limiting:
  - Globalny (middleware) – np. 60 req/min/IP. Dla GET niewielka waga, ale warto spójnie użyć globalnej reguły.

## 7. Obsługa błędów

- `400 invalid_query` – schemat Zod odrzucony (pusty `search`, `limit` poza zakresem, zły `cursor`), lub `InvalidTagCursorError`.
- `500 db_error` – błąd PostgREST/PostgreSQL (`PostgrestError`) przy `select`.
- `500 unexpected_error` – brak `supabase` w kontekście, błąd runtime (np. awaria enkodera Base64).

Wszystkie błędy zwracają envelope:

```json
{
  "error": {
    "code": "<snake_case_code>",
    "message": "...",
    "details": {
      /* opcjonalne */
    }
  }
}
```

## 8. Rozważania dotyczące wydajności

- Pagacja kursorem: pobranie `limit + 1` elementów, obliczenie `has_more`, stabilne sortowanie `sort ASC, id ASC`.
- Wyszukiwanie: `ILIKE` na `name`, `slug` – dla typowych rozmiarów słownika tagów wydajne; w razie wzrostu wolumenu można rozważyć indeksy trigramowe GIN (analogicznie do front/back w `flashcards`) lub materializację.
- Ograniczenia wejścia: `search ≤ 200`, `limit ≤ 100` – chronią przed nadmiernym obciążeniem.
- Minimalna serializacja: kolumny jawnie wylistowane; mapowanie DTO bez dodatkowych joinów.
- Brak nadmiaru logów: zdarzenia 4xx jako `info`, 5xx jako `error` (console), bez zapisu do DB.

## 9. Etapy wdrożenia

1. Walidacja i modele zapytań
   - Dodać plik `src/lib/validation/tags.schema.ts` analogiczny do `categories.schema.ts`:
     - Stałe: `TAG_LIMIT_DEFAULT/MIN/MAX`, `TAG_SORT_FIELDS = ["name","created_at"]`.
     - `tagsQuerySchema` (Zod) z `search`, `limit`, `cursor`, `sort`.
     - `InvalidTagCursorError`, `decodeTagCursor(value: string): number` z dekodowaniem Base64 i walidacją ID > 0.
     - `buildTagsQuery(payload): TagsQuery` – wstrzykuje zdekodowany `cursor` do struktury.

2. Serwis danych
   - Dodać `src/lib/services/tags.service.ts`:
     - `listTags(supabase: SupabaseClient, query: TagsQuery): Promise<{ items: TagDTO[]; hasMore: boolean; nextCursorId: number|null; }>`
     - `from("tags").select("id, name, slug, description, created_at, updated_at")`
     - `order(query.sort, { ascending: true }).order("id", { ascending: true })`
     - Filtrowanie `search` z bezpiecznym escapowaniem wzorca (wykorzystać helper z kategorii).
     - Paginacja `limit + 1`, wyliczenie `hasMore/nextCursorId`, mapowanie do `TagDTO`.

3. Kody błędów
   - Rozszerzyć `src/lib/errors.ts` o:
     - `export const TAG_ERROR_CODES = { INVALID_QUERY, UNAUTHORIZED, RATE_LIMIT_EXCEEDED, DB_ERROR, UNEXPECTED_ERROR } as const;`
     - `export type TagErrorCode = (typeof TAG_ERROR_CODES)[keyof typeof TAG_ERROR_CODES];`

4. Endpoint Astro
   - Utworzyć `src/pages/api/tags.ts`:
     - `export const prerender = false`
     - `GET`:
       - Pobranie `supabase` z `locals.supabase ?? supabaseClient` (fallback dla lokalnych środowisk bez middleware).
       - Parsowanie i walidacja query przez `tagsQuerySchema.safeParse(...)`.
       - Budowa `TagsQuery` przez `buildTagsQuery(...)` (obsługa `InvalidTagCursorError` → `400`).
       - Wywołanie `listTags(...)`, budowa `TagListResponse` + `encodeBase64` kursora.
       - Mapowanie błędów: `PostgrestError` → `500 db_error`; pozostałe → `500 unexpected_error`.
       - Nagłówki: `Content-Type: application/json`.
     - Rejestrowanie zdarzeń:
       - Funkcja `recordTagsEvent({ severity: "info"|"error", status, code, details? })` (analogiczna do `recordCategoriesEvent`), `scope: "api/tags"`.
       - Emitować przy `400/500` (dla GET).

5. Testowe/mocks (opcjonalnie na start, zalecane)
   - Dodać `src/lib/mocks/tags.api.mocks.ts` z przykładami 200/400/500 dla GET (spójne z kontraktem).

6. Dokumentacja
   - Uzupełnić `.ai/api-plan.md` o sekcję `Tags` (rozszerzona treścią z niniejszego planu).
   - Dodać wzmiankę o publicznym GET w README/kontrakcie API.

7. Konwencje i zgodność ze stackiem
   - Astro 5, TypeScript 5, Zod – jak w `categories`.
   - Struktura katalogów: walidacje w `src/lib/validation`, serwisy w `src/lib/services`, endpoint w `src/pages/api`.
   - Supabase: używać typu `SupabaseClient` z `src/db/supabase.client.ts` i instancji z `locals.supabase`.
   - Zasady clean code i wczesne `return` dla błędów w handlerach.
   - Spójna obwiednia błędów i stałe nagłówki JSON.
