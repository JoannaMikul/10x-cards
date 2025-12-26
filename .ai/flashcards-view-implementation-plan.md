## Plan implementacji widoku Fiszki (lista i zarządzanie)

### 1. Przegląd

- **Cel widoku**: Zapewnić zalogowanemu użytkownikowi wygodny widok listy własnych fiszek z możliwością filtrowania, wyszukiwania, sortowania oraz pełnym CRUD (z soft delete), zgodnie z US‑005–US‑008 oraz częściowo US‑009.
- **Zakres funkcjonalny**:
  - **Lista fiszek** z podstawowymi danymi: skrócone `front`/`back`, tagi, kategoria, źródło, `origin`, daty (`created_at`, `-created_at`, `updated_at`, `deleted_at`), kluczowe pola z `review_stats` (np. `next_review_at`).
  - **Filtrowanie i wyszukiwanie** po kategoriach, tagach, źródle, pochodzeniu (`origin`), tekście (trigram search) oraz sortowaniu (`created_at`, `updated_at`, `next_review_at`).
  - **Tworzenie ręczne fiszek** (US‑005) z walidacją długości (`front` ≤ 200, `back` ≤ 500 znaków) i metadanymi (kategoria, źródło, tagi, opcjonalne metadata JSON).
  - **Edycja istniejących fiszek** (US‑006) z ponowną walidacją i ochroną przed duplikatami (`front_back_fingerprint`).
  - **Soft delete i przywracanie** (US‑007) z potwierdzeniem akcji oraz ukrywaniem usuniętych fiszek z listy (chyba że admin włączy widok usuniętych).
  - **Start powtórek** (US‑009, częściowo): przycisk startu sesji powtórek z aktualnie przefiltrowanego zestawu (nawigacja do `/reviews` z odpowiednimi parametrami).

### 2. Routing widoku

- **Ścieżka**: `/flashcards`.
- **Plik strony Astro**: `src/pages/flashcards.astro` (analogicznie do `candidates.astro`):
  - Importuje `Layout.astro` oraz `FlashcardsPage.tsx`.
  - Struktura:
    - `Layout` z tytułem np. `"Flashcards - 10x-cards"`.
    - `<main>` z klasami Tailwind (min. wysokość, tło, padding).
    - Kontener szerokości (`max-w-6xl`/`max-w-7xl`) i `<FlashcardsPage client:load />`.
- **Autoryzacja i dostęp**:
  - Ochrona przed niezalogowanymi użytkownikami realizowana przez istniejące middleware (US‑000/001); przy 401 backend zwraca błąd, globalna logika powinna przekierować do `/login?returnTo=/flashcards`.
  - Widok `/flashcards` nie jest dostępny dla niezalogowanych (wymóg PRD).
- **Parametry URL widoku** (dla UX i share’owalności):
  - **UI/URL (warstwa prezentacji)**:
    - `q` – tekst wyszukiwania po `front`/`back`.
    - `categoryId` – ID kategorii.
    - `tagIds` – lista ID tagów zakodowana np. jako CSV (`1,2,3`).
    - `sourceId` – ID źródła.
    - `origin` – `ai-full | ai-edited | manual`.
    - `sort` – `created_at | -created_at | updated_at | next_review_at`.
    - `cursor` – kursor paginacji (nieedytowalny przez użytkownika).
    - `showDeleted` – `true`/brak (dla admina).
  - **Parametry żądania do API** (mapowane z powyższych przez hook, zgodne z `GET /api/flashcards`):
    - `search` (z `q`), `category_id`, `content_source_id`, `origin`, `sort`, `cursor`, `limit`.
    - `tag_ids[]` – jeden parametr na ID taga.
    - `include_deleted` (tylko jeśli `isAdmin === true` i `showDeleted === "true"`).

### 3. Struktura komponentów

- **FlashcardsPage** (React, komponent główny widoku)
  - Odpowiada za spięcie hooków, stanów, filtrów i modali.
  - Renderuje layout 2‑kolumnowy na `md+` (sidebar filtrów + główna treść) i jednokolumnowy z drawerem filtrów na `sm`.
- **FiltersSidebar** (desktop, `md+`)
  - Panel po lewej z filtrami: kategoria, tagi, źródło, origin, "Show deleted" (admin), sortowanie.
- **FiltersDrawer** (mobile, `sm`)
  - Off‑canvas/drawer z tym samym zestawem filtrów co sidebar; otwierany przyciskiem "Filters".
- **SearchInput**
  - Pasek wyszukiwania z debounce, nad listą fiszek lub w toolbarze.
- **SortDropdown**
  - Dropdown zmieniający zamówienie wyników (`created_at`, `-created_at`, `updated_at`, `next_review_at`).
- **FlashcardList**
  - Kontener listy fiszek, odpowiada za renderowanie `FlashcardItem`, stan pustej listy, skeletony i przycisk „Load more”.
- **FlashcardItem**
  - Pojedynczy wiersz/kafelek fiszki z kluczowymi informacjami i akcjami (Edytuj, Usuń/Odźwież, Start powtórek, wybór do sesji).
- **LoadMoreButton**
  - Przyciski „Load more” obsługujące kursorową paginację.
- **FlashcardFormModal**
  - Modal (create/edit) do ręcznego tworzenia i edycji fiszek z pełną walidacją. Formularz z użyciem React Hook Form.
- **ConfirmDialog**
  - Potwierdzenie usunięcia (soft delete) oraz przywrócenia fiszki.
- **Toasts / FormError**
  - Komponenty informujące o błędach i sukcesach operacji (globalne toasty + inline `FormError`).

### 4. Szczegóły komponentów

#### FlashcardsPage

- **Opis**: Główny komponent React zarządzający stanem widoku, komunikacją z API (`useFlashcards`), filtrami (URL + context), otwieraniem/zamykaniem modali i dialogów potwierdzenia.
- **Główne elementy**:
  - Kontener (`div`) z klasami Tailwind (`space-y-6`, `max-w-7xl`, `mx-auto`).
  - Nagłówek (`h1`, krótki opis).
  - Toolbar nad listą:
    - `SearchInput`.
    - `SortDropdown`.
    - Przycisk **„Add flashcard”** (otwiera `FlashcardFormModal` w trybie create).
    - Przycisk **„Review Flashcards”** (nawigacja do `/reviews` z aktualnymi filtrami/wyborem).
  - Layout z **FiltersSidebar** (na `md+`) lub **FiltersDrawer** (na `sm`) połączony z sekcją listy.
  - `FlashcardList` z danymi z hooka.
  - `FlashcardFormModal` i `ConfirmDialog` montowane na końcu drzewa DOM.
  - Lokalny lub globalny `<Toaster />`.
- **Obsługiwane interakcje**:
  - Zmiana filtrów / sortowania / wyszukiwania → aktualizacja `FlashcardsFilters`, reset kursora i ponowne pobranie listy.
  - Kliknięcie „Add flashcard” → otwarcie modala create.
  - Kliknięcie „Edit” w `FlashcardItem` → otwarcie modala edit z wypełnionymi danymi.
  - Kliknięcie „Delete” → otwarcie `ConfirmDialog` (soft delete).
  - Kliknięcie „Restor” → `ConfirmDialog` dla przywrócenia.
  - Kliknięcie „Load more” → doczytanie kolejnej strony przez kursor.
  - Kliknięcie „Review Flashcards” → przejście do `/reviews` z parametrami odzwierciedlającymi aktualne filtry/wybór.
- **Obsługiwana walidacja**:
  - Na poziomie widoku: brak (delegacja do komponentów formularzy i hooka).
  - Pilnowanie, aby zmiana filtrów zawsze resetowała `cursor` i listę (happy path).
- **Typy**:
  - **Wejściowe**: `FlashcardsViewState`, `FlashcardsFilters`, `FlashcardDTO`, `FlashcardAggregatesDTO`, `ApiErrorResponse`.
  - **Pomocnicze**: `FlashcardFormState`, `FlashcardSelectionState`.
- **Propsy**: brak (komponent root dla widoku).

#### FiltersSidebar

- **Opis**: Panel filtrów wyświetlany po lewej stronie na `md+`, zarządza zmianą filtrów listy fiszek.
- **Główne elementy**:
  - Semantyczny `aside` z `aria-label="Flashcard Filters"`.
  - Sekcje:
    - `CategorySelect` (lista z `CategoryDTO`).
    - `TagMultiSelect` (wielokrotny wybór `TagDTO`).
    - `SourceSelect` (lista źródeł `SourceDTO`).
    - `OriginSelect` (enum `ai-full | ai-edited | manual`).
    - Przełącznik **„Show deleted”** (tylko dla admina).
    - `SortDropdown`.
    - Przycisk **„Reset filters”**.
- **Obsługiwane interakcje**:
  - Zmiana dowolnego filtra → wywołanie `onFiltersChange(partial)` w górę (FlashcardsPage → hook).
  - Kliknięcie „Resetuj” → przywrócenie wartości domyślnych filtrów.
- **Obsługiwana walidacja**:
  - Maksymalnie 50 wybranych tagów (`tagIds.length <= 50`); przy przekroczeniu blokada wyboru + komunikat.
  - Tylko dodatnie ID (`categoryId`, `contentSourceId`, `tagIds` > 0).
  - Pole `origin` ograniczone do zdefiniowanych wartości enum.
- **Typy**:
  - `FlashcardsFilters`, `CategoryDTO`, `TagDTO`, `SourceDTO`.
- **Propsy**:
  - `filters: FlashcardsFilters`.
  - `aggregates?: FlashcardAggregatesDTO` (np. liczba kart ogółem / per origin w nagłówkach sekcji).
  - `onChange: (next: FlashcardsFilters) => void`.

#### FiltersDrawer

- **Opis**: Mobilny odpowiednik panelu filtrów, renderowany jako off‑canvas/drawer (komponent `Sheet`/`Dialog` z shadcn/ui).
- **Główne elementy**:
  - Przycisk w toolbarze (`Filters` / ikona) z `aria-label="Open filters"`.
  - `Sheet`/`Dialog` zawierający te same pola co `FiltersSidebar`.
- **Obsługiwane interakcje**:
  - Otwieranie/zamykanie drawer’a (`onOpenChange`).
  - Zmiana filtrów → identycznie jak w `FiltersSidebar`.
- **Obsługiwana walidacja**:
  - Taka sama jak w `FiltersSidebar`.
- **Typy**:
  - `FlashcardsFilters`.
- **Propsy**:
  - `open: boolean`.
  - `filters: FlashcardsFilters`.
  - `onOpenChange: (open: boolean) => void`.
  - `onChange: (next: FlashcardsFilters) => void`.

#### SearchInput

- **Opis**: Pole wyszukiwania tekstowego po `front`/`back` (z debounce), wpływa na parametr `search` w `GET /api/flashcards`.
- **Główne elementy**:
  - `input type="search"` z ikoną lupy, etykietą widoczną lub `aria-label`.
  - Przycisk „Clear” (ikona X).
- **Obsługiwane interakcje**:
  - Wpisywanie tekstu → aktualizacja lokalnego stanu `searchTerm`.
  - Po debounce (np. 300 ms) wywołanie `onDebouncedChange(term)` do `FlashcardsPage` (co resetuje kursor i przeładowuje listę).
  - Kliknięcie „Clear” → pusty string, reset filtra tekstowego.
- **Obsługiwana walidacja**:
  - Długość tekstu 0..200 znaków (zgodnie z limitami podobnych endpointów).
  - Trimming białych znaków; pusty string traktowany jako brak filtra (nie wysyłać `search=""`).
- **Typy**:
  - Prostego stringa; brak specjalnego DTO.
- **Propsy**:
  - `value: string`.
  - `onChange: (value: string) => void`.
  - `onDebouncedChange: (value: string) => void`.

#### SortDropdown

- **Opis**: Dropdown zmieniający sortowanie listy fiszek.
- **Główne elementy**:
  - Komponent `Select` z shadcn/ui.
  - Opcje: `Newest`, `Oldest`, `Recently updated`, `Next reviews`.
- **Obsługiwane interakcje**:
  - Zmiana wartości → wywołanie `onChange(sort: FlashcardsSort)`.
- **Obsługiwana walidacja**:
  - Wartość zawsze w zbiorze: `"created_at" | "-created_at" | "updated_at" | "next_review_at"`.
- **Typy**:
  - `FlashcardsSort`.
- **Propsy**:
  - `value: FlashcardsSort`.
  - `onChange: (value: FlashcardsSort) => void`.

#### FlashcardList

- **Opis**: Renderuje listę kart, stan pusty, błąd, skeletony, przycisk „Load more”.
- **Główne elementy**:
  - `section` z `aria-label="Flashcard List"` i `aria-live="polite"` dla liczby wyników.
  - Lista (`ul`) lub `div` z `FlashcardItem` jako elementami.
  - `EmptyState` gdy `items.length === 0` i `!loading`.
  - Skeletony gdy `loading && items.length === 0`.
  - `LoadMoreButton` gdy `hasMore === true`.
- **Obsługiwane interakcje**:
  - Deleguje kliknięcia `onEdit`, `onDelete`, `onRestore`, `onSelectForReview`, `onStartReview` do `FlashcardsPage`.
  - `onLoadMore` wywoływane przy kliknięciu „Load more”.
- **Obsługiwana walidacja**:
  - Brak logiki walidacyjnej – opiera się na poprawnych danych z hooka.
- **Typy**:
  - `FlashcardDTO[]`, `FlashcardsViewState` (częściowo).
- **Propsy**:
  - `items: FlashcardDTO[]`.
  - `loading: boolean`.
  - `error: ApiErrorResponse | null`.
  - `hasMore: boolean`.
  - `onLoadMore: () => void`.
  - `onEdit: (card: FlashcardDTO) => void`.
  - `onDelete: (card: FlashcardDTO) => void`.
  - `onRestore: (card: FlashcardDTO) => void`.
  - `onToggleSelectForReview: (cardId: string) => void`.
  - `selectedForReview: string[]`.
  - `onStartReviewFromCard?: (card: FlashcardDTO) => void`.

#### FlashcardItem

- **Opis**: Prezentuje pojedynczą fiszkę w liście.
- **Główne elementy**:
  - Kontener (`article` / `li`) z kartą (np. shadcn `Card`).
  - Skrócony `front` (pytanie) – maks. kilka linii, z tooltipem na pełną wersję.
  - Skrócony `back` (odpowiedź).
  - Sekcja metadanych:
    - Badge kategorii.
    - Lista tagów (chips).
    - Źródło (np. ikona + nazwa).
    - Origin (`ai-full | ai-edited | manual`).
    - Informacja o stanie: **Deleted** (gdy `deleted_at !== null`), `next_review_at` z `review_stats`.
  - Sekcja akcji:
    - Przycisk **"Edit"**.
    - Przycisk **"Delete"** (gdy nieusunięta).
    - Przycisk **"Restore"** (gdy `deleted_at !== null`).
    - Checkbox / toggle wyboru do sesji powtórek.
    - Przycisk **"Review this card"** / **"Start from this card"**.
- **Obsługiwane interakcje**:
  - Kliknięcia przycisków akcji → wywołania callbacków z `FlashcardList`.
  - Zmiana checkboxa wyboru → aktualizacja `FlashcardSelectionState`.
- **Obsługiwana walidacja**:
  - Brak – komponent tylko prezentuje dane; logika biznesowa jest w hookach/rodzicu.
- **Typy**:
  - `FlashcardDTO`.
  - Opcjonalnie `FlashcardListItemViewModel` (z pre‑obciętymi tekstami).
- **Propsy**:
  - `card: FlashcardDTO`.
  - `selected: boolean`.
  - `onEdit: (card: FlashcardDTO) => void`.
  - `onDelete: (card: FlashcardDTO) => void`.
  - `onRestore: (card: FlashcardDTO) => void`.
  - `onToggleSelectForReview: (cardId: string) => void`.
  - `onStartReviewFromCard?: (card: FlashcardDTO) => void`.

#### LoadMoreButton

- **Opis**: Przyciski do ładowania kolejnych stron wyników (paginacja kursorowa).
- **Główne elementy**:
  - `Button` z tekstem „Load more” i spinnerem podczas ładowania.
- **Obsługiwane interakcje**:
  - Kliknięcie → wywołanie `onClick`.
- **Obsługiwana walidacja**:
  - Zablokowanie (`disabled`) gdy `loading === true` lub `!hasMore`.
- **Typy**:
  - Proste, brak specjalnego DTO.
- **Propsy**:
  - `loading: boolean`.
  - `hasMore: boolean`.
  - `onClick: () => void`.

#### FlashcardFormModal

- **Opis**: Modal służący do tworzenia i edycji fiszek, spełniający wymagania US‑005 i US‑006.
- **Główne elementy**:
  - `Dialog`/`Modal` (shadcn/ui) z trapowaniem focusu i przywracaniem go po zamknięciu.
  - Formularz:
    - Pole `front` (Textarea/Input z licznikiem znaków, max 200).
    - Pole `back` (Textarea z licznikiem, max 500).
    - `CategorySelect`, `SourceSelect`, `TagMultiSelect`.
    - Pole `origin` (w create domyślnie `"manual"`, w edit zachowuje istniejące).
    - Opcjonalne pola metadanych (np. język).
    - `FormError` dla błędów globalnych i inline błędów pól.
  - Przycisk **"Save"** (zatwierdza create/edit).
  - Przycisk **"Cancel"**.
- **Obsługiwane interakcje**:
  - Zmiana pól formularza → aktualizacja `FlashcardFormState.values`.
  - Submit:
    - Walidacja lokalna.
    - Jeśli poprawna → wywołanie `onSubmit(values)` (create lub update).
  - Zamknięcie modala → reset stanu formularza.
- **Obsługiwana walidacja**:
  - `front.trim().length` w zakresie 1..200.
  - `back.trim().length` w zakresie 1..500.
  - `tagIds.length <= 50`, wartości dodatnie (`> 0`, `Number.isInteger`).
  - `categoryId`, `contentSourceId` dodatnie, jeśli ustawione.
  - `origin` w zakresie `ai-full | ai-edited | manual`.
  - Mapowanie błędów API:
    - `400 invalid_body` → pokazanie ogólnego błędu + ewentualnych detali walidacji.
    - `404 category_not_found / source_not_found / tag_not_found` → błędy przy odpowiednich polach.
    - `409 duplicate_flashcard` → komunikat przy `front`/`back` („Taka fiszka już istnieje”).
    - `422 unprocessable_entity` → ogólny błąd walidacji backendu.
- **Typy**:
  - `FlashcardFormMode`, `FlashcardFormValues`, `FlashcardFormState`.
  - `CreateFlashcardCommand`, `UpdateFlashcardCommand`.
  - `ApiErrorResponse` (z kodami błędów dla flashcards).
- **Propsy**:
  - `open: boolean`.
  - `mode: FlashcardFormMode`.
  - `initialValues?: FlashcardFormValues`.
  - `onClose: () => void`.
  - `onSubmit: (values: FlashcardFormValues) => Promise<void>`.

#### ConfirmDialog

- **Opis**: Ogólny dialog potwierdzenia dla operacji soft delete i restore fiszek.
- **Główne elementy**:
  - `AlertDialog`/`Dialog` z tytułem, opisem i przyciskami `"Confirm"`/`"Cancel"`.
  - Krótkie podsumowanie karty (np. `front` w jednej linii).
- **Obsługiwane interakcje**:
  - Kliknięcie „Potwierdź” → `onConfirm`.
  - Kliknięcie „Anuluj” / zamknięcie → `onCancel`.
- **Obsługiwana walidacja**:
  - Brak dodatkowej walidacji; dialog tylko potwierdza akcję.
- **Typy**:
  - Prosty enum typu akcji (`"delete" | "restore"`).
- **Propsy**:
  - `open: boolean`.
  - `mode: "delete" | "restore"`.
  - `card?: FlashcardDTO`.
  - `onConfirm: () => void`.
  - `onCancel: () => void`.

### 5. Typy

- **Istniejące DTO (z `src/types.ts`) używane w widoku**:
  - **`FlashcardDTO`**:
    - **id**: `string` (UUID karty).
    - **front/back**: `string` – treść pytania/odpowiedzi.
    - **origin**: enum `card_origin` (`"ai-full" | "ai-edited" | "manual"`).
    - **metadata**: JSON (np. język, dodatkowe informacje).
    - **category_id**, **content_source_id**: `number | null`.
    - **owner_id**: `string` – właściciel karty.
    - **created_at**, **updated_at**: ISO stringi.
    - **deleted_at**: ISO string lub `null` – soft delete.
    - **tags**: `TagDTO[]`.
    - **review_stats?**: `ReviewStatsSnapshotDTO` (zawierający `next_review_at`, itp.).
  - **`FlashcardAggregatesDTO`**:
    - **total**: `number`.
    - **by_origin**: słownik `{ [origin in card_origin]?: number }`.
  - **`FlashcardListResponse`**:
    - `data: FlashcardDTO[]`.
    - `page: { next_cursor: string | null; has_more: boolean; }`.
    - `aggregates?: FlashcardAggregatesDTO`.
  - **`CreateFlashcardCommand`**:
    - `front`, `back`.
    - `category_id?`, `content_source_id?`.
    - `origin`.
    - `metadata?`.
    - `tag_ids?: number[]`.
  - **`UpdateFlashcardCommand`**:
    - Pola opcjonalne: `front`, `back`, `category_id`, `content_source_id`, `origin`, `metadata`, `deleted_at?`, `tag_ids?`.
  - **`CategoryDTO`, `TagDTO`, `SourceDTO`** – używane w filtrach i formularzu.
  - **`ApiErrorResponse<TCode>`** – opakowanie błędów API.

- **Nowe typy ViewModel dla widoku fiszek** (proponowane, najlepiej dodać do `src/types.ts` lub osobnego modułu UI):

```ts
export type FlashcardsSort = "created_at" | "-created_at" | "updated_at" | "next_review_at";

export interface FlashcardsFilters {
  search: string;
  categoryId?: number;
  contentSourceId?: number;
  tagIds: number[];
  origin?: "ai-full" | "ai-edited" | "manual";
  includeDeleted?: boolean;
  sort: FlashcardsSort;
}

export interface FlashcardsViewState {
  items: FlashcardDTO[];
  loading: boolean;
  error: ApiErrorResponse | null;
  nextCursor: string | null;
  hasMore: boolean;
  filters: FlashcardsFilters;
  aggregates?: FlashcardAggregatesDTO;
}

export type FlashcardFormMode = "create" | "edit";

export interface FlashcardFormValues {
  front: string;
  back: string;
  categoryId?: number;
  contentSourceId?: number;
  origin: "ai-full" | "ai-edited" | "manual";
  tagIds: number[];
  metadata?: FlashcardDTO["metadata"];
}

export interface FlashcardFormState {
  mode: FlashcardFormMode;
  cardId?: string;
  values: FlashcardFormValues;
  isOpen: boolean;
  isSubmitting: boolean;
  fieldErrors: string[];
  apiError?: ApiErrorResponse;
}

export interface FlashcardSelectionState {
  selectedIds: string[];
  mode: "all-filtered" | "manual";
}
```

- **Dodatkowe typy pomocnicze**:
  - `UseFlashcardsReturn` – typ zwracany przez hook `useFlashcards` (opis w sekcji zarządzania stanem).

### 6. Zarządzanie stanem

- **Poziom widoku (`FlashcardsPage`)**:
  - `viewState: FlashcardsViewState` – główny stan listy (zarządzany przez hook `useFlashcards`).
  - `filters: FlashcardsFilters` – pobierane ze specjalnego contextu `FlashcardsFiltersContext` lub inicjalizowane z URL (`useUrlQueryState`).
  - `formState: FlashcardFormState` – steruje `FlashcardFormModal`.
  - `confirmState: { open: boolean; mode: "delete" | "restore"; card?: FlashcardDTO }`.
  - `isFiltersDrawerOpen: boolean` (dla mobile).
  - `selectionState: FlashcardSelectionState` (dla integracji z powtórkami).
- **Contexty**:
  - `AuthContext` – dostarcza `user`, `isAdmin`; potrzebne do:
    - pokazywania przełącznika "Show deleted" oraz
    - warunkowego ustawiania `include_deleted` w zapytaniach do API.
  - `DictionariesContext` – dostarcza listy `categories`, `tags`, `sources` wykorzystywane w filtrach i formularzach.
  - `FlashcardsFiltersContext` (proponowany):
    - Przechowuje `FlashcardsFilters` w pamięci + synchronizuje je z URL (w ramach sesji).
    - Udostępnia `setFilters`, `resetFilters`.
- **Custom hook: `useFlashcards` (`src/components/hooks/useFlashcards.ts`)**:
  - **Wejście**: `initialFilters: FlashcardsFilters`.
  - **Stan wewnętrzny**:
    - `items`, `loading`, `error`, `nextCursor`, `hasMore`, `aggregates`.
  - **Zwracane API**:
    - `state: FlashcardsViewState`.
    - `setFilters: (updater: (prev: FlashcardsFilters) => FlashcardsFilters) => void`.
    - `loadMore: () => Promise<void>` – `GET /api/flashcards` z `cursor`.
    - `createFlashcard: (cmd: CreateFlashcardCommand) => Promise<void>`.
    - `updateFlashcard: (id: string, cmd: UpdateFlashcardCommand) => Promise<void>`.
    - `deleteFlashcard: (id: string) => Promise<void>`.
    - `restoreFlashcard: (id: string) => Promise<void>`.
    - `refresh: () => Promise<void>` – ponowne pobranie pierwszej strony z aktualnymi filtrami.
  - **Zachowanie**:
    - Używa `useEffect` do pobrania pierwszej strony przy zmianie filtrów (z resetem `cursor` i `items`).
    - Wykorzystuje `AbortController` do anulowania poprzednich żądań przy szybkich zmianach filtrów.
    - Obsługuje błędy: zapisuje w `error` oraz prezentuje toasty (np. `toast.error`).
    - Po `create`/`update`:
      - Przy sortowaniu `-created_at` (domyślne) – dodaje/aktualizuje kartę w `items` bez pełnego `refresh`.
      - W innych przypadkach może wykonać `refresh` (prostsze i spójne).
- **Inne hooki pomocnicze**:
  - `useDebouncedValue` – dla `SearchInput`.
  - `useUrlQueryState` – synchronizacja filtrów z URL (zgodnie z planem UI).
  - Reużycie istniejących hooków (`useCandidates`) jako wzorca implementacyjnego.

### 7. Integracja API

- **Słowniki** (wykorzystywane w filtrach i formularzach):
  - `GET /api/categories` → `CategoryListResponse` – pobierane na SSR, hydratowane do `DictionariesContext`.
  - `GET /api/tags` → `TagListResponse`.
  - `GET /api/sources` → `SourceListResponse`.
  - Widok `/flashcards` bazuje na tych danych, nie odpytywa bezpośrednio tych endpointów z poziomu komponentu (chyba że TTL się skończy).

- **Lista fiszek – `GET /api/flashcards`**:
  - **Wywołania**:
    - Przy pierwszym renderze widoku.
    - Przy każdej zmianie filtrów / sortowania / wyszukiwania (z resetem `cursor`).
    - Przy kliknięciu „Load more” (z ustawionym `cursor`).
  - **Parametry**:
    - `limit` – domyślnie `20`, max `100`.
    - `cursor` – przekazywany jako `page.next_cursor` z poprzedniej odpowiedzi.
    - `category_id`, `content_source_id`, `origin`, `search`.
    - `tag_ids[]` – wiele parametrów; `tagIds` z UI rozbijane na pojedyncze parametry.
    - `sort` – `created_at | -created_at | updated_at | next_review_at`.
    - `include_deleted` – tylko dla admina i tylko gdy `filters.includeDeleted === true`.
  - **Odpowiedź**: `FlashcardListResponse` (łącznie z opcjonalnymi `aggregates`).
  - **Zachowanie UI**:
    - Pierwsza strona nadpisuje `items`; kolejne strony są doklejane na końcu.
    - `has_more === false` → ukrycie `LoadMoreButton`.

- **Tworzenie fiszki – `POST /api/flashcards`**:
  - **Body**: `CreateFlashcardCommand` wygenerowany z `FlashcardFormValues`:
    - `front`, `back` (po trimie, walidacja 1..200/1..500).
    - `category_id`, `content_source_id` (opcjonalne).
    - `origin` (dla ręcznie tworzonych kart zazwyczaj `"manual"`).
    - `metadata` (np. `{ language: "PL" }`).
    - `tag_ids`.
  - **Odpowiedź sukcesu**: `201 Created` z pełnym `FlashcardDTO`.
  - **Błędy**:
    - `400 invalid_body`, `401 unauthorized`, `404 category_not_found / source_not_found / tag_not_found`, `409 duplicate_flashcard`, `422 unprocessable_entity`, `500 ...`.
  - **Zachowanie UI**:
    - Przy sukcesie:
      - Zamknięcie modala.
      - Dodanie nowej karty do `items` (na początku) lub `refresh`.
      - Toast "Flashcard created".
    - Przy błędach:
      - Mapowanie kodów do komunikatów w `FlashcardFormModal` (patrz sekcja walidacji i błędów).

- **Edycja fiszki – `PATCH /api/flashcards/:id`**:
  - **Body**: `UpdateFlashcardCommand` zawierający tylko zmienione pola (`front`, `back`, metadata, tagi, kategoria/źródło).
  - **Odpowiedź sukcesu**: `200 OK` z zaktualizowanym `FlashcardDTO`.
  - **Błędy**: jak przy `POST`, uzupełnione o `NOT_FOUND`, konflikty FK i ewentualne `duplicate_flashcard`.
  - **Zachowanie UI**:
    - Aktualizacja odpowiedniej karty w lokalnym stanie (`items.map(...)`).
    - Toast "Flashcard updated".
    - Mapowanie błędów jak w create.

- **Soft delete – `DELETE /api/flashcards/:id`**:
  - **Zachowanie backendu**: ustawia `deleted_at = now()` (soft delete).
  - **Odpowiedź**: `204 No Content`.
  - **Zachowanie UI**:
    - Po sukcesie: albo usunięcie karty z `items`, albo oznaczenie jako usunięta (w zależności od wybranej strategii).
    - Przy włączonym `includeDeleted` – lepiej oznaczać jako usunięta (`deleted_at !== null`) niż usuwać z listy.

- **Przywracanie – `POST /api/flashcards/:id/restore`** (zgodnie z planem API):
  - **Body**: puste.
  - **Odpowiedź**: `200 OK` z odświeżonym `FlashcardDTO` (lub `204` – w zależności od implementacji; plan zakłada `200`).
  - **Zachowanie UI**:
    - Aktualizacja `deleted_at` na `null` w lokalnym stanie.

- **Integracja z powtórkami – `/reviews`**:
  - Kliknięcie „Rozpocznij powtórki” z widoku fiszek:
    - Nawigacja do `/reviews` z parametrami opisującymi zakres (np. `?origin=manual&categoryId=1&tagIds=1,2,3` lub lista `selectedIds`).
  - Szczegóły implementacji `/reviews` są poza zakresem tego planu, ale widok `/flashcards` musi poprawnie przekazać kontekst.

### 8. Interakcje użytkownika

- **Otwarcie widoku `/flashcards`**:
  - Widok ładuje aktualne filtry z URL/contextu.
  - Wywołuje `GET /api/flashcards` z odpowiednimi parametrami.
  - Pokazuje skeleton listy do czasu załadowania.

- **Zmiana filtrów (kategoria/tagi/źródło/origin)**:
  - Aktualizuje `FlashcardsFilters` i URL (bez przeładowania strony).
  - Resetuje kursor (`cursor = null`), czyści `items` i ponownie wywołuje `GET /api/flashcards`.

- **Wyszukiwanie tekstowe (`SearchInput`)**:
  - Użytkownik wpisuje tekst; po debounce następuje aktualizacja filtra `search` i re‑fetch.
  - Komunikat `aria-live` informuje o liczbie znalezionych fiszek.

- **Sortowanie (`SortDropdown`)**:
  - Zmiana sortowania → reset kursora i ponowne pobranie listy.

- **Tworzenie nowej fiszki (US‑005)**:
  - Kliknięcie „Dodaj fiszkę” → otwarcie `FlashcardFormModal`.
  - Użytkownik wypełnia pola i zatwierdza.
  - Przy poprawnych danych:
    - `POST /api/flashcards`.
    - Sukces → zamknięcie modala, aktualizacja listy, toast sukcesu.

- **Edycja istniejącej fiszki (US‑006)**:
  - Kliknięcie „Edytuj” w `FlashcardItem`.
  - Modal wypełniony istniejącymi danymi.
  - Po zatwierdzeniu:
    - `PATCH /api/flashcards/:id`.
    - Aktualizacja pozycji na liście.

- **Usunięcie fiszki (US‑007)**:
  - Kliknięcie „Usuń” → `ConfirmDialog`.
  - Po potwierdzeniu:
    - `DELETE /api/flashcards/:id`.
    - Oznaczenie karty jako usuniętej lub usunięcie z listy (w zależności od trybu widoku).

- **Przywrócenie fiszki**:
  - Gdy włączone `includeDeleted`/`showDeleted`, karty z `deleted_at !== null` mają akcję „Przywróć”.
  - `ConfirmDialog` → `POST /api/flashcards/:id/restore`.

- **Wybór kart do powtórek (US‑009)**:
  - Checkbox przy każdej karcie lub globalna opcja „Użyj wszystkich z bieżących filtrów”.
  - Stan przechowywany w `FlashcardSelectionState`.
  - Kliknięcie „Rozpocznij powtórki” → przekierowanie do `/reviews` z zakodowanymi kartami/filtrami.

### 9. Warunki i walidacja

- **Limity treści fiszek (zgodne z PRD i API)**:
  - **Pytanie (`front`)**:
    - `1..200` znaków po `trim()`.
    - Niepuste, brak tylko białych znaków.
  - **Odpowiedź (`back`)**:
    - `1..500` znaków po `trim()`.
    - Niepuste.
- **Metadane**:
  - `categoryId`, `contentSourceId` – dodatnie liczby całkowite (`> 0`).
  - `tagIds`:
    - Tablica dodatnich liczb całkowitych.
    - Maksymalnie 50 elementów.
    - Bez duplikatów.
- **Origin**:
  - Tylko wartości `ai-full | ai-edited | manual`.
  - Dla ręcznych kart domyślnie `manual`.
- **Parametry zapytań**:
  - `limit` – 1..100 (na froncie domyślnie `20`; nie wystawiać UI do wpisywania dowolnego limitu).
  - `cursor` – traktowany jako ciąg znaków przekazywany z odpowiedzi API; UI go nie parsuje, tylko przekazuje dalej.
  - `search` – 0..200 znaków; pusty string nie jest wysyłany.
- **Walidacja przed żądaniami**:
  - Formularz nie wysyła żądania, jeśli lokalna walidacja nie przejdzie.
  - Przy wystąpieniu błędów API (`400/404/409/422`) – mapping na błędy formularza zgodnie z kodem błędu.

### 10. Obsługa błędów

- **Błędy sieci / fetch**:
  - W hooku `useFlashcards` przechwytywane jako `ApiErrorResponse` z kodem np. `network_error`.
  - Wyświetlenie toastu + `Alert` w widoku listy przy poważnych błędach.

- **401 Unauthorized**:
  - Globalny interceptor lub logika w hooku:
    - Przy `401` z dowolnego endpointu fiszek → przekierowanie do `/login?returnTo=/flashcards`.

- **404 (not_found / category_not_found / source_not_found / tag_not_found)**:
  - Dla listy (`GET /api/flashcards`) – praktycznie nie wystąpi (brak kart → `200` z pustą listą).
  - Dla create/edit:
    - Błędy referencyjne (404) mapowane na inline błędy przy odpowiednich polach selectów.

- **409 duplicate_flashcard**:
  - W `FlashcardFormModal` pokazany jako błąd specyficzny dla `front`/`back`:
    - Treść: "A flashcard with the same content already exists in your collection.".

- **422 unprocessable_entity**:
  - Ogólny błąd walidacji backendu; wyświetlany jako komunikat globalny nad formularzem.

- **500 db_error / unexpected_error**:
  - Toast z komunikatem "Something went wrong, please try again.".
  - Formularz pozostaje otwarty, aby użytkownik mógł spróbować ponownie lub skopiować treść.

- **Błędy paginacji (np. nieprawidłowy cursor)**:
  - Jeśli backend zwróci `400 invalid_query` z powodu kursora:
    - Hook może wykonać „twardy reset” – ponowne pobranie pierwszej strony bez kursora.
    - Użytkownik otrzymuje krótki komunikat w toascie.

### 11. Kroki implementacji

1. **Typy i kontrakty**:
   - Dodać nowe typy viewmodeli (`FlashcardsFilters`, `FlashcardsViewState`, `FlashcardFormMode`, `FlashcardFormValues`, `FlashcardFormState`, `FlashcardSelectionState`) do `src/types.ts` lub dedykowanego modułu UI.
   - Upewnić się, że importy `FlashcardDTO`, `FlashcardListResponse`, `CreateFlashcardCommand`, `UpdateFlashcardCommand` są dostępne w komponentach widoku.
2. **Hook `useFlashcards`**:
   - Utworzyć `src/components/hooks/useFlashcards.ts` na wzór `useCandidates.ts`.
   - Zaimplementować logikę pobierania listy (GET), paginacji, create, update, delete, restore, z obsługą błędów i toastów.
   - Zaimplementować reset kursora przy zmianie filtrów.
3. **Context filtrów**:
   - Dodać `FlashcardsFiltersContext` + provider (np. w komponencie layoutu aplikacji lub specyficznie dla `/flashcards`).
   - Hook `useFlashcardsFilters` powinien synchronizować filtry z URL (`useUrlQueryState`).
4. **Komponenty filtrów**:
   - Zaimplementować `FiltersSidebar` i `FiltersDrawer` korzystające z `DictionariesContext`.
   - Zapewnić spójne API (`filters`, `onChange`) i obsługę resetu filtrów.
5. **Komponenty listy**:
   - Zaimplementować `FlashcardItem` (prezentacja pojedynczej fiszki) z akcjami i badge’ami.
   - Zaimplementować `FlashcardList` (obsługa pustej listy, błędów, skeletonów, `LoadMoreButton`).
6. **Formularz create/edit**:
   - Zaimplementować `FlashcardFormModal` z walidacją lokalną (limity długości, wymagane pola).
   - Zaimplementować mapowanie błędów API (kod → wiadomość i pole) i integrację z `FlashcardsPage`/`useFlashcards`.
7. **Dialog potwierdzenia**:
   - Zaimplementować `ConfirmDialog` z trybami `"delete"` i `"restore"`.
8. **Komponent główny `FlashcardsPage`**:
   - Połączyć hook `useFlashcards`, context filtrów, komponenty filtrów, listy, formularza i dialogu.
   - Dodać toolbar (wyszukiwarka, sortowanie, przyciski akcji).
9. **Strona Astro**:
   - Utworzyć `src/pages/flashcards.astro` z `Layout` i `FlashcardsPage client:load`.
   - Upewnić się, że link do `/flashcards` jest dostępny w nawigacji (`Layout.astro` / `Topbar`).
10. **Integracja z powtórkami**:
    - Dodać w `FlashcardsPage` logikę budowania URL dla `/reviews` na podstawie filtrów/wyboru kart.
11. **Testy i QA**:
    - Ręcznie sprawdzić scenariusze z US‑005–US‑008:
      - Tworzenie, edycja, usuwanie, przywracanie, filtrowanie, wyszukiwanie, paginacja.
    - Zweryfikować obsługę błędów (symulacja `409`, `422`, 5xx).
    - Sprawdzić dostępność (focus, `aria-live`, etykiety przycisków, działanie na mobile).
