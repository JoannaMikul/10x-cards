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
