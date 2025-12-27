# Review Sessions & Events API Endpoints Implementation Plan

## API Endpoint Implementation Plan: POST /api/review-sessions

### 1. Przegląd punktu końcowego

- **Cel**: Przetwarza batch wyników sesji powtórkowej i aktualizuje statystyki używając algorytmu SuperMemo 2. Dla każdej recenzji wywołuje `supermemo(currentItem, grade)` gdzie grade jest mapowany z outcome (0-5 skala), następnie aktualizuje `review_stats` z nowymi wartościami interval, repetition, efactor.
- **Zakres uprawnień**: **Wszyscy uwierzytelnieni użytkownicy** - każdy użytkownik może recenzować tylko swoje własne karty.
- **Kontrakt**:
  - Sukces: `201 Created` z podsumowaniem `{ "logged": <count> }`.
  - Błędy: `ApiErrorResponse` z kodami zgodnymi z `REVIEW_ERROR_CODES`.

### 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Ścieżka**: `/api/review-sessions`
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <jwt>` (wymagany kontekst użytkownika dla RLS)
  - **Opcjonalne**: `Accept: application/json`
- **Parametry**:
  - **Wymagane w body**:
    - `session_id` (UUID)
    - `started_at` (ISO date string)
    - `completed_at` (ISO date string)
    - `reviews[]` (tablica recenzji, min 1 element)
  - **Opcjonalne**: brak
- **Request Body**:

```json
{
  "session_id": "uuid",
  "started_at": "2024-01-01T10:00:00.000Z",
  "completed_at": "2024-01-01T10:15:00.000Z",
  "reviews": [
    {
      "card_id": "uuid",
      "outcome": "good",
      "grade": 4,
      "response_time_ms": 2500,
      "prev_interval_days": 3,
      "next_interval_days": 5,
      "was_learning_step": false,
      "payload": { "deck": "networking" }
    }
  ]
}
```

### 3. Wykorzystywane typy (DTO i Command modele)

- **DTO**:
  - `ApiErrorResponse<ReviewErrorCode>` (z `src/types.ts` + `src/lib/errors.ts`)
- **Command modele**:
  - `CreateReviewSessionCommand` (z `src/types.ts`) – wejście
  - `ReviewSessionEntryCommand` (z `src/types.ts`) – pojedyncza recenzja

### 4. Szczegóły odpowiedzi

- **201 Created**:
  - Zwraca obiekt `{ "logged": <number> }` z liczbą przetworzonych recenzji.
- **400 Bad Request**:
  - `error.code = "invalid_body"` gdy niepoprawny JSON/schemat (Zod)
- **401 Unauthorized**:
  - `error.code = "unauthorized"` gdy brak sesji (`locals.user`) lub nieprawidłowy JWT
- **404 Not Found**:
  - `error.code = "card_not_found"` gdy `card_id` nie istnieje lub nie należy do użytkownika
- **422 Unprocessable Entity**:
  - `error.code = "invalid_outcome"` gdy `outcome` nie należy do enum `review_outcome`
  - `error.code = "invalid_grade"` gdy `grade` poza zakresem 0-5
- **500 Internal Server Error**:
  - `error.code = "db_error"` dla błędów PostgREST/PostgreSQL,
  - `error.code = "unexpected_error"` dla pozostałych wyjątków runtime.

### 5. Przepływ danych

1. **Astro API Route**: `src/pages/api/review-sessions.ts` (do utworzenia).
2. **Guard rails / preconditions**:
   - `locals.supabase` musi być dostępne (zgodnie z regułami: używać klienta z `context.locals`, nie importować globalnego klienta).
   - `locals.user` musi istnieć (inaczej `401 unauthorized`).
3. **Walidacja body**:
   - Zod: `createReviewSessionSchema.safeParse(requestBody)` + sprawdzenie własności kart.
4. **Warstwa serwisowa**:
   - Dodać `createReviewSession(...)` w `src/lib/services/review-sessions.service.ts`.
   - Dla każdej recenzji:
     - Pobrać aktualne `review_stats` dla `(user_id, card_id)`
     - Wywołać `supermemo({ interval, repetition, efactor }, grade)` → nowe wartości
     - Zapisać `review_event` + trigger aktualizuje `review_stats`
5. **Odpowiedź**:
   - `201` + JSON `{ "logged": count }`.
6. **Observability**:
   - Każdy `4xx/5xx` logować jako zdarzenie JSON ze `scope: "api/review-sessions"`.

### 6. Względy bezpieczeństwa

- **Autentykacja**:
  - Endpoint wymaga użytkownika w `locals.user` (brak → `401`).
- **Autoryzacja (ownership)**:
  - Sprawdzenie czy wszystkie `card_id` należą do użytkownika przed przetwarzaniem.
  - RLS na `review_events` i `review_stats` wymusza `owner_id = auth.uid()`.
- **Ryzyka**:
  - **Batch validation**: wszystkie karty sprawdzane przed rozpoczęciem przetwarzania (fail-fast).
  - **Rate limiting**: rozważyć limit recenzji na minutę/godzinę.

### 7. Wydajność

- **Operacje DB**:
  - Minimalnie: N×(SELECT stats + INSERT event) gdzie N = liczba recenzji.
  - Zalecenie: równoległe przetwarzanie recenzji w batchu.
- **Indeksy**:
  - Operacja korzysta z PK `flashcards.id`, indeksów na `review_stats(user_id, card_id)`.

### 8. Kroki implementacji

#### 8.1. Warstwa walidacji (`src/lib/validation/review-sessions.schema.ts`)

- **Utworzyć schemat** `createReviewSessionSchema`:
  - `session_id`: UUID
  - `started_at`, `completed_at`: ISO dates
  - `reviews`: array min 1, każdy z:
    - `card_id`: UUID
    - `outcome`: enum `review_outcome`
    - `grade`: number 0-5
    - opcjonalne: `response_time_ms`, `prev/next_interval_days`, `was_learning_step`, `payload`

#### 8.2. Warstwa serwisowa (`src/lib/services/review-sessions.service.ts`)

- **Dodać funkcję** `createReviewSession(supabase: SupabaseClient, userId: string, cmd: CreateReviewSessionCommand): Promise<{ logged: number }>`:
  - Sprawdź własność wszystkich kart jednym zapytaniem
  - Dla każdej recenzji: pobierz stats, wywołaj supermemo, zapisz event
  - Zwróć count przetworzonych recenzji

#### 8.3. API Route (Astro)

- **Utworzyć plik**: `src/pages/api/review-sessions.ts`
  - `export const prerender = false`
  - `POST`: walidacja auth, parsowanie body, wywołanie serwisu, obsługa błędów
  - Logowanie zdarzeń dla wszystkich odpowiedzi

#### 8.4. Błędy/kontrakty

- **Rozszerz** `src/lib/errors.ts` o `REVIEW_ERROR_CODES`:
  - `INVALID_BODY`, `UNAUTHORIZED`, `CARD_NOT_FOUND`, `INVALID_OUTCOME`, `INVALID_GRADE`, `DB_ERROR`, `UNEXPECTED_ERROR`

#### 8.5. Mocks kontraktowe

- **Rozszerz** `src/lib/mocks/review.api.mocks.ts` o scenariusze dla:
  - `201` success
  - `400 invalid_body`
  - `401 unauthorized`
  - `404 card_not_found`
  - `422 invalid_outcome`
  - `500 db_error`

## API Endpoint Implementation Plan: GET /api/review-events

### 1. Przegląd punktu końcowego

- Zwraca listę wydarzeń powtórkowych uwierzytelnionego użytkownika, z opcjonalnymi filtrami i paginacją.
- Obsługuje filtrowanie po `card_id`, zakresie dat `from/to`, limit i kursor.
- Zwraca paginowaną listę `ReviewEventDTO`.

### 2. Szczegóły żądania

- **Metoda HTTP**: `GET`
- **Ścieżka**: `/api/review-events`
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <jwt>`
- **Parametry**:
  - **Opcjonalne (query)**:
    - `card_id` (UUID) - filtr dla konkretnej karty
    - `from` (ISO date) - zakres dat od
    - `to` (ISO date) - zakres dat do
    - `limit` (int 1-100, domyślnie 20)
    - `cursor` (string) - dla paginacji

### 3. Wykorzystywane typy

- `ReviewEventDTO`, `ReviewEventListResponse` (z `src/types.ts`)
- `ReviewEventsQuery` - nowy interfejs dla parametrów query

### 4. Szczegóły odpowiedzi

- **200 OK**:
  - Body: `ReviewEventListResponse` z paginacją kursorową
- **400 Bad Request**:
  - `error.code = "invalid_query"` dla niepoprawnych parametrów
- **401 Unauthorized**:
  - `error.code = "unauthorized"` gdy brak autoryzacji

### 5. Przepływ danych

1. Walidacja parametrów query przez Zod
2. Serwis `getReviewEvents()` z filtrami i paginacją
3. RLS automatycznie filtruje po `user_id`

### 6. Względy bezpieczeństwa

- RLS wymusza `owner_id = auth.uid()`
- Walidacja wszystkich parametrów wejściowych

### 7. Wydajność

- Indeksy na `review_events(user_id, reviewed_at DESC)`
- Paginacja kursorowa dla skalowalności

### 8. Obsługa błędów

- `400 invalid_query` - błędne parametry
- `401 unauthorized` - brak autoryzacji
- `500 db_error` - błędy bazy danych

### 9. Etapy wdrożenia

1. **Walidacja**: Rozszerz `review-sessions.schema.ts` o `reviewEventsQuerySchema`
2. **Serwis**: Dodaj `getReviewEvents()` do `review-sessions.service.ts`
3. **Endpoint**: Utwórz `src/pages/api/review-events.ts`
4. **Błędy**: Rozszerz `REVIEW_ERROR_CODES`
5. **Mocks**: Dodaj przypadki testowe

## API Endpoint Implementation Plan: GET /api/review-stats

### 1. Przegląd punktu końcowego

- Zwraca zagregowane statystyki powtórkowe dla uwierzytelnionego użytkownika.
- Obsługuje filtrowanie po `card_id`, `next_review_before` z paginacją.

### 2. Szczegóły żądania

- **Metoda HTTP**: `GET`
- **Ścieżka**: `/api/review-stats`
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <jwt>`
- **Parametry**:
  - **Opcjonalne (query)**:
    - `card_id` (UUID)
    - `next_review_before` (ISO date)
    - `limit` (int 1-100, domyślnie 20)
    - `cursor` (string)

### 3. Wykorzystywane typy

- `ReviewStatsDTO`, `ReviewStatsListResponse` (z `src/types.ts`)
- `ReviewStatsQuery` - nowy interfejs dla parametrów query

### 4. Szczegóły odpowiedzi

- **200 OK**:
  - Body: `ReviewStatsListResponse` z paginacją
- **400 Bad Request**:
  - `error.code = "invalid_query"` dla błędnych parametrów
- **401 Unauthorized**:
  - `error.code = "unauthorized"` gdy brak autoryzacji

### 5. Przepływ danych

1. Walidacja parametrów query
2. Serwis `getReviewStats()` z filtrami i paginacją
3. RLS filtruje po `user_id`

### 6. Względy bezpieczeństwa

- RLS wymusza `user_id = auth.uid()`
- Walidacja parametrów wejściowych

### 7. Wydajność

- Indeks na `review_stats(user_id, card_id)`
- Paginacja kursorowa

### 8. Obsługa błędów

- `400 invalid_query` - błędne parametry
- `401 unauthorized` - brak autoryzacji
- `500 db_error` - błędy bazy danych

### 9. Etapy wdrożenia

1. **Walidacja**: Dodaj `reviewStatsQuerySchema` do schematów
2. **Serwis**: Implementuj `getReviewStats()` w serwisie
3. **Endpoint**: Utwórz `src/pages/api/review-stats.ts`
4. **Błędy**: Rozszerz kody błędów
5. **Mocks**: Dodaj przypadki testowe
