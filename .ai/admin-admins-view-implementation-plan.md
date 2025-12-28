## Plan implementacji widoku Zarządzanie administratorami (admin)

### 1. Przegląd

Widok **„Zarządzanie administratorami (admin)”** służy do przeglądania wszystkich użytkowników systemu oraz zarządzania rolami administratorów. Opiera się na istniejącej infrastrukturze ról w tabeli `user_roles` i endpointach administacyjnych (`GET/POST /api/admin/user-roles` oraz `DELETE /api/admin/user-roles/:user_id/:role`). Celem widoku jest zapewnienie administratorom prostego, bezpiecznego i audytowalnego interfejsu do zarządzania dostępem administracyjnym, zgodnie z wymaganiami PRD (US‑012), z walidacją duplikatów ról oraz ochroną przed usunięciem ostatniego administratora.  
Wszystkie teksty w interfejsie (etykiety, przyciski, komunikaty, placeholdery) powinny być wyłącznie w **języku angielskim**, a kod nie powinien zawierać zbędnych komentarzy (tylko konieczne, wysokopoziomowe wyjaśnienia tam, gdzie logika nie jest oczywista).

### 2. Routing widoku

- **Ścieżka URL**: `/admin/admins`
- **Plik strony**: `src/pages/admin/admins.astro`
- **Integracja z layoutem**:
  - Strona powinna korzystać z istniejącego layoutu aplikacji (np. główny layout z `AppSidebar`), analogicznie do `/admin/categories` oraz `/admin/kpi`, aby zachować spójność UI.
  - W komponencie sidebaru (np. `AppSidebar`) należy dodać pozycję menu prowadzącą do `/admin/admins`, widoczną wyłącznie dla użytkowników z rolą administratora (warunek oparty na aktualnej sesji/rolach użytkownika).
- **Ochrona dostępu**:
  - **Backend**: endpointy `GET/POST/DELETE /api/admin/user-roles` weryfikują, czy użytkownik jest zalogowany i posiada uprawnienia administratora (`is_admin()` RPC, RLS na tabeli `user_roles`). W przeciwnym razie zwracają `401 unauthorized` lub `403 insufficient_permissions`.
  - **Frontend**: odpowiedzi `401/403` z tych endpointów powinny skutkować:
    - zapisem błędu autoryzacji w stanie widoku,
    - prezentacją komunikatu o braku uprawnień / wygaśnięciu sesji,
    - przekierowaniem do `/auth/login` (zgodnie ze wzorcem z `useAdminCategories`).

### 3. Struktura komponentów

- **`AdminAdminsPage` (kontener strony, React)**  
  Główny komponent widoku osadzony w `admins.astro`. Odpowiada za integrację z hookiem stanu (`useAdminUserRoles`), renderowanie nagłówka, paska narzędzi, listy administratorów, dialogów oraz komunikatów o błędach/stanie ładowania.

- **`AdminsToolbar` (panel akcji / wyszukiwarka)**  
  Pasek nad listą użytkowników, zawierający pole wyszukiwania użytkowników (po `userId` lub email).

- **`AdminsList` (lista / tabela użytkowników)**  
  Prezentacyjny komponent renderujący listę wszystkich użytkowników systemu na podstawie view-modelu `AdminUserListItemVM`. Dla każdego użytkownika wyświetla jego rolę (admin/user) oraz udostępnia akcje:
  - „Auto Grant” (przycisk zielony) dla użytkowników bez roli admin - automatycznie przyznaje rolę administratora
  - „Revoke” (przycisk czerwony) dla administratorów - otwiera dialog potwierdzenia odebrania roli, z uwzględnieniem lokalnej logiki (np. blokada przycisku dla ostatniego admina).

- **`RevokeAdminConfirmDialog` (modal potwierdzenia odebrania roli)**  
  Dialog potwierdzający operację odebrania roli administratora od wybranego użytkownika, oparty o Shadcn `AlertDialog`. Wyświetla ostrzeżenia i po potwierdzeniu wywołuje akcję DELETE `/api/admin/user-roles/:user_id/admin`.

- **`FormError` (prezentacja błędów)**  
  Reużywalny komponent (preferowana integracja z istniejącym `src/components/common/FormError.tsx`) do wyświetlania błędów walidacji frontowej oraz błędów zwracanych przez API w jednolitym formacie.

- **System powiadomień (`Toasts`)**  
  Wykorzystanie biblioteki `sonner` (funkcje `toast.success`, `toast.error`) do pokazywania komunikatów sukcesu / porażki przy operacjach nadania i odebrania ról oraz przy błędach sieciowych lub serwerowych.

- **Custom hook stanu widoku: `useAdminUserRoles`**  
  Hook zarządzający stanem listy adminów, filtrowaniem, dialogami oraz wywołaniami API (`GET/POST/DELETE /api/admin/user-roles`). Zapewnia spójną obsługę błędów, autoryzacji i aktualizacji stanu.

**Hierarchia komponentów (drzewo, uproszczone):**

- `admins.astro`
  - `AdminAdminsPage`
    - `PageHeader` (tytuł, opis)
    - `AdminsToolbar`
      - `UserSearch` (pole tekstowe w ramach toolbara)
    - `AdminsList`
      - `UserRow` (x N) - każdy wiersz zawiera przyciski akcji (Grant/Revoke)
    - `RevokeAdminConfirmDialog` (warunkowo)
    - Globalne `Toasts` (zdefiniowane na poziomie layoutu / root aplikacji)

### 4. Szczegóły komponentów

#### 4.1 `AdminAdminsPage`

- **Opis komponentu** (zaimplementowane jako `AdminAdminsPage`)
  Główny kontener widoku zarządzania użytkownikami i administratorami. Odpowiada za:
  - inicjalne pobranie listy wszystkich użytkowników systemu (`GET /api/admin/users`),
  - przechowywanie i przekazywanie stanu widoku z hooka `useAdminUsers`,
  - renderowanie nagłówka, paska akcji, listy, dialogów i stanów błędu/pustego widoku,
  - a11y (`role="main"`, `aria-labelledby`, `aria-live`).

- **Główne elementy HTML / komponenty dzieci**:
  - `<main className="container ...">` z `role="main"` i `aria-labelledby` identyfikującym tytuł widoku.
  - `PageHeader` (np. `h1` + opis): „User & Administrator Management".
  - `AdminsToolbar` – otrzymuje z hooka bieżące `search` oraz callback do zmiany filtra wyszukiwania.
  - `AdminsList` – otrzymuje przefiltrowane `items`, `loading`, `error`, `search` oraz callbacki do akcji (auto grant, revoke).
  - `RevokeAdminConfirmDialog` – sterowany stanem (`state.revokeDialogState`).
  - Sekcja SR-only z `aria-live="polite"` informująca czy dane są ładowane / załadowane.

- **Obsługiwane interakcje**:
  - Montowanie komponentu → wywołanie `loadInitial()` z hooka (jeśli stan jest „pristine”).
  - Zmiana wartości w polu wyszukiwania w `AdminsToolbar` → aktualizacja filtra (client-side).
  - Kliknięcie „Auto Grant" przy wierszu użytkownika bez roli admin w `AdminsList` → automatyczne przyznanie roli administratora.
  - Kliknięcie „Revoke" przy wierszu administratora w `AdminsList` → otwarcie `RevokeAdminConfirmDialog`.
  - Zamykanie / potwierdzanie dialogów przez przekazywane callbacki hooka.

- **Walidacja (na poziomie kontenera)**:
  - Walidacja długości filtra wyszukiwania (np. `maxLength={200}` w `AdminsToolbar`).
  - Trimowanie wartości filtra przed zastosowaniem (usuwanie białych znaków).
  - Blokowanie wielokrotnych równoczesnych operacji mutacyjnych (np. disabled przycisków podczas `isSubmitting`).

- **Typy (DTO i ViewModel)**:
  - Backend/shared: `UserDTO`, `CreateUserRoleCommand`, `ApiErrorResponse<UserRolesErrorCode>`.
  - ViewModel: `AdminUserListItemVM`, `AdminUsersViewState`, `RevokeAdminDialogState`.

- **Propsy**:
  - Komponent stronowy w MVP nie musi przyjmować propsów (dane pobierane klientowo).
  - Opcjonalnie można przewidzieć `initialData?: UserRoleListResponse` na potrzeby SSR/hydratacji, ale nie jest to wymagane w tym planie.

#### 4.2 `AdminsToolbar` (UserSearch)

- **Opis komponentu** (zaimplementowane jako `AdminsToolbar`)
  Pasek akcji nad listą użytkowników. Udostępnia:
  - pole wyszukiwania użytkowników (po `userId` lub `email`).

- **Główne elementy**:
  - Kontener z polem `Input` z ikoną lupy dla wyszukiwania użytkowników.

- **Obsługiwane zdarzenia / interakcje**:
  - `onSearchChange(value: string)` – wywoływane przy zmianie wartości w polu input.

- **Warunki walidacji**:
  - Filtrowanie po `userId` lub `email` (case-insensitive, z trimowaniem).

- **Typy**:
  - `AdminsToolbarProps`:
    - `search: string`
    - `onSearchChange: (value: string) => void`
    - `onCreateClick: () => void`
    - `isSearching?: boolean` (opcjonalne, do prezentacji loadera jeśli w przyszłości będzie API search).

- **Propsy**:
  - **`search`** – aktualna wartość filtra.
  - **`onSearchChange`** – callback do aktualizacji filtra w stanie hooka.

#### 4.3 `AdminsList` (lista użytkowników)

- **Opis komponentu** (zaimplementowane jako `AdminsList`)
  Prezentacyjna lista/tabela wszystkich użytkowników systemu. Renderuje dane view-modelowe i wystawia zdarzenia dla akcji „Auto Grant" (dla użytkowników bez roli admin) oraz „Revoke" (dla administratorów). Nie zna szczegółów implementacji API.

- **Główne elementy**:
  - Kontener z tabelą:
    - Nagłówek z kolumnami: „User ID", „Email", „Role", „Created At", „Actions"
    - `<tbody>` z wierszami użytkowników:
      - Wyświetlanie `userId` (monospace), `email`, roli (badge „admin"/„user"), daty utworzenia konta.
      - Przyciski akcji:
        - Dla użytkowników bez roli admin: przycisk zielony „Auto Grant" (ikonka UserPlus)
        - Dla administratorów: przycisk czerwony „Revoke" (ikonka UserX), disabled jeśli `item.isRevocable === false`
  - Widoki pustej listy:
    - Bez użytkowników: komunikat o konieczności ustawienia zmiennej środowiskowej
    - Bez wyników wyszukiwania: komunikat o braku dopasowań
  - Wskaźnik ładowania: skeleton dla wierszy gdy `loading === true`
  - Wyświetlanie błędów: blok Alert nad tabelą z komunikatem błędu

- **Obsługiwane zdarzenia**:
  - `onRevokeClick(userId: string)` – wywoływane przy kliknięciu „Revoke" dla administratora (tylko gdy `isRevocable === true`).
  - `onAutoGrantClick(userId: string)` – wywoływane przy kliknięciu „Auto Grant" dla użytkownika bez roli admin.

- **Warunki walidacji / logika UI**:
  - Dla administratorów, dla których `isRevocable === false`:
    - przycisk „Revoke" jest disabled.
    - Tooltip wyjaśnia powód blokady („Cannot revoke administrator role - cannot remove the last administrator").
  - Przycisk „Auto Grant" widoczny tylko dla użytkowników bez roli admin.
  - Komponent nie wykonuje walidacji danych wejściowych (zakłada, że view-model jest poprawnie przygotowany).

- **Typy**:
  - `AdminsListProps`:
    - `items: AdminUserListItemVM[]`
    - `loading: boolean`
    - `error?: ApiErrorResponse<UserRolesErrorCode> | null`
    - `search: string`
    - `onRevokeClick: (userId: string) => void`
    - `onAutoGrantClick?: (userId: string) => void`

- **Propsy**:
  - **`items`** – lista wszystkich użytkowników (filtracja następuje w komponencie rodzicu).
  - **`loading`** – stan ładowania danych.
  - **`error`** – błąd ładowania listy.
  - **`search`** – tekst filtra używany do wyświetlania odpowiednich komunikatów pustej listy.
  - **`onRevokeClick`** – handler otwierający dialog odebrania roli administratora.
  - **`onAutoGrantClick`** – handler automatycznego przyznania roli administratora.

#### 4.4 `RevokeAdminConfirmDialog` (zaimplementowane jako `RevokeAdminConfirmDialog`)

- **Opis komponentu**  
  Potwierdzenie odebrania roli administratora wskazanemu użytkownikowi. Używa Shadcn `AlertDialog` i prezentuje ostrzeżenie oraz szczegóły operacji (ID użytkownika).

- **Główne elementy**:
  - Shadcn `AlertDialog` z:
    - Tytułem, np. „Odebrać rolę administratora?”.
    - Treścią zawierającą `userId` i informację o konsekwencjach (np. „Użytkownik utraci dostęp do panelu administracyjnego.”).
    - Opcjonalne dodatkowe ostrzeżenie, jeśli `isSelf === true` (odebranie roli sobie).
  - Przyciski:
    - `Button variant="destructive"` „Odbierz rolę”.
    - `Button variant="outline"` „Anuluj”.

- **Obsługiwane zdarzenia**:
  - Kliknięcie przycisku potwierdzenia → `onConfirm()`.
  - Kliknięcie „Anuluj” lub zamknięcie dialogu → `onCancel()`.

- **Warunki walidacji**:
  - Komponent nie waliduje danych (zakłada, że `userId`/`role` są poprawne).
  - Nie powinien być otwierany, jeśli logika hooka stwierdzi, że rola nie jest revocable (ostatni admin).

- **Typy**:
  - `RevokeAdminDialogState`:
    - `open: boolean`
    - `userId: string`
    - `role: "admin"`
    - `isSubmitting: boolean`
    - `apiError?: ApiErrorResponse<UserRolesErrorCode>`
    - `isSelf?: boolean`
  - `RevokeAdminConfirmDialogProps`:
    - `state: RevokeAdminDialogState | null`
    - `onConfirm: () => void`
    - `onCancel: () => void`

- **Propsy**:
  - **`state`** – informacje o aktualnie revokowanej roli, użyte do renderowania treści dialogu i disabled stanu przycisku.
  - **`onConfirm`** – callback wywołany przy kliknięciu „Odbierz rolę”.
  - **`onCancel`** – callback przy anulowaniu / zamknięciu.

#### 4.5 `FormError`

- **Opis komponentu**  
  Komponent prezentujący listę komunikatów błędów (zarówno z walidacji frontowej, jak i API). Może wykorzystywać Shadcn `Alert` lub customowy styl, zgodnie z istniejącym `src/components/common/FormError.tsx`.

- **Główne elementy**:
  - Wrapper (np. `<div role="alert" className="...">`).
  - Lista `<ul><li>` z przekazanymi komunikatami.

- **Obsługiwane zdarzenia**:
  - Brak – komponent tylko wyświetla przekazane dane.

- **Walidacja**:
  - Brak logiki walidacyjnej – zakłada gotowe komunikaty.

- **Typy / propsy**:
  - `FormErrorProps`:
    - `messages: string[]`

#### 4.6 System `Toasts` (`sonner`)

- **Opis**  
  W widoku używamy `toast.success` i `toast.error` do komunikacji z użytkownikiem przy operacjach sieciowych i błędach. Toastery są zdefiniowane globalnie (np. w root layoutcie); komponenty/hook jedynie wywołują funkcje.

- **Przykładowe zdarzenia**:
  - Sukces nadania roli → `toast.success("Rola administratora została nadana")`.
  - Sukces odebrania roli → `toast.success("Rola administratora została odebrana")`.
  - Błąd walidacji → `toast.error("Walidacja nie powiodła się", { description: ... })`.
  - Błąd sieci → `toast.error("Błąd sieci", { description: ... })`.

### 5. Typy

#### 5.1 Istniejące typy (backend / shared)

- **`UserRoleDTO`** (`src/types.ts`):
  - `user_id: string` – identyfikator użytkownika (UUID).
  - `role: string` – nazwa roli, w MVP `"admin"`.
  - `granted_at: string` – znacznik czasu ISO nadania roli.

- **`UserRoleListResponse`**:
  - `data: UserRoleDTO[]` – lista wszystkich przypisań ról (w praktyce adminów).
  - `page: { next_cursor: string | null; has_more: boolean }` – informacja paginacyjna, dla tego endpointu zawsze `next_cursor: null`, `has_more: false`.

- **`CreateUserRoleCommand`**:
  - `user_id: string` – UUID użytkownika.
  - `role: string` – `"admin"`.

- **`ApiErrorResponse<UserRolesErrorCode>`**:
  - `error.code: "unauthorized" | "insufficient_permissions" | "invalid_body" | "invalid_path_params" | "role_exists" | "role_not_found" | "db_error" | "unexpected_error"`.
  - `error.message: string` – opis błędu.
  - `error.details?: Json` – szczegóły (np. `issues` dla walidacji).

#### 5.2 Nowe typy ViewModel i stany

- **`AdminUserListItemVM`** (view-model pojedynczego użytkownika na liście):
  - `userId: string` – identyfikator użytkownika.
  - `email: string` – adres email użytkownika.
  - `hasAdminRole: boolean` – czy użytkownik ma rolę administratora.
  - `isRevocable: boolean` – czy można odebrać rolę administratora (tylko dla administratorów):
    - `false` jeśli to ostatni administrator w systemie.
  - `createdAt: string` – data utworzenia konta użytkownika.

- **`AdminUsersViewState`** (stan całego widoku):
  - `items: AdminUserListItemVM[]` – lista wszystkich użytkowników systemu.
  - `loading: boolean` – czy trwa ładowanie listy.
  - `error: ApiErrorResponse<UserRolesErrorCode> | null` – ostatni błąd operacji.
  - `search: string` – aktualna wartość filtra tekstowego.
  - `nextCursor: string | null` – paginacja (null dla tego endpointu).
  - `hasMore: boolean` – czy są więcej danych (false dla tego endpointu).
  - `revokeDialogState: RevokeAdminDialogState | null` – stan dialogu odebrania roli.
  - `authorizationError?: ApiErrorResponse<UserRolesErrorCode>` – błędy autoryzacji.
  - `lastStatusCode?: number` – kod ostatniej odpowiedzi HTTP.

- **`RevokeAdminDialogState`**:
  - `open: boolean`
  - `userId: string`
  - `role: "admin"`
  - `isSubmitting: boolean`
  - `apiError?: ApiErrorResponse<UserRolesErrorCode>`
  - `isSelf?: boolean`

- **`UseAdminUsersReturn`** (interfejs hooka):
  - `state: AdminUsersViewState`
  - `loadInitial: () => Promise<void>`
  - `searchUsers: (term: string) => void`
  - `autoGrantRole: (userId: string) => Promise<void>`
  - `openRevokeDialog: (userId: string) => void`
  - `confirmRevoke: () => Promise<void>`
  - `cancelRevoke: () => void`

### 6. Zarządzanie stanem

- **Custom hook `useAdminUsers`** (zaimplementowane jako `useAdminUsers`):
  - **Lokalizacja pliku**: `src/components/admin/admins/useAdminUsers.ts`
  - **Cel**: enkapsulacja logiki pobierania użytkowników, zarządzania rolami administratorów oraz dialogów.
  - **Inicjalny stan**:
    - `items: []`
    - `loading: false`
    - `error: null`
    - `search: ""`
    - `nextCursor: null`
    - `hasMore: false`
    - `revokeDialogState: null`
    - `authorizationError: undefined`
  - **Pomocnicze referencje**:
    - `abortControllerRef` – do anulowania trwających requestów GET podczas kolejnych odświeżeń.
    - `redirectToLoginRef` – funkcja przekierowująca do `/auth/login` w przypadku 401/403.
    - (opcjonalnie) `currentUserIdRef` – identyfikator aktualnego użytkownika (z istniejącego mechanizmu auth), używany do ustawiania `isSelf`.

- **Główne metody / akcje hooka**:
  - `parseApiError(response: Response): Promise<ApiErrorResponse<UserRolesErrorCode>>`
    Parsuje błędy z API na jednolity format.
  - `mapUserDtoToVm(dto: UserDTO): AdminUserListItemVM`
    Mapuje DTO użytkownika na view-model z informacją o roli administratora i możliwości jej odebrania.
  - `fetchUsers(): Promise<void>`:
    - Pobiera listę wszystkich użytkowników systemu (`GET /api/admin/users`).
    - Ustawia odpowiednie flagi ładowania i błędów.
    - Mapuje dane na `AdminUserListItemVM[]` z obliczeniem `isRevocable`.
  - `loadInitial(): Promise<void>`:
    - Wywołuje `fetchUsers()` przy inicjalizacji.
  - `searchUsers(term: string)`:
    - Aktualizuje filtr wyszukiwania.
    - Filtrowanie następuje w komponencie `AdminAdminsPage`.
  - `autoGrantRole(userId: string): Promise<void>`:
    - Sprawdza czy użytkownik już ma rolę administratora.
    - Wysyła POST `/api/admin/user-roles` z `CreateUserRoleCommand`.
    - Obsługuje błędy API (409 role_exists, 401/403, itp.).
    - Przy sukcesie odświeża listę użytkowników i pokazuje toast sukcesu.
  - `openRevokeDialog(userId: string)`:
    - Sprawdza czy rola może być odebrana (`isRevocable`).
    - Ustawia stan dialogu potwierdzenia.
  - `confirmRevoke(): Promise<void>`:
    - Wysyła DELETE `/api/admin/user-roles/${userId}/admin`.
    - Obsługuje odpowiedzi API i odświeża listę przy sukcesie.
  - `cancelRevoke()`:
    - Zamyka dialog potwierdzenia.

### 7. Integracja API

- **GET `/api/admin/users`**
  - **Zastosowanie w UI**:
    - `loadInitial()` w hooku `useAdminUsers` przy wejściu na stronę.
    - `fetchUsers()` po zmianach ról dla odświeżenia listy.
  - **Typ żądania**:
    - Metoda: `GET`.
    - Nagłówki: autoryzacja (Supabase/JWT).
  - **Typ odpowiedzi**:
    - Lista użytkowników z informacją o rolach administratorów.
  - **Obsługa błędów**:
    - 401/403 → redirect do login.
    - 500 → zapis błędu w stanie.

- **GET `/api/admin/user-roles`**
  - **Zastosowanie w UI**:
    - Pobieranie szczegółów ról dla obliczenia `isRevocable`.

- **POST `/api/admin/user-roles`**
  - **Zastosowanie w UI**:
    - W `submitGrant(values)` po lokalnej walidacji formularza.
  - **Typ żądania**:
    - Metoda: `POST`.
    - Nagłówki:
      - `Content-Type: application/json`.
      - Autoryzacja (Supabase/JWT).
    - Body (TS): `CreateUserRoleCommand`.
  - **Odpowiedź**:
    - Sukces: status `201 Created`, body `null`.
    - Błędy:
      - 400 `invalid_body` (szczegóły w `error.details.issues`).
      - 401 `unauthorized`.
      - 403 `insufficient_permissions`.
      - 409 `role_exists`.
      - 500 `db_error` / `unexpected_error`.

- **DELETE `/api/admin/user-roles/:user_id/:role`**
  - **Zastosowanie w UI**:
    - W `confirmRevoke()` po potwierdzeniu w `RevokeAdminConfirmDialog`.
  - **Typ żądania**:
    - Metoda: `DELETE`.
    - Path params:
      - `user_id` – `revokeDialogState.userId`.
      - `role` – `"admin"`.
    - Nagłówki: autoryzacja.
  - **Odpowiedź**:
    - Sukces: `204 No Content`.
    - Błędy:
      - 400 `invalid_path_params` (np. złe UUID lub rola – z założenia nie wystąpi z poprawnego UI).
      - 401 `unauthorized`.
      - 403 `insufficient_permissions`.
      - 404 `role_not_found`.
      - 500 `db_error` / `unexpected_error`.

### 8. Interakcje użytkownika

- **Wejście na stronę `/admin/admins`**:
  - `AdminAdminsPage` montuje się, wywołuje `loadInitial()`.
  - UI pokazuje loader, a następnie listę adminów lub komunikat o pustej liście.

- **Wyszukiwanie użytkowników (`UserSearch`)**:
  - Użytkownik wpisuje fragment `userId` w polu w `AdminsToolbar`.
  - `onSearchChange` aktualizuje stan `search` w `useAdminUserRoles`.
  - `AdminsList` filtruje `items` po substringu `userId` (po trimowaniu), aktualizując natychmiast wyświetlaną listę.

- **Nadanie roli admin (Auto Grant)**:
  - Kliknięcie przycisku „Auto Grant" (zielony) przy użytkowniku bez roli admin.
  - Automatyczne wywołanie `autoGrantRole(userId)`:
    - Sprawdzenie czy użytkownik już ma rolę (toast błędu jeśli tak).
    - Wysłanie POST `/api/admin/user-roles`.
    - Przy sukcesie – toast sukcesu, lista odświeżona.
    - Przy błędach – odpowiednie komunikaty toast.

- **Odebranie roli admin (`RevokeAdminConfirmDialog`)**:
  - Kliknięcie „Odbierz” przy wierszu na liście:
    - Jeśli `item.isRevocable === false` – przycisk disabled i tooltip wyjaśniający.
    - Jeśli `isRevocable === true` – otwiera się dialog potwierdzenia.
  - Po potwierdzeniu – `confirmRevoke()`:
    - W przypadku sukcesu – toast sukcesu, rekord znika z listy.
    - W przypadku `role_not_found` – toast z informacją, że rola już została odebrana, odświeżenie listy.

- **Błędy autoryzacji**:
  - Przy dowolnej akcji, która zwraca 401/403:
    - Hook zapisuje `authorizationError`.
    - Wywołuje redirect na `/auth/login`.
    - UI może pokazać toast „Brak uprawnień / Sesja wygasła”.

### 9. Warunki i walidacja

- **Warunki wymagane przez API**:
  - `user_id` w `CreateUserRoleCommand` i w ścieżce DELETE musi być poprawnym UUID.
  - `role` musi być `"admin"`.
  - Użytkownik musi być zalogowany i mieć uprawnienia admin.

- **Walidacja po stronie UI**:
  - W `AdminsToolbar`:
    - Filtrowanie po `userId` lub `email` (case-insensitive, z trimowaniem).
  - W `AdminsList`:
    - `isRevocable` steruje dostępnością przycisku „Revoke".
    - Przycisk „Auto Grant" widoczny tylko dla użytkowników bez roli admin.
  - W hooku `autoGrantRole`:
    - Sprawdzenie duplikatu roli przed wysłaniem requestu.
    - Blokowanie wielokrotnych operacji.

- **Wpływ walidacji na stan UI**:
  - Błędy lokalne → aktualizują `fieldErrors` w odpowiednich stanach dialogów i blokują wysyłkę requestu.
  - Błędy API (z `error.details.issues`) → mapowane na `fieldErrors` i `apiError`, łagodnie informując użytkownika, co poprawić.
  - Specyficzne kody (`role_exists`, `role_not_found`) → decydują o treści komunikatów i ewentualnym odświeżeniu listy.

### 10. Obsługa błędów

- **Błędy walidacji (400 `invalid_body`, 400 `invalid_path_params`)**:
  - Mapowane na:
    - listę błędów formularza w `GrantAdminDialog` (dla `invalid_body`),
    - ogólny komunikat w dialogu `RevokeAdminConfirmDialog` lub toast (dla `invalid_path_params`, który nie powinien wystąpić z poprawnego UI).

- **Błędy autoryzacji (401 `unauthorized`, 403 `insufficient_permissions`)**:
  - Przechwytywane we wszystkich metodach hooka:
    - zapis do `authorizationError` w stanie,
    - natychmiastowe przekierowanie do `/auth/login`,
    - toast „Brak uprawnień do zarządzania administratorami” lub „Sesja wygasła”.

- **Błędy konfliktu / stanu ról (409 `role_exists`, 404 `role_not_found`)**:
  - `role_exists` (POST):
    - dedykowany komunikat w `GrantAdminDialog` (np. „Użytkownik ma już rolę administratora.”) + toast ostrzegawczy.
  - `role_not_found` (DELETE):
    - informacja, że rola nie istnieje (np. „Ten użytkownik nie ma już roli administratora.”),
    - zamknięcie dialogu, opcjonalne odświeżenie listy przez `fetchRoles()`.

- **Błędy serwera (500 `db_error`, `unexpected_error`) i sieci**:
  - W każdym przypadku:
    - ustawienie odpowiedniego `apiError` lub `error` w stanie widoku / dialogu,
    - toast z generycznym komunikatem („Wystąpił błąd serwera. Spróbuj ponownie później.” lub „Błąd sieci.”),
    - w przypadku delete, zachowanie dialogu otwartego lub zamknięcie – decyzja UX (rekomendowane: pozostawienie otwartego, aby użytkownik mógł spróbować ponownie).

- **Ostatni administrator**:
  - Jeśli backend wprowadza constraint (np. zwraca `db_error` z odpowiednimi detalami przy próbie usunięcia ostatniego admina):
    - UI prezentuje dedykowany komunikat („Nie można usunąć ostatniego administratora systemu.”) na podstawie `error.details` lub predefiniowanej heurystyki.
  - Dodatkowo UI-level `isRevocable` uniemożliwia standardowe próby usunięcia ostatniego admina.

### 11. Kroki implementacji

1. **Przygotowanie struktury plików** ✅
   - Utworzono katalog `src/components/admin/admins/` z plikami:
     - `AdminAdminsPage.tsx`
     - `AdminsToolbar.tsx`
     - `AdminsList.tsx`
     - `RevokeAdminConfirmDialog.tsx`
     - `useAdminUsers.ts`
   - Utworzono stronę `src/pages/admin/admins.astro`.

2. **Definicja typów widoku** ✅
   - Dodano typy w `src/types.ts`:
     - `AdminUserListItemVM`
     - `AdminUsersViewState`
     - `RevokeAdminDialogState`
   - Wykorzystano istniejące typy `UserDTO`, `CreateUserRoleCommand`, `ApiErrorResponse<UserRolesErrorCode>`.

3. **Implementacja hooka `useAdminUsers`** ✅
   - Zaimplementowano `useAdminUsers` z metodami:
     - `fetchUsers()` (GET `/api/admin/users`),
     - `loadInitial()`,
     - `searchUsers(term)`,
     - `autoGrantRole(userId)`,
     - `openRevokeDialog`, `confirmRevoke`, `cancelRevoke`.
   - Dodano obsługę błędów API i integrację z `sonner` dla powiadomień.

4. **Implementacja komponentu `AdminAdminsPage`** ✅
   - Podłączono hook `useAdminUsers`.
   - Zaimplementowano layout z `PageHeader`, `AdminsToolbar`, `AdminsList`, `RevokeAdminConfirmDialog`.
   - Dodano filtrowanie client-side i obsługę stanów ładowania/błędów.
   - Zaimplementowano sekcję SR-only z `aria-live`.

5. **Implementacja komponentów prezentacyjnych** ✅
   - `AdminsToolbar`: pole wyszukiwania z ikoną.
   - `AdminsList`: tabela z kolumnami `User ID`, `Email`, `Role`, `Created At`, `Actions`.
     - Przyciski „Auto Grant" (zielony) dla użytkowników bez roli admin.
     - Przyciski „Revoke" (czerwony) dla administratorów z obsługą `isRevocable`.
   - `RevokeAdminConfirmDialog`: Shadcn `AlertDialog` z potwierdzeniem odebrania roli.

6. **Integracja z nawigacją i autoryzacją** ✅
   - Dodano pozycję menu „Administrators" w `AppSidebar` (widoczna tylko dla adminów).
   - Endpointy wymagają autoryzacji administratora.

7. **UX i obsługa błędów** ✅
   - Dodano komunikaty toast dla wszystkich operacji (sukces, błędy).
   - Operacje odebrania roli wymagają potwierdzenia w dialogu.
   - Zabezpieczenie przed usunięciem ostatniego administratora (`isRevocable`).

8. **Refinement i testy** ✅
   - Zaimplementowano zgodnie z zasadami czystego kodu i obsługi błędów.
   - Przetestowano podstawowe scenariusze funkcjonalności.
