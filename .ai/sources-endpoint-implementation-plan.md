## API Endpoint Implementation Plan: GET /api/sources

## 1. Przegląd punktu końcowego

Publiczny endpoint listujący źródła treści (książki, artykuły, kursy, adresy URL, inne) używane jako metadane i filtry przy fiszkach. Obsługuje filtrowanie po `kind`, wyszukiwanie po `name/slug`, stabilną paginację kursorem i sortowanie. Kontrakt i styl są spójne z `GET /api/categories` i `GET /api/tags`.

## 2. Szczegóły żądania

- Metoda HTTP: GET
- Struktura URL: `/api/sources`
- Parametry (query):
  - Wymagane: —
  - Opcjonalne:
    - `kind` (enum) – jedno z: `book`, `article`, `course`, `url`, `other`, `documentation`, `notes`.
    - `search` (string) – trymerowane, case-insensitive `ILIKE` po `name` i `slug`; długość 1..200; pusty string jest odrzucany.
    - `limit` (int) – domyślnie `20`, zakres `1..100`. Backend pobiera `limit + 1` elementów do detekcji `has_more`.
    - `cursor` (string) – Base64 zakodowany dodatni identyfikator (`id`) ostatniego rekordu poprzedniej strony. Błędna Base64 lub `id ≤ 0` → `400 invalid_query`.
    - `sort` (enum) – `name|created_at`, domyślnie `name`. Zawsze dodatkowy secondary sort `id ASC` dla determinizmu.
- Request Body: —

## 3. Wykorzystywane typy

- Z `src/types.ts`:
  - `SourceDTO` – `{ id, name, slug, description, kind, url, created_at, updated_at }`
  - `SourceListResponse` – `PaginatedResponse<SourceDTO>`
- Nowe w tym wdrożeniu:
  - `SourcesQuery` – `{ kind?, search?, limit, cursor?, sort }`
  - `SourcesQuerySchema` (Zod)
  - `InvalidSourceCursorError`
  - `SOURCE_LIMIT_DEFAULT/MIN/MAX`, `SOURCE_SORT_FIELDS = ["name","created_at"]`
  - `SOURCE_ERROR_CODES` i `SourceErrorCode` (analogiczne do `CATEGORY_ERROR_CODES` / `TAG_ERROR_CODES`)

## 4. Szczegóły odpowiedzi

- Sukces `200 OK`:

```json
{
  "data": [
    {
      "id": 2,
      "name": "Effective TypeScript",
      "slug": "effective-typescript",
      "description": "Practical guide",
      "kind": "book",
      "url": "https://example.com",
      "created_at": "2025-11-30T10:00:00.000Z",
      "updated_at": "2025-11-30T10:00:00.000Z"
    }
  ],
  "page": { "next_cursor": "Mg==", "has_more": true }
}
```

- Kody statusu:
  - `200 OK` – poprawny odczyt.
  - `400 Bad Request` – nieprawidłowe query (`invalid_query`: pusty `search`, błędny `cursor`, `limit` poza zakresem, `sort`/`kind` poza dozwolonym zbiorem).
  - `500 Internal Server Error` – błąd bazy (`db_error`) lub nieoczekiwany błąd środowiska (`unexpected_error`).

## 5. Przepływ danych

1. Klient wywołuje `GET /api/sources` z `kind?`, `search?`, `limit?`, `cursor?`, `sort?`.
2. Astro endpoint `src/pages/api/sources.ts`:
   - `export const prerender = false`
   - Pobiera Supabase z `locals.supabase` (fallback: `supabaseClient`) zgodnie z zasadą backend.
   - Waliduje query schematem Zod (`sourcesQuerySchema.safeParse(...)`).
   - Buduje `SourcesQuery` (w tym dekodowanie kursora Base64 → `number`; błędy → `InvalidSourceCursorError`).
3. Serwis `src/lib/services/sources.service.ts`:
   - `from("sources").select("id, name, slug, description, kind, url, created_at, updated_at")`
   - Filtrowanie:
     - `if (query.kind) eq("kind", query.kind)`
     - `if (query.search) or("name.ilike.%...%,slug.ilike.%...%")` z bezpiecznym escapowaniem wzorca (ten sam helper co w tags/categories).
   - Sortowanie: `order(query.sort, { ascending: true }).order("id", { ascending: true })`
   - Paginacja: `gt("id", cursor)` + `limit(limit + 1)`; oblicza `hasMore`, `nextCursorId`.
   - Mapowanie do `SourceDTO[]`.
4. Endpoint koduje `next_cursor` (Base64) i zwraca `SourceListResponse`.
5. Zdarzenia 4xx/5xx logowane jako structured console log (`scope: "api/sources"`, `userId = DEFAULT_USER_ID`), podobnie jak w `api/tags`.

## 6. Względy bezpieczeństwa

- RLS: `sources` ma polityki publicznego SELECT dla ról `anon` i `authenticated` (patrz migracja). GET jest publiczny.
- Walidacja wejścia:
  - `kind` ograniczone do dozwolonego zbioru enum (spójnie z CHECK w DB).
  - `search` trim, 1..200; `cursor` Base64 → dodatni `id`; `limit` w zakresie.
  - `sort` ograniczone do białej listy.
- Odporność na wstrzyknięcia:
  - Użycie query buildera PostgREST oraz escapowanie wzorców `ILIKE` (`%`, `_`, `\`, `,`) – ten sam helper co w tags.
- Ograniczanie ujawniania informacji:
  - Mapowanie błędów DB do `db_error` bez przekazywania detali SQL poza `{ code, message }`.
- Rate limiting:
  - Globalny (middleware) – np. 60 req/min/IP (spójnie z pozostałymi publicznymi GET).

## 7. Obsługa błędów

- `400 invalid_query` – błąd schematu Zod (pusty `search`, zły `sort`, zły `kind`, limit poza zakresem), błędny `cursor` (Base64 lub `id ≤ 0`).
- `500 db_error` – błąd PostgREST/PostgreSQL przy SELECT (zwróć `{ code, message }` z Supabase w `details`).
- `500 unexpected_error` – brak klienta Supabase w kontekście, wyjątek runtime (np. awaria enkodera Base64).

Wspólna obwiednia:

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

- Pagacja kursorem: `limit + 1`, stabilne sortowanie `sort ASC, id ASC`.
- Wyszukiwanie: `ILIKE` na `name`, `slug` – przy wzroście wolumenu można dodać indeksy trigramowe lub materializacje (analogicznie jak rozważane dla tagów).
- Filtr `kind`: proste `eq` po kolumnie tekstowej (lekki warunek).
- Minimalna projekcja kolumn: jawna lista bez joinów.
- Ograniczenia wejścia: `limit ≤ 100`, `search ≤ 200`.

## 9. Etapy wdrożenia

1. Walidacja i modele zapytań

- Dodać `src/lib/validation/sources.schema.ts`:
  - Stałe: `SOURCE_LIMIT_DEFAULT=20`, `SOURCE_LIMIT_MIN=1`, `SOURCE_LIMIT_MAX=100`.
  - `SOURCE_SORT_FIELDS = ["name", "created_at"] as const`.
- `SOURCE_KIND_VALUES = ["book","article","course","url","other","documentation","notes"] as const`.
  - `SourcesQuery` i `sourcesQuerySchema` (Zod) z polami: `kind?`, `search?`, `limit`, `cursor?`, `sort`.
  - `InvalidSourceCursorError`, `decodeSourceCursor(value: string): number`.
  - `buildSourcesQuery(payload: SourcesQuerySchema): SourcesQuery` – wstrzykuje zdekodowany `cursor`.

2. Serwis danych

- Dodać `src/lib/services/sources.service.ts`:
  - `listSources(supabase: SupabaseClient, query: SourcesQuery): Promise<{ items: SourceDTO[]; hasMore: boolean; nextCursorId: number|null }>`
  - `from("sources").select("id, name, slug, description, kind, url, created_at, updated_at")`
  - Filtrowanie `kind` (eq), wyszukiwanie `ILIKE` (escapowany wzorzec) po `name,slug`.
  - Sortowanie `query.sort ASC` + `id ASC`.
  - Paginacja `limit + 1`, wyliczenie `hasMore/nextCursorId`, mapowanie do `SourceDTO`.
  - Reużyć helper `escapeIlikePattern` z `tags.service.ts` albo wyekstrahować do wspólnego utila (opcjonalnie).

3. Kody błędów

- Rozszerzyć `src/lib/errors.ts` o:
  - `export const SOURCE_ERROR_CODES = { INVALID_QUERY, UNAUTHORIZED, RATE_LIMIT_EXCEEDED, DB_ERROR, UNEXPECTED_ERROR } as const;`
  - `export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[keyof typeof SOURCE_ERROR_CODES];`

4. Endpoint Astro

- Dodać `src/pages/api/sources.ts`:
  - `export const prerender = false`
  - `GET`:
    - Pobierz `supabase` z `locals.supabase ?? supabaseClient`.
    - Zbuduj `rawQuery` z `url.searchParams`.
    - Walidacja: `sourcesQuerySchema.safeParse(...)`. W przypadku niepowodzenia → `400 invalid_query` + `recordSourcesEvent({ severity:"info", ... })`.
    - `buildSourcesQuery(...)` z obsługą `InvalidSourceCursorError` → `400 invalid_query`.
    - `listSources(...)` i zbudowanie `SourceListResponse` z `next_cursor` (Base64) poprzez helper `encodeBase64`.
    - Błędy PostgREST → `500 db_error` (+ detale `{ code, message }`); niespodziewane → `500 unexpected_error`.
    - Nagłówki: `Content-Type: application/json`.
  - Logowanie:
    - `recordSourcesEvent({ severity: "info"|"error", status, code, details? })` (analogicznie do `recordTagsEvent`), `scope: "api/sources"`, `userId: DEFAULT_USER_ID`.

5. Mocks

- Dodać `src/lib/mocks/sources.api.mocks.ts` z przykładami 200/400/500 (spójne z kontraktem i z innymi endpointami).

6. Dokumentacja i kontrakt

- Uzupełnić `.ai/api-plan.md` w sekcji `Sources` o szczegóły (parametry, kody błędów, przykładowa odpowiedź).

7. Zgodność ze stackiem i zasadami

- Astro 5, TypeScript 5, Zod (walidacja), Supabase z `context.locals`.
- Spójna struktura katalogów: `src/pages/api`, `src/lib/services`, `src/lib/validation`, `src/lib/mocks`.
- Wczesne zwroty przy błędach, czytelne kody i nazwy.

8. Kontrola jakości

- Linter/typy powinny przejść bez błędów.
- Ręczny smoke-test: przypadki bez parametrów, z `kind`, z `search`, z paginacją (`cursor`), błędny `cursor`, `limit` poza zakresem.
