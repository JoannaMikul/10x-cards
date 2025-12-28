## Plan implementacji widoku Zarządzanie kategoriami (admin)

### 1. Przegląd

Widok **„Zarządzanie kategoriami (admin)”** służy do tworzenia, edycji i usuwania globalnych kategorii, które są wykorzystywane jako metadane przy fiszkach. Jest dostępny wyłącznie dla użytkowników z rolą administratora oraz opiera się na istniejących typach (`CategoryDTO`, `CategoryListResponse`, `CreateCategoryCommand`, `UpdateCategoryCommand`) i endpointach kategorii (`GET/POST /api/categories` oraz planowanych `PATCH/DELETE /api/categories/:id`). Celem widoku jest zapewnienie prostego i bezpiecznego interfejsu do utrzymania spójnej taksonomii (unikalne nazwy i slugi, poprawny kolor hex) oraz ochrony przed usuwaniem kategorii używanych przez fiszki.

### 2. Routing widoku

- **Ścieżka URL**: `/admin/categories`
- **Plik strony**: `src/pages/admin/categories.astro`
- **Integracja z layoutem**:
  - Widok powinien korzystać z istniejącego layoutu aplikacji (np. `AppLayout` / `DashboardLayout`) z bocznym menu (`AppSidebar`), tak aby zachować spójność UI.
  - W `AppSidebar` należy dodać pozycję menu typu `SidebarMenuItemComponent` prowadzącą do `/admin/categories`, widoczną wyłącznie dla administratorów (warunek oparty o aktualną sesję/rolę użytkownika).
- **Ochrona dostępu**:
  - Po stronie backendu: endpointy `POST/PATCH/DELETE` kategorii już/w przyszłości weryfikują rolę admina (RPC `is_admin`, kody błędów `403 forbidden`).
  - Po stronie frontendu: zapytania, które zwracają `401/403`, powinny powodować wyświetlenie komunikatu „Brak uprawnień” oraz ewentualnie przekierowanie do widoku logowania / głównego panelu.

### 3. Struktura komponentów

- **`AdminCategoriesPage` (kontener strony, React)**  
  Główny komponent osadzony w `categories.astro`, odpowiedzialny za zarządzanie stanem, komunikację z API oraz orkiestrację podkomponentów.
- **`CategoryToolbar` (panel akcji)**  
  Pasek nad listą kategorii z przyciskiem „Dodaj kategorię” oraz opcjonalnym polem wyszukiwania.
- **`CategoriesList` (lista / tabela kategorii)**  
  Prezentacyjny komponent renderujący listę kategorii w postaci tabeli lub listy z akcjami „Edytuj” i „Usuń”.
  - Wewnątrz może wykorzystywać pomocniczy komponent `CategoryRow`.
- **`CategoryFormModal` (modal formularza create/edit)**  
  Modal z formularzem do tworzenia i edycji kategorii, wykorzystujący komponenty Shadcn/ui (`Dialog`, `Input`, `Label`, `Button`) i walidację opartą o lokalny stan.
- **`ConfirmDialog` (potwierdzenie usunięcia)**  
  Ogólny dialog potwierdzenia (np. wrapper na Shadcn `AlertDialog`) używany przy próbie usunięcia kategorii.
- **`FormError` (prezentacja błędów formularza)**  
  Komponent wyświetlający błędy walidacji frontowej oraz błędy z API (`ApiErrorResponse`).
- **`Toasts` / system powiadomień**  
  Wykorzystanie globalnego systemu toastów (Shadcn `useToast`) do informowania o powodzeniu/niepowodzeniu operacji (utworzenie, edycja, usunięcie, błędy serwera).
- **Hook stanu widoku**: `useAdminCategories`  
  Custom hook zarządzający stanem danych (lista, paginacja, wyszukiwanie) i operacjami mutującymi (`createCategory`, `updateCategory`, `deleteCategory`).

Hierarchia (drzewo komponentów – uproszczone):

- `categories.astro`
  - `AdminCategoriesPage`
    - `PageHeader` (tytuł, opis)
    - `CategoryToolbar`
    - `CategoriesList`
      - `CategoryRow` (x N)
    - `CategoryFormModal` (warunkowo renderowany)
      - `FormError`
    - `ConfirmDialog` (warunkowo renderowany)
    - `Toasts` (globalnie, poza lub wewnątrz layoutu)

### 4. Szczegóły komponentów

#### 4.1 `AdminCategoriesPage`

- **Opis komponentu**:  
  Główny kontener strony, odpowiedzialny za:
  - Pobranie listy kategorii z backendu (`GET /api/categories`).
  - Zarządzanie stanem listy, filtrów, paginacji, stanem modali i aktualnie edytowanej/usuwanej kategorii.
  - Wywoływanie akcji tworzenia/edycji/usuwania kategorii (hook `useAdminCategories`).
- **Główne elementy**:
  - Wrapper (`<main>`) z layoutem admina.
  - `PageHeader` z tytułem („Zarządzanie kategoriami”) i krótkim opisem.
  - `CategoryToolbar` (przycisk „Dodaj kategorię”, pole wyszukiwania).
  - `CategoriesList` z danymi i stanem ładowania.
  - `CategoryFormModal` sterowany stanem (tryb „create”/„edit”).
  - `ConfirmDialog` dla operacji usunięcia.
- **Obsługiwane interakcje**:
  - Inicjalne załadowanie kategorii przy montowaniu komponentu.
  - Zmiana filtra wyszukiwania → ponowne wywołanie `GET /api/categories?search=...`.
  - Kliknięcie „Dodaj kategorię” → otwarcie modala w trybie „create”.
  - Kliknięcie „Edytuj” przy konkretnej kategorii → otwarcie modala z danymi w trybie „edit”.
  - Kliknięcie „Usuń” → otwarcie `ConfirmDialog` dla wybranej kategorii.
  - Obsługa potwierdzenia/wycofania w dialogach.
- **Obsługiwana walidacja (na poziomie kontenera)**:
  - Walidacja długości wyszukiwanej frazy (np. max 200 znaków, zgodnie z opisem endpointu).
  - Odrzucanie wyszukiwań zawierających wyłącznie białe znaki (trimowanie).
  - Ochrona przed wielokrotnym równoczesnym wywołaniem mutacji (blokada przycisków podczas requestu).
- **Typy**:
  - `CategoryDTO`, `CategoryListResponse`, `ApiErrorResponse` (z `src/types.ts`).
  - Widokowe: `AdminCategoryListItemVM`, `CategoriesAdminViewState`.
- **Propsy**:
  - W praktyce komponent stronowy może nie przyjmować propsów (dane pobierane klientowo).
  - Opcjonalnie: `initialData?: CategoryListResponse` (na wypadek SSR/hydratacji).

#### 4.2 `CategoryToolbar`

- **Opis komponentu**:  
  Pasek akcji nad listą kategorii. Umożliwia dodanie nowej kategorii oraz wyszukiwanie po nazwie/slug.
- **Główne elementy**:
  - Kontener flex z:
    - Przycisk Shadcn `Button` „Dodaj kategorię”.
    - Pole `Input` do tekstu wyszukiwania.
  - Opcjonalnie select do sortowania (`name` / `created_at`).
- **Obsługiwane interakcje**:
  - Kliknięcie „Dodaj kategorię” → callback `onCreateClick`.
  - Zmiana wartości w polu wyszukiwania → callback `onSearchChange` (z debounce po stronie rodzica).
  - Naciśnięcie Enter w polu wyszukiwania → natychmiastowy trigger wyszukiwania.
- **Obsługiwana walidacja**:
  - Ograniczenie długości tekstu (np. `maxLength={200}`).
  - Automatyczne trimowanie przed wysłaniem do API.
- **Typy**:
  - `CategoryToolbarProps` z polami:
    - `search: string`
    - `onSearchChange: (value: string) => void`
    - `onCreateClick: () => void`
    - `isSearching?: boolean`
- **Propsy**:
  - **`search`**: aktualna wartość filtra tekstowego.
  - **`onSearchChange`**: handler aktualizujący stan filtra.
  - **`onCreateClick`**: handler otwierający modal tworzenia.
  - **`isSearching`**: flaga do prezentacji spinnera w polu lub na przycisku.

#### 4.3 `CategoriesList`

- **Opis komponentu**:  
  Prezentacyjna lista/tabela kategorii z akcjami „Edytuj” i „Usuń”. Nie zna szczegółów API – pracuje na view-modelu i callbackach.
- **Główne elementy**:
  - Tabela (`<table>`) lub lista (`<div role="table">`) z kolumnami:
    - Nazwa
    - Slug
    - Opis
    - Kolor (np. kolorowy `Badge` / kółko z kolorem)
    - Akcje (przyciski „Edytuj”, „Usuń”)
  - Widok pustej listy („Brak kategorii”) z zachętą do utworzenia pierwszej.
  - Wskaźnik ładowania (np. spinner, skeletony) gdy `loading === true`.
- **Obsługiwane interakcje**:
  - Kliknięcie „Edytuj” → `onEditClick(categoryId)`.
  - Kliknięcie „Usuń” → `onDeleteClick(categoryId)` (tylko jeśli kategoria jest usuwalna).
  - Paginacja (opcjonalnie): kliknięcia „Załaduj więcej” lub przyciski numerów stron.
- **Obsługiwana walidacja**:
  - Blokada przycisku „Usuń” dla kategorii oznaczonych jako nieusuwalne (`isDeletable === false`).
  - Dbałość o poprawne wyświetlenie koloru (np. fallback, jeśli kolor jest `null` lub niepoprawny).
- **Typy**:
  - `AdminCategoryListItemVM[]` – view-model dla pojedynczej kategorii.
  - `CategoriesListProps`:
    - `items: AdminCategoryListItemVM[]`
    - `loading: boolean`
    - `error?: ApiErrorResponse`
    - `onEditClick: (id: number) => void`
    - `onDeleteClick: (id: number) => void`
    - `onLoadMore?: () => void`
    - `hasMore?: boolean`
- **Propsy**:
  - **`items`**: zmapowane dane kategorii do wyświetlenia.
  - **`loading`**: czy lista jest w trakcie ładowania.
  - **`error`**: ewentualny błąd ładowania do pokazania nad listą.
  - **`onEditClick`**, **`onDeleteClick`**: callbacki do obsługi edycji/usunięcia.
  - **`onLoadMore`**, **`hasMore`**: obsługa paginacji cursorowej.

#### 4.4 `CategoryFormModal`

- **Opis komponentu**:  
  Modal zawierający formularz tworzenia/edycji kategorii. Odpowiada za:
  - Zarządzanie lokalnymi wartościami pól formularza (w trybie kontrolowanym).
  - Walidację pól przed wysłaniem do API.
  - Prezentację błędów (`FormError`) oraz komunikatów helperowych (np. format slug, kolor).
- **Główne elementy**:
  - Shadcn `Dialog` jako wrapper modala.
  - Formularz z polami:
    - `Input` Nazwa (wymagana).
    - `Input` Slug (wymagany, małe litery, cyfry, myślniki).
    - `Textarea` lub `Input` Opis (opcjonalny).
    - `Input` Kolor (opcjonalny, w formacie `#RRGGBB`).
  - Przyciski:
    - „Zapisz” (submit).
    - „Anuluj” (zamyka modal).
  - `FormError` do prezentacji błędów.
- **Obsługiwane interakcje**:
  - Zmiana wartości pól → aktualizacja `CategoryFormValues`.
  - Kliknięcie „Zapisz” → lokalna walidacja → w razie sukcesu callback `onSubmit`.
  - Kliknięcie „Anuluj” / zamknięcie modala → callback `onClose`.
- **Obsługiwana walidacja**:
  - **Nazwa**:
    - Wymagana, min. 2 znaki, np. max. 100 znaków (dopasować do schematu backendu).
  - **Slug**:
    - Wymagany, regex `^[a-z0-9-]+$`, bez spacji i wielkich liter.
    - Długość np. 2–50 znaków.
    - Sprawdzenie unikalności względem już załadowanych kategorii (lokalna walidacja; backend pozostaje źródłem prawdy – 409 `slug_taken`).
  - **Kolor**:
    - Opcjonalny.
    - Jeśli podany: regex `^#(?:[0-9a-fA-F]{6})$` (sześciocyfrowy hex).
  - **Opis**:
    - Opcjonalny, max. długość (np. 255–512 znaków, zgodnie z kolumną bazy).
- **Typy**:
  - `CategoryFormMode = "create" | "edit"`.
  - `CategoryFormValues`:
    - `name: string`
    - `slug: string`
    - `description?: string`
    - `color?: string`
  - `CategoryFormState`:
    - `mode: CategoryFormMode`
    - `values: CategoryFormValues`
    - `isSubmitting: boolean`
    - `fieldErrors: string[]`
    - `apiError?: ApiErrorResponse`
  - `CategoryFormModalProps`:
    - `open: boolean`
    - `mode: CategoryFormMode`
    - `initialValues?: CategoryFormValues`
    - `existingSlugs: string[]`
    - `onSubmit: (values: CategoryFormValues) => void`
    - `onClose: () => void`
    - `submitting: boolean`
- **Propsy**:
  - **`open`**: steruje widocznością modala.
  - **`mode`**: wskazuje, czy formularz jest w trybie tworzenia, czy edycji.
  - **`initialValues`**: dane początkowe przy edycji.
  - **`existingSlugs`**: do sprawdzania lokalnej unikalności slugów.
  - **`onSubmit`**: callback wywoływany po pomyślnej walidacji.
  - **`onClose`**: zamknięcie modala bez zapisu.
  - **`submitting`**: blokuje przyciski i pokazuje spinner podczas requestu.

#### 4.5 `ConfirmDialog`

- **Opis komponentu**:  
  Ogólny dialog potwierdzenia wykorzystywany do usuwania kategorii. Powinien być łatwo reużywalny także w innych częściach panelu admina.
- **Główne elementy**:
  - Wrapper Shadcn `AlertDialog`.
  - Tytuł („Usuń kategorię”), treść z nazwą kategorii i ostrzeżeniem o konsekwencjach.
  - Przycisk potwierdzenia („Usuń”) oraz anulowania („Anuluj”).
- **Obsługiwane interakcje**:
  - Kliknięcie „Usuń” → callback `onConfirm`.
  - Kliknięcie „Anuluj” / zamknięcie → callback `onCancel`.
- **Obsługiwana walidacja**:
  - Brak dodatkowej logiki walidacyjnej – samo potwierdzenie akcji.
- **Typy**:
  - `ConfirmDialogProps`:
    - `open: boolean`
    - `title: string`
    - `description?: string`
    - `confirmLabel?: string`
    - `cancelLabel?: string`
    - `onConfirm: () => void`
    - `onCancel: () => void`
    - `loading?: boolean`
- **Propsy**:
  - Standardowe pola sterujące wyświetleniem i etykietami, plus callbacki powiązane z usuwaniem.

#### 4.6 `FormError`

- **Opis komponentu**:  
  Prezentuje błędy walidacji frontowej oraz błędy zwracane przez API w jednolitym formacie.
- **Główne elementy**:
  - Lista komunikatów błędów (`<ul>` z `<li>`).
  - Stylizacja ostrzegawcza (Shadcn `Alert`).
- **Obsługiwane interakcje**:
  - Brak interakcji – komponent wyłącznie wyświetla przekazane błędy.
- **Obsługiwana walidacja**:
  - Brak – komponent zakłada, że otrzymuje już przygotowaną listę komunikatów.
- **Typy**:
  - `FormErrorProps`:
    - `messages: string[]`
- **Propsy**:
  - **`messages`**: tablica stringów do wyświetlenia.

#### 4.7 System `Toasts`

- **Opis**:  
  Wykorzystanie globalnego hooka Shadcn `useToast` do wyświetlania komunikatów o powodzeniu i błędach.
- **Główne elementy**:
  - Wywołania `toast({ title, description, variant })` w callbackach sukcesu/porażki.
- **Obsługiwane interakcje**:
  - Zamknięcie toastów przez użytkownika (domyślne zachowanie Shadcn).
- **Typy i propsy**:
  - W oparciu o istniejące typy Shadcn; nie wymagają nowych interfejsów po stronie widoku.

### 5. Typy

#### 5.1 Istniejące typy z backendu (reused)

- **`CategoryDTO`** (`src/types.ts`):
  - **`id: number`** – identyfikator kategorii.
  - **`name: string`** – czytelna nazwa kategorii.
  - **`slug: string`** – techniczny identyfikator używany w filtrach.
  - **`description: string | null`** – opis kategorii (opcjonalny).
  - **`color: string | null`** – kolor w formacie hex (opcjonalny).
  - **`created_at: string`**, **`updated_at: string`** – znaczniki czasu ISO.
- **`CategoryListResponse`**:
  - **`data: CategoryDTO[]`** – lista kategorii.
  - **`page: { next_cursor: string | null; has_more: boolean }`** – dane paginacyjne.
- **`CreateCategoryCommand`**:
  - **`name: string`**, **`slug: string`**, **`description?: string`**, **`color?: string`** – payload do `POST /api/categories`.
- **`UpdateCategoryCommand`**:
  - Pola opcjonalne jak w `CreateCategoryCommand`, przekazywane do `PATCH /api/categories/:id`.
- **`ApiErrorResponse<TCode extends string>`**:
  - **`error.code: TCode`**, **`error.message: string`**, **`error.details?: Json`** – struktura błędów API.

#### 5.2 Nowe typy ViewModel i stanów

- **`AdminCategoryListItemVM`** (view-model pojedynczej kategorii na liście):
  - **`id: number`** – z `CategoryDTO.id`.
  - **`name: string`** – z `CategoryDTO.name`.
  - **`slug: string`** – z `CategoryDTO.slug`.
  - **`description?: string`** – z `CategoryDTO.description`.
  - **`color?: string`** – z `CategoryDTO.color`.
  - **`createdAt: string`** – z `CategoryDTO.created_at`.
  - **`updatedAt: string`** – z `CategoryDTO.updated_at`.
  - **`isDeletable: boolean`** – flaga określająca, czy można usunąć kategorię:
    - Domyślnie `true`.
    - Może być ustawiana na `false` po stronie backendu (np. jeśli endpoint admina zwraca dodatkowe pole `usage_count`) lub po otrzymaniu błędu `category_in_use` z API.
- **`CategoriesAdminViewState`** (stan całego widoku):
  - **`items: AdminCategoryListItemVM[]`** – zmapowane kategorie.
  - **`loading: boolean`** – ogólny stan ładowania listy.
  - **`error: ApiErrorResponse | null`** – ostatni błąd pobierania.
  - **`search: string`** – aktualny filtr wyszukiwania.
  - **`sort: "name" | "created_at"`** – kryterium sortowania.
  - **`nextCursor: string | null`**, **`hasMore: boolean`** – stan paginacji kursorowej.
  - **`formState: CategoryFormState | null`** – stan aktualnie otwartego formularza (lub `null`, gdy modal zamknięty).
  - **`deleteCandidateId?: number`** – ID kategorii wskazanej do usunięcia (dla `ConfirmDialog`).
  - **`deleting: boolean`** – flaga aktywnego requestu usuwania.
  - **`authorizationError?: ApiErrorResponse`** – przechowuje błędy `401/403`, aby móc zareagować globalnie.
- **`CategoryFormValues`, `CategoryFormMode`, `CategoryFormState`** – opisane w sekcji komponentu `CategoryFormModal`.
- **`DeleteCategoryState`** (opcjonalna struktura wydzielona):
  - **`id?: number`**, **`isDeleting: boolean`**, **`error?: ApiErrorResponse`** – ułatwia zarządzanie stanem usuwania.

### 6. Zarządzanie stanem

- **Custom hook `useAdminCategories`**:
  - **Cel**: enkapsulacja logiki pobierania i modyfikowania kategorii, tak aby `AdminCategoriesPage` pozostał możliwie prosty.
  - **API hooka (przykładowo)**:
    - Stan:
      - `state: CategoriesAdminViewState`
    - Akcje:
      - `loadInitial: () => Promise<void>` – wywołanie `GET /api/categories` z domyślnym `sort=name`.
      - `searchCategories: (term: string) => Promise<void>` – z debouncingiem po stronie komponentu.
      - `loadMore: () => Promise<void>` – pobieranie kolejnej strony na podstawie `nextCursor`.
      - `openCreateModal: () => void`
      - `openEditModal: (category: AdminCategoryListItemVM) => void`
      - `closeModal: () => void`
      - `submitForm: (values: CategoryFormValues) => Promise<void>` – rozróżnia `create` vs `edit`.
      - `requestDelete: (id: number) => void` – ustawia `deleteCandidateId`.
      - `confirmDelete: () => Promise<void>` – wywołuje `DELETE /api/categories/:id`.
      - `cancelDelete: () => void`
  - **Implementacja**:
    - Wewnątrz hooka: `useState` / `useReducer` do przechowywania `CategoriesAdminViewState`.
    - Funkcje asynchroniczne korzystające z `fetch` (lub istniejącej warstwy `apiClient`).
    - Obsługa błędów i aktualizacji stanu zgodnie z liniami „handle errors early, używaj guard clauses”.
- **Poziomy stanu**:
  - **Globalny** (poza zakresem tego widoku): sesja użytkownika, rola admina, provider toasts.
  - **Lokalny dla widoku**: lista kategorii, filtry, modale (`useAdminCategories`).
  - **Lokalny dla formularza**: kontrolowane pola w `CategoryFormModal`.

### 7. Integracja API

- **Lista kategorii – `GET /api/categories`**:
  - **Zapytanie**:
    - Parametry:
      - `search?: string` – wyszukiwanie po `name` i `slug` (trimowane, max 200 znaków).
      - `limit?: number` – np. `20` przy inicjalnym ładowaniu (1–100).
      - `cursor?: string` – Base64 zakodowane `id` ostatniego rekordu.
      - `sort?: "name" | "created_at"` – domyślnie `"name"`.
    - Typ odpowiedzi: `Promise<CategoryListResponse>`.
  - **Obsługa po stronie hooka**:
    - Mapowanie `CategoryDTO` → `AdminCategoryListItemVM`.
    - Aktualizacja `state.items`, `state.nextCursor`, `state.hasMore`.
    - Błędy:
      - `400 invalid_query` → wyświetlenie komunikatu i ewentualne zresetowanie filtrów.
      - `500 db_error/unexpected_error` → toast błędu, zapis w `state.error`.
- **Tworzenie kategorii – `POST /api/categories` (admin)**:
  - **Request body**: `CreateCategoryCommand`.
  - **Sukces**:
    - Kod `201 Created`, body: `CategoryDTO`.
    - Dodanie nowej kategorii do `state.items` (na początek listy lub odpowiednio posortowanej).
    - Zamknięcie modala, toast „Kategoria utworzona”.
  - **Błędy**:
    - `400 invalid_body` – szczegóły w `error.details.issues` → mapowanie na `FormError`.
    - `403 forbidden` / `401 unauthorized` – zapis w `authorizationError` i komunikat „Brak uprawnień”.
    - `409 slug_taken` (wg planu API) – specyficzny komunikat przypisany do pola `slug`.
    - `500` – ogólny błąd serwera z komunikatem dla użytkownika.
- **Edycja kategorii – `PATCH /api/categories/:id` (admin, planowany)**:
  - **Request body**: `UpdateCategoryCommand`.
  - **Sukces**:
    - Kod `200 OK`, body: `CategoryDTO`.
    - Aktualizacja odpowiedniego elementu w `state.items`.
    - Toast „Kategoria zaktualizowana”.
  - **Błędy**:
    - Analogiczne do `POST`, plus:
      - `404 not_found` – kategoria usunięta równolegle → komunikat i odświeżenie listy.
      - `409 constraint_violation` – np. kolizja slug/nazwy.
- **Usuwanie kategorii – `DELETE /api/categories/:id` (admin, planowany)**:
  - **Sukces**:
    - Kod `204 No Content` lub `200 OK`.
    - Usunięcie elementu z `state.items`.
    - Toast „Kategoria usunięta”.
  - **Błędy**:
    - `409 category_in_use` – kategoria powiązana z istniejącymi fiszkami:
      - Komunikat w dialogu/torście („Nie można usunąć kategorii, która jest używana przez fiszki”).
      - Aktualizacja `isDeletable` na `false` w odpowiednim `AdminCategoryListItemVM`.
    - `403/401` – brak uprawnień.
    - `404` – kategoria nie istnieje → odświeżenie listy.

### 8. Interakcje użytkownika

- **Wejście na stronę `/admin/categories`**:
  - Wywołanie `loadInitial()` → loader, potem lista kategorii lub komunikat błędu.
- **Wyszukiwanie kategorii**:
  - Użytkownik wpisuje tekst w pole wyszukiwania.
  - Po krótkim opóźnieniu (debounce) lub wciśnięciu Enter wywołanie `searchCategories(term)`.
  - UI pokazuje wynik filtrowany, ewentualnie resetuje paginację.
- **Tworzenie kategorii**:
  - Kliknięcie „Dodaj kategorię” → otwarcie `CategoryFormModal` w trybie `create`.
  - Użytkownik wypełnia pola; formularz lokalnie waliduje nazwę, slug, kolor.
  - Po kliknięciu „Zapisz”:
    - Jeśli walidacja lokalna przejdzie – wywołanie `createCategory` (hook).
    - W przypadku błędów z API – pokazanie ich w `FormError`.
- **Edycja kategorii**:
  - Kliknięcie „Edytuj” przy wierszu na liście → `CategoryFormModal` w trybie `edit` z prefill.
  - Edycja pól z analogiczną walidacją.
  - Zapis aktualizuje rekord przez `PATCH` i odświeża listę.
- **Usuwanie kategorii**:
  - Kliknięcie „Usuń” → otwarcie `ConfirmDialog`.
  - Potwierdzenie → `confirmDelete()`:
    - W przypadku sukcesu – usunięcie z listy, toast.
    - W przypadku `409 category_in_use` – komunikat o niemożności usunięcia; button „Usuń” może zostać zablokowany przy kolejnych próbach.
- **Obsługa błędów autoryzacji**:
  - Otrzymanie `401/403` z dowolnej mutacji → toast + opcjonalne przekierowanie do widoku logowania lub ogólnego dashboardu.

### 9. Warunki i walidacja

- **Warunki wymagane przez API**:
  - **Filtr `search`**:
    - Długość 0–200 znaków, trimowanie białych znaków.
    - Frontend pilnuje długości pola (`maxLength`) i trimuje przed wysyłką.
  - **Tworzenie/edycja kategorii**:
    - `name` i `slug` – wymagane; walidowane zarówno po stronie frontu, jak i backendu.
    - `slug` – regex `^[a-z0-9-]+$`, unikalny.
    - `color` – hex, jeśli obecny.
  - **Usuwanie kategorii**:
    - Niedozwolone w przypadku powiązań z fiszkami – backend odpowiada `409 category_in_use`.
- **Walidacja na poziomie UI i komponentów**:
  - **`CategoryFormModal`**:
    - Waliduje pola onBlur/onChange; błędy pokazywane inline oraz zebrane w `FormError`.
    - Nie pozwala na wysłanie formularza, jeśli istnieją błędy lokalne.
  - **`CategoriesList`**:
    - Dla `isDeletable === false` wyłącza przycisk „Usuń” i pokazuje tooltip („Kategoria jest używana przez fiszki”).
  - **`AdminCategoriesPage` / hook**:
    - Blokuje ponowne requesty w trakcie trwania poprzedniego (`loading`, `deleting`, `formState.isSubmitting`).

### 10. Obsługa błędów

- **Błędy walidacji (400)**:
  - Mapowane na komunikaty w `FormError`.
  - Jeśli `details.issues` zawierają informacje o polu, przypisywane również do odpowiednich pól formularza.
- **Błędy autoryzacji (401/403)**:
  - Prezentowane w formie toastów/alertów („Brak uprawnień do zarządzania kategoriami”).
  - Możliwa reakcja: automatyczne przekierowanie, jeśli aplikacja posiada centralny guard.
- **Błędy konfliktu (409)**:
  - `slug_taken` – dedykowany komunikat przy polu slug („Slug jest już zajęty”).
  - `category_in_use` – dedykowany komunikat przy próbie usunięcia; aktualizacja `isDeletable`.
- **Błędy serwera (500) i sieci**:
  - Ogólny komunikat „Wystąpił nieoczekiwany błąd. Spróbuj ponownie później”.
  - Logowanie do konsoli (spójne z istniejącym `recordCategoriesEvent`).
- **Błędy paginacji / kursora**:
  - `400 invalid_query` → reset kursora (ustawienie `nextCursor = null`, `hasMore = false`) i komunikat, że dane zostaną ponownie załadowane.

### 11. Kroki implementacji

1. **Przygotowanie struktury plików**
   - Utwórz katalog `src/components/admin/categories/` na komponenty (`AdminCategoriesPage`, `CategoriesList`, `CategoryFormModal`, `CategoryToolbar`, `ConfirmDialog`, `FormError` – jeśli nie istnieją globalne odpowiedniki).
   - Dodaj stronę `src/pages/admin/categories.astro`, która osadzi komponent React `AdminCategoriesPage` w odpowiednim layoutcie.
2. **Definicja typów widoku**
   - Dodaj typy `AdminCategoryListItemVM`, `CategoriesAdminViewState`, `CategoryFormValues`, `CategoryFormState`, `CategoryFormMode` w dedykowanym pliku typów (np. `src/components/admin/categories/types.ts`) lub, jeśli uzasadnione, rozbuduj `src/types.ts` z jasnym komentarzem, że są to typy UI.
3. **Implementacja hooka `useAdminCategories`**
   - Zaimplementuj logikę pobierania kategorii (`GET /api/categories`) wraz z obsługą `search`, `cursor`, `sort`.
   - Dodaj funkcje mutujące: `createCategory` (POST), `updateCategory` (PATCH – gdy backend będzie gotowy), `deleteCategory` (DELETE – gdy backend będzie gotowy).
   - Zaimplementuj obsługę błędów, aktualizację stanu i mapowanie DTO → VM.
4. **Implementacja komponentu `AdminCategoriesPage`**
   - Podłącz hook `useAdminCategories` i przekaż odpowiednie dane oraz callbacki do podkomponentów.
   - Zadbaj o ładowanie początkowe (`useEffect`) oraz zarządzanie modali (create/edit, delete).
5. **Implementacja komponentów prezentacyjnych**
   - Zaimplementuj `CategoryToolbar` z przyciskiem „Dodaj kategorię” i polem wyszukiwania.
   - Zaimplementuj `CategoriesList` i pomocniczy `CategoryRow` z wykorzystaniem Shadcn/ui (tabela, przyciski, badge kolorów).
   - Zaimplementuj `CategoryFormModal` z pełną walidacją pól i integracją z `FormError`.
   - Zaimplementuj generyczny `ConfirmDialog` (lub użyj istniejącego wrappera).
6. **Integracja z systemem nawigacji i autoryzacji**
   - Dodaj element menu w `AppSidebar` prowadzący do `/admin/categories` (widoczny tylko dla adminów).
   - Upewnij się, że middleware / logika sesji przekazuje identyfikator użytkownika i jego rolę do endpointów (już obecne RPC `is_admin`).
7. **Obsługa błędów i UX**
   - Dodaj toasty dla przypadków sukcesu i porażki (tworzenie/edycja/usuwanie).
   - Zapewnij czytelne komunikaty dla błędów typów `400/401/403/409/500` zgodnie z PRD.
8. **Refinement i refaktoryzacja**
   - Po pierwszej implementacji przejdź przez kod z lintem/formatowaniem, uprość warunki z użyciem guard clauses i wczesnych returnów.
   - Wspólną logikę (np. wyświetlanie `ApiErrorResponse`) wydziel do reużywalnych helperów/komponentów, aby ujednolicić zachowanie w całej aplikacji.
