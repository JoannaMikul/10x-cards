## Plan implementacji widoku Powtórki (`/reviews`)

## 1. Przegląd

Widok **Powtórki** zapewnia minimalny, ale kompletny player sesji powtórek fiszek, integrujący się z backendowym modułem spaced repetition (SuperMemo 2 przez endpoint `POST /api/review-sessions`). Użytkownik otrzymuje sekwencję wybranych kart, może odsłonić odpowiedź, ocenić swoją odpowiedź w skali 0–5 (mapowanej na outcome `again/fail/hard/good/easy`), obserwować postęp sesji oraz podstawowe statystyki bieżącej karty (np. liczba powtórek, success rate, następna recenzja). Widok współpracuje z listą fiszek (`/flashcards`), z której pochodzi zakres kart do powtórki, oraz z endpointem `GET /api/review-stats`, który dostarcza aktualne statystyki dla kart. Całość musi być dostępna (keyboard-first, duże cele dotykowe, `aria-live`) i spójna z istniejącym systemem błędów oraz kontekstami aplikacji.

## 2. Routing widoku

- **Ścieżka URL**: `/reviews`.
- **Pliki routingu**:
  - `src/pages/reviews.astro`
    - Odpowiada za:
      - osadzenie globalnego layoutu (`Layout.astro`),
      - hydratację Reactowego komponentu strony (`<ReviewsPage client:load />` lub `client:only="react"`),
      - przekazanie danych SSR (jeśli zajdzie potrzeba, np. sesja/auth) do Reacta przez props.
  - `src/components/reviews/ReviewsPage.tsx`
    - Główny komponent React odpowiadający za całą logikę CSR w widoku Powtórek.
- **Gating dostępu**:
  - Middleware (`src/middleware/index.ts`) już pilnuje autentykacji; widok `/reviews` jest dostępny tylko dla zalogowanych użytkowników.
  - Przy błędach 401 z API obowiązuje globalna zasada: redirect do `/login?returnTo=/reviews`.

## 3. Struktura komponentów

- `ReviewsPage`
  - Odpowiada za:
    - pobranie/odtworzenie konfiguracji sesji (z `/flashcards` lub fallback do „due cards” w przyszłości),
    - inicjalizację custom hooka `useReviewSession`,
    - renderowanie głównego playera lub stanów specjalnych (empty/error).
  - Dzieci:
    - `ReviewPlayer`
    - opcjonalnie `EmptyState`, `ErrorBanner` (istniejące komponenty wspólne).

- `ReviewPlayer`
  - Odpowiada za:
    - prezentację pojedynczej karty i sterowanie przepływem sesji.
  - Dzieci:
    - `ProgressBar`
    - `StatsSnippet`
    - `ReviewCard` (sekcja pytanie/odpowiedź)
    - `OutcomeButtons`
    - `KeyboardShortcuts`

- `ProgressBar`
  - Prosty komponent prezentujący postęp sesji (np. pasek + licznik `3/20`).

- `StatsSnippet`
  - Odpytywanie `GET /api/review-stats` dla bieżącej karty i wyświetlanie podstawowych statystyk.

- `ReviewCard`
  - Prezentacja treści fiszki (front/back) oraz przycisk „Pokaż odpowiedź”.

- `OutcomeButtons`
  - Pasek przycisków wyników (`Again (0)`, `Fail (1)`, `Hard (2)`, `Good (3)`, `Easy (4)`), wykorzystujący shadcn/ui `Button`.

- `KeyboardShortcuts`
  - Wyświetlenie legendy skrótów oraz (wewnętrznie) rejestracja skrótów klawiaturowych za pomocą hooka `useReviewKeyboardShortcuts`.

- Globalne:
  - `Toasts` (już istniejące, używane do komunikatów sukcesu/błędu).

## 4. Szczegóły komponentów

### `ReviewsPage`

- **Opis komponentu**:
  - Główny komponent React widoku `/reviews`. Odpowiada za przygotowanie danych wejściowych sesji powtórek (lista kart, konfiguracja), inicjalizację hooka `useReviewSession` oraz renderowanie playera (`ReviewPlayer`) lub stanów specjalnych (brak kart, błąd).
- **Główne elementy**:
  - Kontener strony (`<main>` z Tailwind layoutem).
  - Sekcja z playerem powtórek (wewnątrz `ReviewPlayer`).
  - Ewentualne komponenty:
    - `EmptyState` – jeśli brak kart w sesji.
    - `ErrorBanner` lub `Alert` – jeśli inicjalizacja sesji nie powiedzie się.
- **Obsługiwane interakcje**:
  - Brak bezpośrednich interakcji użytkownika poza ewentualnymi przyciskami w stanach specjalnych (np. „Wróć do listy fiszek”).
- **Obsługiwana walidacja**:
  - Walidacja wejścia do widoku:
    - jeśli nie ma poprawnego `ReviewSessionConfig` lub lista kart jest pusta → wyświetlany `EmptyState`.
  - (Opcjonalnie) Walidacja, czy liczba kart nie przekracza 100 (limit jednego requestu do `POST /api/review-sessions`):
    - jeśli > 100, w MVP można:
      - ograniczyć sesję do pierwszych 100 kart i wyświetlić ostrzeżenie w banerze.
- **Typy**:
  - DTO: `FlashcardDTO`, `FlashcardSelectionState`.
  - ViewModel: `ReviewSessionConfig`, `ReviewSessionState`.
- **Propsy**:
  - W MVP:
    - `initialConfig?: ReviewSessionConfig` – przekazywany z `/flashcards` lub z SSR (opcjonalnie).
  - W typowym scenariuszu `ReviewsPage` może odczytywać konfigurację z kontekstu/routera zamiast propsów – interfejs propsów powinien to umożliwiać, ale nie wymuszać.

### `ReviewPlayer`

- **Opis komponentu**:
  - Główny player obsługujący pojedynczą sesję powtórek. Używa `useReviewSession` (przekazanego z `ReviewsPage`) do pobrania aktualnego stanu sesji (`currentCard`, `progress`, `isAnswerRevealed`, `status`, handlerów). Koordynuje wyświetlanie pytania/odpowiedzi, przycisków wyników, progress baru, statystyk oraz skrótów klawiaturowych.
- **Główne elementy**:
  - Nagłówek sekcji z tytułem („Sesja powtórek”).
  - `ProgressBar` w górnej części playera.
  - Główny obszar karty:
    - `ReviewCard` (front/back + przycisk „Pokaż odpowiedź”).
    - `StatsSnippet` (po prawej / pod kartą, w zależności od breakpointu).
  - Dolny pasek akcji:
    - `OutcomeButtons` (główne CTA).
    - Tekstowy/ikonowy komponent `KeyboardShortcuts`.
- **Obsługiwane interakcje**:
  - Delegowane do:
    - `ReviewCard` (klik „Pokaż odpowiedź”).
    - `OutcomeButtons` (wybór wyniku).
    - `KeyboardShortcuts` (skróty klawiszowe).
  - Własne:
    - Przycisk „Zapisz sesję” po zakończeniu wszystkich kart.
- **Obsługiwana walidacja**:
  - Nie pozwala na ocenę wyniku (`recordOutcome`) przed odsłonięciem odpowiedzi:
    - jeśli `isAnswerRevealed === false`, przyciski wyników są disabled lub kliknięcie jest ignorowane.
  - Waliduje możliwość wysłania sesji:
    - przycisk „Zapisz sesję” aktywny tylko, gdy `canSubmit === true` (czyli istnieją zarejestrowane wpisy i sesja nie jest w stanie `submitting`).
- **Typy**:
  - DTO: `FlashcardDTO`.
  - ViewModel: `ReviewCardViewModel`, `ReviewSessionState`, `ReviewOutcomeUi`, `Grade0to5`.
- **Propsy**:
  - `cards: ReviewCardViewModel[]`
  - `sessionState: ReviewSessionState`
  - `onRevealAnswer(): void`
  - `onRecordOutcome(outcome: ReviewOutcomeUi, grade: Grade0to5): void`
  - `onSubmitSession(): Promise<void>`

### `ReviewCard`

- **Opis komponentu**:
  - Prezentuje zawartość pojedynczej fiszki w kontekście sesji: pytanie (`front`) i odpowiedź (`back`). W trybie początkowym pokazuje tylko front; po kliknięciu przycisku „Pokaż odpowiedź” (lub skrócie klawiaturowym) ujawnia back.
- **Główne elementy**:
  - Kontener karty (np. shadcn `Card`).
  - Sekcja pytania:
    - Tekst `front` (przycięty, ale z możliwością scrollowania).
  - Sekcja odpowiedzi:
    - Tekst `back` (widoczny tylko po odsłonięciu).
  - Przycisk `Button` „Pokaż odpowiedź” (lub „Ukryj odpowiedź”, jeśli pojawi się taka potrzeba).
- **Obsługiwane interakcje**:
  - Kliknięcie przycisku „Pokaż odpowiedź”.
  - Dostępność:
    - Focus ring na przycisku.
    - Możliwość aktywacji klawiszem Enter/Space.
- **Obsługiwana walidacja**:
  - Brak walidacji danych (front/back są już zweryfikowane na wcześniejszych etapach).
  - Jedynie guard na sytuację, gdy `card` jest `null` (np. przy braku kart) → wyświetlenie przyjaznego komunikatu.
- **Typy**:
  - DTO: `FlashcardDTO`.
  - ViewModel: `ReviewCardViewModel`.
- **Propsy**:
  - `card: ReviewCardViewModel | null`
  - `isAnswerRevealed: boolean`
  - `onRevealAnswer(): void`

### `OutcomeButtons`

- **Opis komponentu**:
  - Pasek przycisków reprezentujących możliwe wyniki recenzji (`again/fail/hard/good/easy`) wraz z odpowiadającymi im ocenami liczbowymi (0–4/5). Zapewnia duże cele dotykowe i czytelne etykiety, oraz łączy się semantycznie z klawiszami skrótów.
- **Główne elementy**:
  - Kontener (flex) z pięcioma przyciskami shadcn `Button`:
    - `Again (0)` – outcome `"again"`, `grade = 0`.
    - `Fail (1)` – outcome `"fail"`, `grade = 1`.
    - `Hard (2)` – outcome `"hard"`, `grade = 2`.
    - `Good (3)` – outcome `"good"`, `grade = 3`.
    - `Easy (4)` – outcome `"easy"`, `grade = 4`.
  - Opcjonalnie podpowiedź skrótu (np. mały tekst `1`, `2`, `3`, `4`, `5`).
- **Obsługiwane interakcje**:
  - Kliknięcie na dowolny przycisk:
    - wywołuje `onSelect(outcome, grade)`.
  - Stan disabled:
    - jeśli odpowiedź nie została jeszcze odsłonięta (`props.disabled === true`),
    - jeśli sesja jest w trakcie wysyłki (`status === "submitting"`),
    - jeśli sesja jest już zakończona (`status === "completed"`).
- **Obsługiwana walidacja**:
  - Brak walidacji danych wejściowych poza typami (enum).
  - Walidacja stanu przycisków (disabled) w zależności od `isAnswerRevealed` i `sessionState.status`.
- **Typy**:
  - ViewModel: `ReviewOutcomeUi`, `Grade0to5`.
- **Propsy**:
  - `disabled: boolean`
  - `onSelect(outcome: ReviewOutcomeUi, grade: Grade0to5): void`

### `KeyboardShortcuts`

- **Opis komponentu**:
  - Prezentuje legendę dostępnych skrótów klawiszowych oraz inicjuje ich obsługę (za pomocą wewnętrznego hooka `useReviewKeyboardShortcuts`). Zapewnia dodatkowe `aria-keyshortcuts` i informacje dla użytkowników klawiatury.
- **Główne elementy**:
  - Lista / mały panel tekstowy opisujący:
    - `Spacja` – pokaż/ukryj odpowiedź.
    - `1–5` – wybór wyniku (od `Again` do `Easy`).
    - `Enter`/`→` – przejście do następnej karty (o ile odpowiedź oceniona).
- **Obsługiwane interakcje**:
  - Rejestrowane przez hook:
    - `Space` → `onRevealAnswer`.
    - `Digit1`–`Digit5` → odpowiednie `onSelectOutcome`.
    - `Enter`, `ArrowRight` → przejście do kolejnej karty (jeśli to ma sens).
- **Obsługiwana walidacja**:
  - Hook `useReviewKeyboardShortcuts`:
    - ignoruje eventy, gdy `event.target` jest `input`, `textarea` lub innym kontrolką edytowalną,
    - nie przechwytuje skrótów z modyfikatorami (`Ctrl`, `Meta`, `Alt`).
- **Typy**:
  - ViewModel: `ReviewOutcomeUi`, `Grade0to5`.
- **Propsy**:
  - `onRevealAnswer(): void`
  - `onSelectOutcome(outcome: ReviewOutcomeUi, grade: Grade0to5): void`
  - `canGoNext: boolean`
  - `onGoNext(): void`

### `ProgressBar`

- **Opis komponentu**:
  - Wyświetla postęp sesji w postaci paska oraz tekstu `aktualna_karta / liczba_kart`. Ma charakter informacyjny, nieinteraktywny.
- **Główne elementy**:
  - shadcn `Progress` lub prosty div z Tailwind, plus tekstowy label.
- **Obsługiwane interakcje**:
  - Brak.
- **Obsługiwana walidacja**:
  - Upewnienie się, że `current` mieści się w zakresie `0..total`.
- **Typy**:
  - Prosty typ:
    - `current: number`
    - `total: number`
- **Propsy**:
  - `current: number`
  - `total: number`

### `StatsSnippet`

- **Opis komponentu**:
  - Mały panel wyświetlający aktualne statystyki powtórek dla bieżącej karty (`cardId`), korzystający z `GET /api/review-stats`. Zawiera minimalne informacje takie jak: liczba powtórek, success rate, aktualna passa, data następnej recenzji.
- **Główne elementy**:
  - Kontener (np. karta / box z nagłówkiem „Statystyki tej karty”).
  - Zawartość:
    - `Łączna liczba powtórek`.
    - `Success rate` (np. 80%).
    - `Obecna passa sukcesów`.
    - `Następna recenzja` (data/relative time).
  - Stany:
    - skeleton / spinner, gdy `loading === true`.
    - „Brak statystyk” (np. pierwsza recenzja) gdy brak danych.
    - mały komunikat błędu, gdy `error` (bez blokowania reszty UI).
- **Obsługiwane interakcje**:
  - Brak interaktywnych elementów w MVP (statyczny panel).
- **Obsługiwana walidacja**:
  - Jeśli `cardId` jest nieustawiony, komponent może w ogóle nie wysyłać requestu i pokazywać „Brak danych”.
  - `limit=1` w zapytaniu, aby nie pobierać niepotrzebnych rekordów.
- **Typy**:
  - DTO: `ReviewStatsDTO`, `ReviewStatsListResponse`, `ApiErrorResponse`.
- **Propsy**:
  - `cardId?: string`

## 5. Typy

### 5.1 Reużywane typy DTO z `src/types.ts`

- **`FlashcardDTO`** – pełna definicja karty (id, front, back, metadane, `review_stats?`).
- **`ReviewStatsDTO`** i **`ReviewStatsListResponse`** – snapshot statystyk dla karty / lista z paginacją.
- **`CreateReviewSessionCommand`**:
  - `session_id: UUID`
  - `started_at: IsoDateString`
  - `completed_at: IsoDateString`
  - `reviews: ReviewSessionEntryCommand[]`
- **`ReviewSessionEntryCommand`**:
  - `card_id: string`
  - `outcome: Enums<"review_outcome">` (np. `"again" | "fail" | "hard" | "good" | "easy"`)
  - `response_time_ms?: number`
  - `prev_interval_days?: number`
  - `next_interval_days?: number`
  - `was_learning_step?: boolean`
  - `payload?: Json`
- **`ApiErrorResponse<TCode>`** – uniwersalny kontener błędu.
- **`FlashcardSelectionState`**:
  - `selectedIds: string[]`
  - `mode: "all-filtered" | "manual"`

### 5.2 Nowe typy ViewModel

Poniżej przykładowe definicje w TypeScript (umieszczone np. w `src/types.ts` lub w dedykowanym pliku `src/components/reviews/reviews.types.ts`).

```ts
// Wynik recenzji w UI – alias do backendowego enum
export type ReviewOutcomeUi = "again" | "fail" | "hard" | "good" | "easy";

export type Grade0to5 = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewCardViewModel {
  card: FlashcardDTO;
  index: number;
}

export interface ReviewSessionEntryViewModel {
  cardId: string;
  outcome: ReviewOutcomeUi;
  grade: Grade0to5;
  responseTimeMs?: number;
  wasLearningStep?: boolean;
  payload?: Json;
}

export interface ReviewSessionState {
  sessionId: string;
  cards: ReviewCardViewModel[];
  currentIndex: number;
  startedAt: IsoDateString;
  completedAt?: IsoDateString;
  entries: ReviewSessionEntryViewModel[];
  status: "idle" | "in-progress" | "submitting" | "completed" | "error";
  error?: ApiErrorResponse;
}

export interface ReviewSessionConfig {
  selection?: FlashcardSelectionState;
  cards: FlashcardDTO[];
}
```

- **Mapowanie ViewModel → DTO do API**:
  - Funkcja util, np. `mapSessionToCommand(state: ReviewSessionState): CreateReviewSessionCommand`, która:
    - Ustawia `session_id`, `started_at`, `completed_at`.
    - Mapuje `entries` na `reviews`:
      - `card_id = entry.cardId`
      - `outcome = entry.outcome`
      - `response_time_ms = entry.responseTimeMs`
      - `was_learning_step = entry.wasLearningStep`
      - `payload = entry.payload`

## 6. Zarządzanie stanem

- **Poziom widoku (`ReviewsPage`)**:
  - Odpowiada za utworzenie `ReviewSessionConfig`:
    - Pozyskanie listy `FlashcardDTO[]` (np. z router state, kontekstu lub dodatkowego API).
    - (Opcjonalnie) weryfikacja `FlashcardSelectionState` (czy tryb `all-filtered` czy `manual`).
  - Wywołanie custom hooka `useReviewSession(config)`, który generuje i zarządza `ReviewSessionState`.

- **Custom hook `useReviewSession`** (np. w `src/hooks/useReviewSession.ts`):
  - Inicjalizacja:
    - Generuje `sessionId` (`crypto.randomUUID()`).
    - Tworzy tablicę `ReviewCardViewModel` z indeksami.
    - Ustawia `currentIndex = 0`, `status = "in-progress"`, `startedAt = new Date().toISOString()`.
  - API hooka:
    - `currentCard: ReviewCardViewModel | null`
    - `isAnswerRevealed: boolean`
    - `progress: { currentIndex: number; total: number }`
    - `recordOutcome(outcome: ReviewOutcomeUi, grade: Grade0to5): void`
      - Dodaje `ReviewSessionEntryViewModel` do `entries`.
      - Aktualizuje `currentIndex` i resetuje `isAnswerRevealed`.
      - Gdy dochodzimy do końca kart, uaktualnia `completedAt` i `status` (np. `"idle"` lub `"in-progress"` w oczekiwaniu na submit).
    - `revealAnswer(): void` – ustawia `isAnswerRevealed = true` i startuje timer dla `responseTimeMs`.
    - `submitSession(): Promise<void>`:
      - Jeśli `entries.length === 0` → nic nie robi (lub wyrzuca ostrzeżenie).
      - Ustawia `status = "submitting"`, ustawia `completedAt` (jeśli brak).
      - Woła `POST /api/review-sessions` z payloadem zmapowanym z `state`.
      - Po sukcesie: `status = "completed"`, `error = undefined`.
      - Po błędzie: `status = "error"`, `error = parsedApiError`.
    - `canSubmit: boolean` – `entries.length > 0 && status !== "submitting"`.
  - Wewnętrzne dane:
    - `answerRevealedAtRef` (`useRef<number | null>`) – do obliczania `responseTimeMs`.

- **Custom hook `useReviewKeyboardShortcuts`**:
  - Przyjmuje:
    - `enabled: boolean`
    - `onRevealAnswer`, `onSelectOutcome`, `onGoNext`.
  - W `useEffect`:
    - Dodaje listener `window.addEventListener("keydown", handler)`.
    - W handlerze:
      - Ignoruje eventy, jeśli `!enabled`.
      - Ignoruje, jeśli `event.target` jest input/textarea/select.
      - Dla `Space` → `onRevealAnswer()`.
      - Dla `Digit1`–`Digit5` → odpowiednie `onSelectOutcome(...)`.
      - Dla `Enter`/`ArrowRight` → `onGoNext()`, jeśli `canGoNext`.
    - Czyści listener przy unmount lub zmianie `enabled`.

- **Obsługa statystyk (`StatsSnippet`)**:
  - Może korzystać z prostego hooka `useReviewStats(cardId)`:
    - Trzyma lokalny stan `stats`, `loading`, `error`.
    - W `useEffect` reaguje na zmiany `cardId` i wykonuje `fetch('/api/review-stats?card_id=...&limit=1')` przy użyciu globalnego utila `useFetch` / `fetchJson`.

## 7. Integracja API

### 7.1 `POST /api/review-sessions`

- **Endpoint**: `/api/review-sessions`, metoda POST.
- **Nagłówki**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt>` (po stronie klienta zwykle zarządzane przez Supabase SDK / cookies).
- **Payload (TypeScript)**:

```ts
const payload: CreateReviewSessionCommand = {
  session_id: state.sessionId,
  started_at: state.startedAt,
  completed_at: state.completedAt ?? new Date().toISOString(),
  reviews: state.entries.map((entry) => ({
    card_id: entry.cardId,
    outcome: entry.outcome,
    response_time_ms: entry.responseTimeMs,
    was_learning_step: entry.wasLearningStep,
    payload: entry.payload,
  })),
};
```

- **Odpowiedź (sukces)**:
  - Status HTTP: `201 Created`.
  - Body (wg `api-plan`): `{ "logged": number }`.
  - Po stronie klienta:
    - Wykorzystujemy tylko `logged` jako informację dla użytkownika (np. w toast: „Zapisano wyniki dla N kart”).

- **Odpowiedzi błędów**:
  - `400 invalid_body` – nieprawidłowe dane (błąd w kliencie).
  - `401 unauthorized` – brak ważnej sesji auth.
  - `404 card_not_found` – jedna lub więcej kart nie istnieje / nie należy do użytkownika.
  - `500 db_error`, `500 unexpected_error` – błędy serwera/DB.
  - Format błędu: `ApiErrorResponse<ReviewErrorCode>`:

```json
{
  "error": {
    "code": "card_not_found",
    "message": "One or more cards not found or not owned by user."
  }
}
```

- **Integracja w hooku**:
  - Używamy wspólnej funkcji, np. `fetchJson<CreateReviewSessionResult>("/api/review-sessions", { method: "POST", body: payload })`.
  - W razie statusu `401` – globalny handler (redirect do `/login`).
  - W innych przypadkach – mapujemy błąd do `ApiErrorResponse` i zapisujemy w `state.error`.

### 7.2 `GET /api/review-stats`

- **Endpoint**: `/api/review-stats`, metoda GET.
- **Zastosowanie**:
  - W `StatsSnippet` dla bieżącej karty.
- **Query params**:
  - `card_id` – UUID bieżącej karty.
  - `limit = 1`.
- **Przykładowe wywołanie**:

```ts
const url = new URL("/api/review-stats", window.location.origin);
url.searchParams.set("card_id", cardId);
url.searchParams.set("limit", "1");

const res = await fetchJson<ReviewStatsListResponse>(url.toString());
const [stats] = res.data;
```

- **Odpowiedź (sukces)**:
  - `ReviewStatsListResponse`:
    - `data: ReviewStatsDTO[]`
    - `page: { next_cursor: string | null; has_more: boolean }`
  - `StatsSnippet` używa tylko pierwszego elementu `data[0]`.

- **Błędy**:
  - `400 invalid_query` – np. zły UUID dla `card_id`.
  - `401 unauthorized` – brak sesji.
  - `500 db_error` – błąd bazy.
  - Obsługa:
    - Komponent pokazuje mały inline komunikat „Statystyki chwilowo niedostępne” + (opcjonalnie) przycisk „Spróbuj ponownie”.
    - Nie przerywa ani nie blokuje sesji powtórek.

## 8. Interakcje użytkownika

- **Start sesji**:
  - Użytkownik przechodzi na `/reviews` z listy fiszek (`/flashcards`) po wybraniu zakresu kart.
  - `ReviewsPage` inicjalizuje sesję i od razu pokazuje pierwszą kartę.

- **Oglądanie pytania**:
  - Po załadowaniu widoku użytkownik widzi treść pytania (front).
  - `ProgressBar` wskazuje, że to `1 / N`.

- **Odsłonięcie odpowiedzi**:
  - Użytkownik klika „Pokaż odpowiedź” lub naciska `Space`.
  - `ReviewCard` pokazuje back; `useReviewSession` ustawia `isAnswerRevealed = true` i startuje timer (dla `response_time_ms`).

- **Ocena odpowiedzi**:
  - Po zapoznaniu się z odpowiedzią użytkownik:
    - klika odpowiedni przycisk w `OutcomeButtons`, lub
    - naciska odpowiedni skrót (`1–5`).
  - `useReviewSession.recordOutcome`:
    - zapisuje `ReviewSessionEntryViewModel` (z `outcome`, `grade`, `responseTimeMs`),
    - przechodzi do następnej karty (inkrementuje `currentIndex`),
    - resetuje stan `isAnswerRevealed`.

- **Nawigacja między kartami**:
  - Po ocenie karta przełącza się automatycznie na następną.
  - Ewentualnie przycisk „Następna karta” / skrót `Enter`/`→` działają jako alias do przejścia, jeśli to potrzebne (w MVP można uprościć do auto-przejścia).

- **Zakończenie sesji**:
  - Po ocenie ostatniej karty:
    - `ReviewPlayer` pokazuje komunikat „Sesja zakończona”.
    - Przyciski wyników stają się nieaktywne.
    - Dostępny jest przycisk „Zapisz sesję” (o ile nie zapisujemy automatycznie po każdej karcie).

- **Zapis sesji**:
  - Kliknięcie „Zapisz sesję”:
    - Wywołuje `submitSession` → `POST /api/review-sessions`.
    - Pokazuje loader; przycisk disabled.
  - Po sukcesie:
    - Toast „Sesja powtórek zapisana (N kart)”.
    - Oferuje przyciski „Wróć do listy fiszek” / „Zacznij nową sesję” (opcjonalnie).
  - Po błędzie:
    - Toast/baner z kodem błędu (przetłumaczonym na zrozumiały komunikat).
    - Możliwość ponownego wysłania sesji.

- **Przegląd statystyk**:
  - Dla każdej karty (przy jej wyświetleniu) `StatsSnippet` ładuje i pokazuje:
    - liczbę dotychczasowych powtórek,
    - success rate,
    - aktualną passę,
    - datę następnej recenzji.

## 9. Warunki i walidacja

- **Walidacja konfiguracji sesji (na poziomie `ReviewsPage`)**:
  - Jeśli `ReviewSessionConfig` nie istnieje lub `cards.length === 0`:
    - Pokazanie `EmptyState` z komunikatem:
      - „Brak wybranych kart do powtórki. Wróć do listy fiszek, aby rozpocząć sesję.”
  - Jeśli `cards.length > 100`:
    - Ograniczenie do pierwszych 100 kart (lub jasny komunikat, że w jednej sesji obsługujemy maksymalnie 100 kart).

- **Walidacja akcji użytkownika (na poziomie `ReviewPlayer`/`useReviewSession`)**:
  - `recordOutcome`:
    - Ignoruje wywołanie, jeśli `currentCard === null`.
    - Może blokować wielokrotne ocenianie tej samej karty w sesji (np. przez sprawdzanie, czy dla `card.id` istnieje już wpis w `entries`).
  - `revealAnswer`:
    - Update tylko, gdy `currentCard` istnieje i `isAnswerRevealed === false`.
  - `submitSession`:
    - Sprawdza `entries.length > 0`.
    - Jeśli nie, zwraca z niczym (lub pokazuje informacyjny toast „Brak zapisanych odpowiedzi do wysłania.”).

- **Walidacja parametrów API**:
  - `session_id`, `started_at`, `completed_at`:
    - generowane po stronie klienta w kontrolowany sposób (`crypto.randomUUID()`, `new Date().toISOString()`), więc domyślnie poprawne.
  - `card_id` w `StatsSnippet`:
    - request tylko, jeśli `cardId` jest niepustym stringiem (opcjonalnie prosty regex UUID).
  - `limit`:
    - zawsze ustawione na `"1"` dla `StatsSnippet`.

## 10. Obsługa błędów

- **Brak kart / błędna konfiguracja**:
  - `ReviewsPage`:
    - `EmptyState` z CTA do `/flashcards`.
  - Nie są wykonywane żadne wywołania `POST /api/review-sessions`.

- **Błędy `POST /api/review-sessions`**:
  - `401 unauthorized`:
    - globalny handler → redirect do `/login?returnTo=/reviews`.
  - `404 card_not_found`:
    - toast: „Niektóre karty nie zostały znalezione lub nie należą do Ciebie. Wybierz zakres kart ponownie z listy fiszek.”
    - przejście w stan `status = "error"`.
  - `400 invalid_body`:
    - interpretowane jako błąd klienta; toast „Wystąpił problem z danymi sesji. Odśwież stronę i spróbuj ponownie.”
    - log w konsoli (dev).
  - `500 db_error`/`unexpected_error`:
    - toast: „Błąd po stronie serwera podczas zapisywania sesji. Spróbuj ponownie za chwilę.”
    - możliwość ponownego kliknięcia „Zapisz sesję”.

- **Błędy `GET /api/review-stats`**:
  - `400 invalid_query`:
    - najczęściej błąd w `cardId`; `StatsSnippet` pokazuje „Statystyki chwilowo niedostępne”.
  - `401 unauthorized`:
    - globalny redirect do `/login`, jak wyżej.
  - `500 db_error`:
    - nie blokuje sesji; tylko mały komunikat w panelu statystyk.

- **Błędy sieciowe**:
  - Przy `POST`: toast „Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.”
  - Przy `GET` statystyk: panel pokazuje „Brak połączenia” i (opcjonalnie) przycisk „Spróbuj ponownie”.

- **A11y / focus**:
  - Po błędzie `submitSession` focus powinien przenieść się na baner błędu / toast mieć odpowiedni `aria-live`, aby użytkownicy czytników ekranu otrzymali informację.

## 11. Kroki implementacji

1. **Przygotowanie struktur i typów**:
   - Dodać nowe typy viewmodeli (`ReviewOutcomeUi`, `Grade0to5`, `ReviewCardViewModel`, `ReviewSessionEntryViewModel`, `ReviewSessionState`, `ReviewSessionConfig`) w dedykowanym pliku (np. `src/components/reviews/reviews.types.ts`) lub w `src/types.ts` (jeśli preferujemy wspólne typy).
   - Upewnić się, że alias typu outcome jest zgodny z backendowym enumem (użycie `ReviewEventDTO["outcome"]` jako źródła).

2. **Routing i szkielet widoku**:
   - Utworzyć plik `src/pages/reviews.astro`:
     - Zaimportować `Layout.astro`.
     - Osadzić komponent React `ReviewsPage` z odpowiednią dyrektywą hydratacji (`client:load`).
   - Dodać link do `/reviews` w topbarze, jeśli nie istnieje (zgodnie z UI-plan).

3. **Implementacja `ReviewsPage`**:
   - Utworzyć katalog `src/components/reviews` i plik `ReviewsPage.tsx`.
   - W `ReviewsPage`:
     - Podłączyć konteksty (`AuthContext`, `ToastsContext`), jeśli potrzebne.
     - W MVP:
       - przyjąć prosty scenariusz: lista kart może być wstrzyknięta jako props (lub pobrana w osobnym kroku, jeśli istnieje dedykowane API).
     - Zainicjalizować `useReviewSession(config)` i na podstawie stanu:
       - wyświetlić `EmptyState`, jeśli brak kart,
       - wyświetlić `ReviewPlayer` w normalnym przypadku.

4. **Implementacja hooka `useReviewSession`**:
   - Utworzyć plik `src/hooks/useReviewSession.ts`.
   - Zaimplementować logikę:
     - inicjalizację `ReviewSessionState`,
     - zarządzanie `currentCard`, `isAnswerRevealed`, `entries`, `status`, `error`,
     - obsługę `revealAnswer`, `recordOutcome`, `submitSession`.
   - W `submitSession` użyć wspólnego utila HTTP (`useFetch`/`fetchJson`), implementując mapowanie `ReviewSessionState` → `CreateReviewSessionCommand`.

5. **Implementacja komponentów UI dla playera**:
   - Utworzyć `ReviewPlayer.tsx` w `src/components/reviews`:
     - Rysować layout: `ProgressBar`, `StatsSnippet`, `ReviewCard`, `OutcomeButtons`, `KeyboardShortcuts`, oraz przycisk „Zapisz sesję”.
     - Przekazywać do komponentów odpowiednie propsy z `useReviewSession`.
   - Utworzyć `ReviewCard.tsx`, `OutcomeButtons.tsx`, `KeyboardShortcuts.tsx`, `ProgressBar.tsx`, `StatsSnippet.tsx` w tym samym katalogu.
   - Zastosować Tailwind + shadcn/ui (`Card`, `Button`, `Progress`).

6. **Hook `useReviewKeyboardShortcuts`**:
   - Utworzyć plik `src/hooks/useReviewKeyboardShortcuts.ts`.
   - Zaimplementować rejestrację skrótów i ich powiązanie z handlerami z `useReviewSession`.
   - Używać go w `KeyboardShortcuts` lub bezpośrednio w `ReviewPlayer`.

7. **Integracja `StatsSnippet` z `GET /api/review-stats`**:
   - W `StatsSnippet.tsx`:
     - Przyjmować `cardId`.
     - Używać `useEffect`/`useFetch`, aby wykonać `GET /api/review-stats?card_id=...&limit=1` przy zmianie `cardId`.
     - Obsługiwać stany: loading, brak danych, błąd.

8. **Obsługa błędów i integracja z globalnym systemem**:
   - Upewnić się, że `fetchJson`/`useFetch` używane w hookach poprawnie mapują kody `401`, `403`, `409`, `5xx` na zachowanie globalne (redirect, toast).
   - W `useReviewSession` odpowiednio ustawiać `error` i stan `status` w oparciu o zwracane `ApiErrorResponse`.

9. **Refaktoryzacja i integracja z `/flashcards`**:

- Po potwierdzeniu działania playera w izolacji:
  - Zaimplementować przepływ „Start sesji powtórek” w widoku `/flashcards` (wybór kart → nawigacja do `/reviews` z konfiguracją).
  - Zapewnić trwałość konfiguracji przy odświeżeniu (np. zapisywanie `ReviewSessionConfig` w `sessionStorage` lub w query params).
