## API Endpoint Implementation Plan: PUT `/api/flashcards/:id/tags`

### 1. Przegląd punktu końcowego

- **Cel**: atomowa podmiana zestawu tagów przypiętych do pojedynczej fiszki (flashcard).
- **Zachowanie**: endpoint **zastępuje** bieżące tagi fiszki dokładnie zestawem `tag_ids` z żądania (w tym możliwość wyczyszczenia: `tag_ids: []`).
- **Wymaganie kluczowe (specyfikacja)**: operacja ma być **atomowa** (brak stanów pośrednich typu „usunęło, ale nie dodało”).
- **Warstwa danych**: relacja M:N między `flashcards` i `tags` jest realizowana przez tabelę łączącą `card_tags` (`card_id`, `tag_id`).

### 2. Szczegóły żądania

- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/api/flashcards/:id/tags`
- **Parametry**:
  - **Wymagane**:
    - `id` (path) – UUID fiszki.
  - **Opcjonalne**: brak.
- **Request Body** (JSON):
  - **Wymagane**:
    - `tag_ids: number[]` – lista dodatnich liczb całkowitych (ID tagów).
  - **Zasady walidacji**:
    - `tag_ids` może być puste (`[]`) – oznacza usunięcie wszystkich tagów.
    - Maksymalnie 50 wpisów.
    - Wszystkie ID unikalne.
    - Każdy element dodatnią liczbą całkowitą (`> 0`).

### 3. Szczegóły odpowiedzi

- **200 OK** (powodzenie):
  - Body: **zaktualizowana lista tagów** przypiętych do fiszki po operacji (tablica `TagDTO[]`).
- **400 Bad Request**:
  - Niepoprawny `:id` (nie-UUID).
  - Body nie jest poprawnym JSON.
  - Body nie spełnia schematu (np. brak `tag_ids`, duplikaty, wartości <= 0, za dużo elementów).
- **401 Unauthorized**:
  - Brak zalogowanego użytkownika (`locals.user` nieobecny).
- **404 Not Found**:
  - Fiszka o danym `id` nie istnieje lub nie jest dostępna dla użytkownika (RLS / własność).
  - Co najmniej jeden tag z `tag_ids` nie istnieje.
- **500 Internal Server Error**:
  - Błąd bazy (PostgREST/PostgreSQL) lub nieoczekiwany błąd serwera.

### 4. Przepływ danych

1. **Astro API route**: `src/pages/api/flashcards/[id]/tags.ts` obsługuje `PUT`.
2. **Pobranie klienta Supabase**:
   - Użyj `locals.supabase` (zgodnie z regułami projektu).
   - Jeśli brak klienta w kontekście: zwróć `500`.
3. **Uwierzytelnienie**:
   - Jeśli `!locals.user`: zwróć `401`.
4. **Walidacja parametrów URL**:
   - Zastosuj istniejący `flashcardIdParamSchema` z `src/lib/validation/flashcards.schema.ts`.
   - Błąd → `400`.
5. **Parsowanie i walidacja body**:
   - Wczytaj JSON (odrzuć niepoprawny JSON → `400`).
   - Zweryfikuj `setFlashcardTagsSchema` (nowy schemat w `src/lib/validation/flashcards.schema.ts`) → `400` w razie błędu.
6. **Warstwa serwisowa**:
   - Nowa funkcja serwisowa (np. w `src/lib/services/flashcards.service.ts` albo nowym `src/lib/services/flashcard-tags.service.ts`):
     - `setFlashcardTags(supabase, userId, cardId, { tag_ids }) -> Promise<TagDTO[]>`
7. **Sprawdzenia domenowe** (w serwisie):
   - **Istnienie fiszki**:
     - Najpierw potwierdź istnienie i dostępność fiszki dla użytkownika (np. lekkie `select` po `flashcards` z RLS).
     - Brak → mapuj na `404` (bez ujawniania cudzych zasobów).
   - **Istnienie tagów**:
     - Wykorzystaj istniejącą logikę `ensureTagsExist(...)` (lub jej wydzielenie/reużycie) – brakujące → `FlashcardReferenceError(TAG_NOT_FOUND)` → `404`.
8. **Atomowa podmiana tagów**:
   - Wywołaj RPC w Postgres (nowa funkcja, patrz sekcja „Kroki implementacji”) wykonującą w jednej transakcji:
     - zablokowanie rekordu fiszki (`FOR UPDATE`) dla spójności,
     - usunięcie istniejących wpisów w `card_tags`,
     - wstawienie nowych wpisów dla `tag_ids` (z deduplikacją),
     - opcjonalnie aktualizację `flashcards.updated_at`,
     - zwrot aktualnej listy tagów (`TagDTO[]`) dla odpowiedzi.
9. **Zwrócenie odpowiedzi**:
   - `200` + `TagDTO[]`.

### 5. Względy bezpieczeństwa

- **Autoryzacja / IDOR**:
  - Endpoint musi wymagać `locals.user`.
  - Dostęp do `card_tags` jest kontrolowany przez RLS (w migracji `card_tags_*_linked_owner_or_admin`) powiązany z `flashcards.owner_id`.
  - Dodatkowo w serwisie warto wykonywać jawny „exists check” fiszki, aby móc zwrócić spójne `404`.
- **Walidacja wejścia**:
  - Ogranicz liczbę tagów (max 50) i wymuś unikalność, aby ograniczyć nadużycia (DoS przez wielkie payloady).
- **Minimalizacja ujawniania informacji**:
  - Dla „nie moja fiszka” zwróć `404` (zamiast 403), aby nie ujawniać istnienia zasobu.
- **SQL injection**:
  - Brak ręcznie sklejanych zapytań SQL; używamy Supabase query builder + RPC.
- **Uprawnienia do funkcji RPC**:
  - `REVOKE` dla `public`, `GRANT EXECUTE` tylko dla `authenticated`.
  - Preferuj `SECURITY INVOKER`, aby RLS pozostało aktywne w funkcji.

### 6. Obsługa błędów

- **Błędy walidacji**:
  - `400` + `ApiErrorResponse` (np. `FLASHCARD_ERROR_CODES.INVALID_QUERY` dla paramów, `FLASHCARD_ERROR_CODES.INVALID_BODY` dla body).
  - W `details` umieść listę issue z Zod (`message`, `path`) – zgodnie ze wzorcem z innych endpointów.
- **Brak autoryzacji**:
  - `401` + `FLASHCARD_ERROR_CODES.UNAUTHORIZED`.
- **Braki zasobów**:
  - `404` + `FLASHCARD_ERROR_CODES.NOT_FOUND` (fiszka) lub `FLASHCARD_ERROR_CODES.TAG_NOT_FOUND` (tagi).
- **Błędy DB / nieoczekiwane**:
  - Mapuj błędy PostgREST do `500` (np. `FLASHCARD_ERROR_CODES.DB_ERROR`) lub `500` „unexpected”.
  - Loguj zdarzenia w stylu pozostałych endpointów (`console.info/error` z JSON payloadem) – osobna tabela błędów nie jest tu wymagana.

### 7. Wydajność

- **Jedna operacja transakcyjna w DB**:
  - Zastąpienie tagów w jednym RPC minimalizuje round-tripy i eliminuje stan pośredni.
- **Batch insert**:
  - W funkcji RPC użyj `insert ... select unnest(array)` oraz `distinct`, aby uniknąć konfliktów PK (`(card_id, tag_id)`).
- **Walidacja „tag exists”**:
  - Sprawdzenie istnienia tagów wykonuj jednym `select id from tags where id in (...)`.
- **Indeksy**:
  - `card_tags(tag_id)` już istnieje; PK `(card_id, tag_id)` wspiera szybkie kasowanie po `card_id` i unikalność.

### 8. Kroki implementacji

1. **Dodaj walidację body dla endpointu**:
   - Plik: `src/lib/validation/flashcards.schema.ts`
   - Dodaj `setFlashcardTagsSchema = z.object({ tag_ids: <wymagane array> })`:
     - reużyj istniejące komponenty walidacji (`positiveIntSchema` + reguły unikalności i limitu),
     - upewnij się, że `tag_ids` jest **wymagane** i dopuszcza `[]`.
2. **Dodaj (lub wydziel) logikę serwisową**:
   - Opcja A (preferowana dla spójności): dopisz do `src/lib/services/flashcards.service.ts` eksport:
     - `setFlashcardTags(supabase: SupabaseClient, userId: string, cardId: string, cmd: SetFlashcardTagsCommand): Promise<TagDTO[]>`
   - Opcja B: nowy serwis `src/lib/services/flashcard-tags.service.ts` (jeśli zespół chce utrzymać mniejszy plik).
   - W serwisie:
     - sprawdź istnienie fiszki (RLS + `deleted_at is null`),
     - sprawdź istnienie tagów (`ensureTagsExist`),
     - wywołaj RPC (poniżej),
     - zwróć zmapowane `TagDTO[]`.
3. **Dodaj migrację Supabase: atomowa funkcja RPC**:
   - Nowy plik migracji: `supabase/migrations/YYYYMMDDHHMMSS_set_flashcard_tags_function.sql`
   - Zaimplementuj funkcję w stylu istniejących migracji:
     - `begin; ... commit;`
     - `create or replace function public.set_flashcard_tags(p_owner_id uuid, p_card_id uuid, p_tag_ids bigint[]) returns setof public.tags`
     - `language plpgsql`
     - `security invoker`
     - `set search_path = public`
   - Zalecana logika funkcji:
     - `select 1 from public.flashcards where id=p_card_id and owner_id=p_owner_id and deleted_at is null for update;`
       - jeśli nie znaleziono → `raise exception using errcode='P0001', message='flashcard_not_found';`
     - `delete from public.card_tags where card_id = p_card_id;`
     - jeśli `array_length(p_tag_ids,1) > 0`:
       - `insert into public.card_tags(card_id, tag_id) select p_card_id, x from (select distinct unnest(p_tag_ids) as x) t where x is not null;`
     - opcjonalnie `update public.flashcards set updated_at=now() where id=p_card_id;`
     - `return query select t.* from public.tags t join public.card_tags ct on ct.tag_id=t.id where ct.card_id=p_card_id order by t.id;`
   - Uprawnienia:
     - `revoke all on function public.set_flashcard_tags(uuid, uuid, bigint[]) from public;`
     - `grant execute on function public.set_flashcard_tags(uuid, uuid, bigint[]) to authenticated;`
4. **Dodaj nowy endpoint Astro**:
   - Plik: `src/pages/api/flashcards/[id]/tags.ts`
   - `export const prerender = false;`
   - `export const PUT: APIRoute = async ({ locals, params, request }) => { ... }`
   - Kroki w handlerze:
     - pobierz `supabase` z `locals.supabase`, brak → `500`,
     - wymagaj `locals.user`, brak → `401`,
     - waliduj `params` (`flashcardIdParamSchema`) → `400`,
     - parsuj JSON + waliduj `setFlashcardTagsSchema` → `400`,
     - wywołaj serwis `setFlashcardTags(...)`,
     - zwróć `200` i wynik.
   - Logowanie:
     - loguj sukcesy i błędy podobnie jak inne endpointy (`scope = "api/flashcards/:id/tags"`).
5. **Mapowanie wyjątków / błędów DB**:
   - Obsłuż:
     - `FlashcardReferenceError(TAG_NOT_FOUND)` → `404`,
     - sygnał z RPC `P0001`/`flashcard_not_found` → `404`,
     - pozostałe błędy PostgREST → `500`.
6. **Scenariusze weryfikacji (manualne / testowe) dla zespołu**:
   - Użytkownik A aktualizuje tagi własnej fiszki: `tag_ids=[...]` → `200` i zwrócone tagi.
   - Użytkownik A czyści tagi: `tag_ids=[]` → `200` i `[]`.
   - Niepoprawny UUID w `:id` → `400`.
   - Body bez `tag_ids` / z duplikatami / z `0` / z >50 elementami → `400`.
   - Brak sesji → `401`.
   - Próba aktualizacji fiszki użytkownika B → `404`.
   - `tag_ids` zawiera nieistniejące ID → `404`.
