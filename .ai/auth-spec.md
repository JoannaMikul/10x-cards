## Moduł autentykacji 10x-cards – specyfikacja techniczna

### Założenia ogólne

- **Kontekst produktu**: Autentykacja musi spełniać wymagania US-000 i US-001 z `@.ai/prd.md`, przy zachowaniu obecnego działania generatora, widoku kandydatów i API (w tym wzorców walidacji, logowania błędów i struktur DTO).
- **Stack techniczny**: Astro 5 (SSR, `output: "server"` zgodnie z `astro.config.mjs`), React 19 dla komponentów interaktywnych, TypeScript 5, Tailwind 4, Shadcn/ui, Supabase (PostgreSQL + Supabase Auth) jako backend.
- **Zasada kluczowa**: Logika autentykacji jest warstwą przekrojową – nie zmienia kontraktów istniejących serwisów domenowych (generations, generation-candidates, flashcards itp.), a jedynie dostarcza im prawidłowy `user_id` i kontrolę dostępu (RLS + sprawdzanie sesji).
- **Docelowy stan**: Dane są filtrowane po `auth.uid()` / `user_id` w RLS, a aplikacja nie operuje na stałym `DEFAULT_USER_ID` poza trybem deweloperskim/testowym.

---

## 1. Architektura interfejsu użytkownika

### 1.1. Podział widoków: tryb publiczny vs zalogowany

- **Widoki publiczne (non-auth)**:
  - `src/pages/index.astro`: Główna strona logowania – domyślny entrypoint aplikacji dla niezalogowanych użytkowników (renderuje layout z formularzem `LoginForm` i obsługą parametru `redirect`).
  - Dodatkowe strony `src/pages/auth/register.astro`, `src/pages/auth/reset-password.astro`, `src/pages/auth/update-password.astro` – dostępne bez logowania.
  - Elementy UI (np. w nagłówku) prezentują przyciski **"Zaloguj się"** i **"Załóż konto"**.
- **Widoki chronione (auth-only)**:
  - `src/pages/generator.astro`, `src/pages/candidates.astro` (już istniejące) oraz przyszłe: `src/pages/flashcards.astro`, `src/pages/reviews.astro`, dashboard KPI itp.
  - Dla niezalogowanego użytkownika następuje serwerowy redirect do strony logowania (`/?redirect=<docelowy_URL>`) (spełnienie kryterium US-000).

### 1.2. Layout i globalny shell aplikacji

- **Rozszerzenie `Layout.astro`**:
  - Dodanie nagłówka z:
    - logo/nazwą aplikacji `public/10xcards_logo.svg`,
    - nawigacją do kluczowych funkcji (`/generator`, `/candidates`, w przyszłości `/flashcards`, `/reviews`),
    - sekcją stanu użytkownika:
      - jeśli brak sesji: linki/przyciski **"Zaloguj się"**, **"Załóż konto"**,
      - jeśli użytkownik zalogowany: nazwa/adres e-mail + przycisk **"Wyloguj"**.
  - Layout pozostaje "pasujący" do obecnych stron (brak zmian w treści głównej, tylko dopięty shell).
- **Komponent stanu auth w layoucie**:
  - `src/components/AuthStatus.tsx` (React, osadzony w `Layout.astro` z `client:load`):
    - otrzymuje aktualnego użytkownika jako prop (`currentUser`) przekazany z `Layout.astro` (na podstawie `Astro.locals.user` ustawionego w middleware),
    - prezentuje mały UI (avatar/e-mail + link do profilu/wylogowania) bez konieczności wywoływania dodatkowego endpointu do sprawdzania sesji.
    - brak własnej logiki routingowej – wylogowanie przez POST na `/api/auth/logout`.

### 1.3. Nowe strony auth (Astro) i formularze (React)

- **Nowe strony Astro**:
  - `src/pages/index.astro`:
    - korzysta z `Layout.astro`,
    - w części `<main>` umieszcza Reactową „mini-aplikację” auth, np. komponent `AuthApp` lub `LoginForm` (`src/components/auth/LoginForm.tsx`) z `client:load`,
    - odczytuje z `Astro.url.searchParams` parametr `redirect` i przekazuje go jako prop do `LoginForm` / `AuthApp`,
    - dodatkowo przekazuje do Reacta aktualnego użytkownika (`initialUser`) na podstawie `Astro.locals.user`, co pozwala na **inicjalizację auth store po stronie klienta bez dodatkowego wywołania endpointu**.
  - `src/pages/auth/register.astro`:
    - podobnie jak `login.astro`, osadza `RegisterForm` (`src/components/auth/RegisterForm.tsx`),
    - opcjonalny parametr `redirect` do automatycznego przekierowania po rejestracji.
  - `src/pages/auth/reset-password.astro`:
    - osadza `ResetPasswordForm` (`src/components/auth/ResetPasswordForm.tsx`),
    - opisuje krok wysyłania maila resetującego hasło.
  - `src/pages/auth/update-password.astro`:
    - używana jako cel linku z e-maila resetowego Supabase (`redirectTo`),
    - osadza `UpdatePasswordForm` (`src/components/auth/UpdatePasswordForm.tsx`),
    - zakłada, że sesja "recovery" zostanie dostarczona przez Supabase (parametry w URL / cookies).

- **Nowe komponenty formularzy (React)**:
  - Lokalizacja: `src/components/auth/`:
    - `LoginForm.tsx` – logowanie,
    - `RegisterForm.tsx` – rejestracja,
    - `ResetPasswordForm.tsx`,
    - `UpdatePasswordForm.tsx`,
    - opcjonalnie `AuthLayoutCard.tsx` (wspólny wrapper kart z Shadcn/ui).
  - Współdzielenie komponentów UI:
    - korzystają z istniejących komponentów Shadcn w `src/components/ui` (`input.tsx`, `button.tsx`, `label.tsx`, `field.tsx`, `alert.tsx`, `separator.tsx`),
    - błędy pola prezentują przy użyciu `FormError.tsx` (istniejący komponent) lub dedykowanego `AuthErrorMessage.tsx`.

- **Rozdzielenie odpowiedzialności Astro vs React**:
  - **Strony Astro**:
    - definiują trasę, SEO, tytuł, layout, odczyt parametrów redirect,
    - opcjonalnie wykonują serwerowy redirect, jeśli użytkownik jest już zalogowany (np. ze strony logowania `/` na `/generator`).
  - **Formularze React**:
    - zarządzają stanem pól (`email`, `password`, `passwordConfirm` itp.),
    - walidują dane na froncie (podstawowe reguły),
    - wywołują REST API (`/api/auth/*`),
    - na sukces wykonują:
      - lokalny feedback (toast, komunikat),
      - nawigację `window.location.href = redirect || "/generator"` (bez użycia frameworkowych routerów),
    - na błąd:
      - mapują `ApiErrorResponse<AuthErrorCode>` na przyjazne komunikaty (pole/forma/globalny alert),
      - mogą korzystać z `Toaster` (z `src/components/ui/sonner.tsx`) dla globalnych komunikatów.

### 1.4. Walidacja na froncie i obsługa błędów

- **Walidacja formularza rejestracji**:
  - **Pola**: `email`, `password`, `passwordConfirm` (opcjonalnie zgoda na regulamin).
  - **Reguły**:
    - `email`: niepusty, poprawny format (prostym regexem),
    - `password`: min. 8 znaków, zalecenie użycia znaków specjalnych / cyfr (komunikat pomocniczy),
    - `passwordConfirm`: musi być identyczne jak `password`.
  - **Komunikaty błędów**:
    - inline pod polem (np. "Podaj poprawny adres e-mail"),
    - globalny komunikat przy błędach serwerowych (np. "Adres e-mail jest już zarejestrowany").

- **Walidacja formularza logowania**:
  - **Pola**: `email`, `password`.
  - **Reguły**:
    - oba pola wymagane,
    - jeśli email ma ewidentnie zły format, blokada wysłania.
  - **Obsługa błędnych danych (wymóg US-001)**:
    - niezależnie od tego, czy email nie istnieje, czy hasło jest błędne, API zwraca generyczny błąd `invalid_credentials`,
    - UI wyświetla komunikat w stylu: "Nieprawidłowy e-mail lub hasło".

- **Walidacja resetu hasła**:
  - `ResetPasswordForm`:
    - jedno pole `email`, wymagane, walidacja formatu,
    - na sukces: komunikat "Jeśli konto istnieje, wysłaliśmy instrukcje resetu hasła" (bez potwierdzania istnienia konta).
  - `UpdatePasswordForm`:
    - pola `password`, `passwordConfirm`, te same reguły co przy rejestracji,
    - na sukces: przekierowanie do strony logowania (`/`) lub `/generator` z komunikatem o powodzeniu.

- **Scenariusze błędów na froncie**:
  - **Błędy walidacji klienta** – nie wysyłamy requestu, wyświetlamy komunikaty inline.
  - **Błędy walidacji serwera (400)** – mapujemy `error.code` (`invalid_body`, `password_too_weak` itd.) na czytelne teksty.
  - **Brak autoryzacji (401)** – przy odpowiedzi z API na funkcjonalnych endpointach:
    - komponenty frontowe (np. `useGeneration`, `useCandidates`) mogą:
      - opcjonalnie wykryć `error.error.code === "unauthorized"` i przekierować na `/?redirect=<aktualny_URL>`,
      - lub serwerowo wymusić redirect już na poziomie HTML (preferowany wariant).
  - **Błędy sieci / 5xx** – ogólny komunikat "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.".

### 1.5. Obsługa kluczowych scenariuszy użytkownika

- **Scenariusz: Niezalogowany użytkownik próbuje wejść na widok generatora / kandydatów**:
  - Strony `generator.astro` i `candidates.astro`:
    - w warstwie serwerowej sprawdzają `Astro.locals.user`,
    - jeśli brak użytkownika: redirect 302 do `/auth/login?redirect=<oryginalny_URL>`.
  - Po poprawnym logowaniu:
    - backend zapisuje sesję Supabase w cookies,
    - login endpoint zwraca 200, a frontend przekierowuje na `redirect` (np. `/generator?foo=bar`).

- **Scenariusz: Rejestracja z dowolnego miejsca aplikacji (US-000)**:
  - Linki "Załóż konto" dostępne w:
    - nagłówku `Layout.astro`,
    - sekcjach CTA na stronach publicznych,
    - formularzu logowania (link pod formularzem).
  - Po rejestracji:
    - użytkownik jest zalogowany (sesja Supabase aktywna),
    - następuje przekierowanie na wartość `redirect` (jeśli podana) lub `/generator`.

- **Scenariusz: Próba wywołania API bez sesji (US-000, US-001)**:
  - Endpoints domenowe (np. `/api/generations`, `/api/generation-candidates`, `/api/flashcards`) korzystają z helpera `requireUserId(context)`:
    - jeśli brak sesji: zwrot `401` z `error.code = "unauthorized"` i log wpisu bezpieczeństwa w stylu już istniejących loggerów (`recordGenerationEvent`, `recordCandidatesEvent`, itp.),
    - front (React hooks) powinien traktować `401` jako sygnał do przekierowania na `/auth/login` lub wyświetlenia informacji o utracie sesji.

---

## 2. Logika backendowa

### 2.1. Struktura endpointów API dla autentykacji

- **Nowe endpointy auth (Astro API routes)**:
  - `src/pages/api/auth/register.ts`:
    - `POST`: rejestracja użytkownika przez `Supabase Auth` (`auth.signUp`),
    - wejście: `RegisterCommand` (email, password),
    - walidacja z `auth.schema.ts`,
    - odpowiedzi:
      - `201 Created` – konto utworzone, sesja ustawiona (automatyczne logowanie),
      - `409 Conflict` – `AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED`,
      - `400 Bad Request` – błędy walidacji,
      - `500` – `AUTH_ERROR_CODES.UNEXPECTED_ERROR`.
  - `src/pages/api/auth/login.ts`:
    - `POST`: logowanie przez `auth.signInWithPassword`,
    - wejście: `LoginCommand` (email, password),
    - odpowiedzi:
      - `200 OK` – sesja ustawiona w cookies, zwrócony skrócony `CurrentUserDTO`,
      - `401 Unauthorized` – `AUTH_ERROR_CODES.INVALID_CREDENTIALS` (bez rozróżnienia przyczyny),
      - `400` – błędy walidacji,
      - `500` – nieoczekiwany błąd.
  - `src/pages/api/auth/logout.ts`:
    - `POST`: wylogowanie przez `auth.signOut`,
    - czyści cookies sesyjne Supabase,
    - zawsze zwraca `204 No Content` lub `200 OK` z prostym body.
  - `src/pages/api/auth/reset-password.ts`:
    - `POST`: wywołuje `auth.resetPasswordForEmail(email, { redirectTo: APP_URL + "/auth/update-password" })`,
    - odpowiedzi:
      - `202 Accepted` – niezależnie od tego, czy email istnieje,
      - `400` – błędy walidacji,
      - `500` – `AUTH_ERROR_CODES.UNEXPECTED_ERROR`.
  - `src/pages/api/auth/update-password.ts`:
    - `POST`: zmiana hasła użytkownika w trybie recovery (`auth.updateUser({ password })`),
    - wymaga aktywnej sesji "recovery" z Supabase (przysłanej przez link z maila),
    - odpowiedzi:
      - `200 OK` – hasło zmienione, sesja dalej aktywna lub wymagana ponowna autoryzacja,
      - `401` – brak ważnej sesji recovery,
      - `400/422` – zbyt słabe hasło, błędy formatu,
      - `500` – błąd nieoczekiwany.

### 2.2. Modele danych i DTO dla auth

- **Rozszerzenia w `src/types.ts`**:
  - `export interface CurrentUserDTO { id: string; email: string; created_at: IsoDateString; }`
  - `export interface AuthSessionDTO { user: CurrentUserDTO | null; expires_at: IsoDateString | null; }`
  - `export interface LoginCommand { email: string; password: string; }`
  - `export interface RegisterCommand { email: string; password: string; }`
  - `export interface ResetPasswordCommand { email: string; }`
  - `export interface UpdatePasswordCommand { password: string; }`
  - `export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];`

- **Rozszerzenie `src/lib/errors.ts`**:
  - dodanie:
    - `export const AUTH_ERROR_CODES = { INVALID_BODY, INVALID_CREDENTIALS, EMAIL_ALREADY_REGISTERED, UNAUTHORIZED, PASSWORD_TOO_WEAK, UNEXPECTED_ERROR } as const;`
    - `export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];`
    - funkcji `mapAuthError(error: unknown): HttpErrorDescriptor<AuthErrorCode>`:
      - wykrywa typowe kody/wiadomości z Supabase (np. `invalid_login_credentials`),
      - mapuje na HTTP status i `AuthErrorCode`.

### 2.3. Mechanizm walidacji danych wejściowych

- **Nowy plik `src/lib/validation/auth.schema.ts`**:
  - `loginSchema` (Zod):
    - `email`: string, min 1, `email()`,
    - `password`: string, min 1.
  - `registerSchema`:
    - `email`: jak wyżej,
    - `password`: string, min 8, dodatkowe komunikaty (np. "Hasło musi mieć co najmniej 8 znaków.").
  - `resetPasswordSchema`:
    - `email`: jak wyżej.
  - `updatePasswordSchema`:
    - `password`: min 8.
  - Każdy endpoint auth:
    - czyta JSON przez helper `readJsonBody` (analogiczny do istniejących),
    - wykonuje `schema.safeParse(...)`,
    - przy błędzie zwraca `400` z `AUTH_ERROR_CODES.INVALID_BODY` i listą błędów w `details`.

### 2.4. Obsługa wyjątków i logowanie

- **Standard błędów**:
  - Zgodnie z istniejącym wzorcem (`buildErrorResponse`, `map*DbError`), endpointy auth:
    - zwracają `ApiErrorResponse<AuthErrorCode>`,
    - nie ujawniają wewnętrznych szczegółów (np. szczegółowych komunikatów DB).
- **Logowanie zdarzeń bezpieczeństwa**:
  - Nowy helper `recordAuthEvent(payload)` w np. `src/lib/services/auth-logs.service.ts` lub bezpośrednio w modułach API:
    - loguje JSON do `console.info`/`console.error` z polami:
      - `scope: "api/auth/*"`,
      - `timestamp`,
      - `userId` (jeśli znany),
      - `event` (np. `login_success`, `login_failure`, `unauthorized_api_call`),
      - `ip` (opcjonalnie, jeśli dostępne z nagłówków),
      - `details`.
  - Wymóg US-000: próby wywołania API bez ważnej sesji są logowane z `event: "unauthorized_api_call"`.

### 2.5. Adaptacja istniejących endpointów do pracy z autentykacją

- **Helper `requireUserId`**:
  - Nowy moduł `src/lib/auth/server.ts`:
    - `export function getCurrentUser(context: APIContext | PageContext): { id: string; email: string } | null;`
    - `export function requireUserId(context): string`:
      - jeśli `locals.user` istnieje: zwraca `locals.user.id`,
      - jeśli nie: rzuca lub zwraca `HttpErrorDescriptor` z `AUTH_ERROR_CODES.UNAUTHORIZED`.
  - Dotychczasowe wykorzystanie `DEFAULT_USER_ID` w API (np. `generations.ts`, `generation-candidates.ts`, `flashcards.ts`) zostanie w docelowej implementacji zastąpione wywołaniami `requireUserId(context)` z fallbackiem do `DEFAULT_USER_ID` jedynie w trybie developerskim/testowym (np. za pomocą `import.meta.env.DEV`).

- **Zachowanie zgodności**:
  - Krótkoterminowo (podczas migracji) dopuszczalne jest:
    - jeśli brak sesji i środowisko `DEV`, użycie `DEFAULT_USER_ID` i ostrzegawczy log (`console.warn`),
    - w `PROD` – twarde `401 Unauthorized`.
  - Kontrakty istniejących endpointów (`/api/generations`, `/api/generation-candidates`, `/api/flashcards`, itp.) nie zmieniają się strukturalnie (body odpowiedzi, struktury DTO), jedynie potencjalnie pojawia się nowy scenariusz odpowiedzi `401` z kodem błędu `unauthorized`.

### 2.6. SSR, Astro i sposób renderowania

- **Wykorzystanie `output: "server"` z `astro.config.mjs`**:
  - Aplikacja renderuje się server-side, co:
    - pozwala na wczesne sprawdzenie sesji użytkownika w middleware,
    - umożliwia serwerowe redirecty z chronionych stron bez ładowania JS.
- **Wzorzec dla stron chronionych (np. `generator.astro`)**:
  - na górze pliku:
    - pobranie `const user = Astro.locals.user;`,
    - jeśli `!user`: `return Astro.redirect("/auth/login?redirect=" + encodeURIComponent(Astro.url.pathname + Astro.url.search));`,
    - w przeciwnym razie: render standardowej treści (tak jak obecnie).
  - Zachowuje to dotychczasową strukturę stron (główny `<main>` i osadzony komponent React).

---

## 3. System autentykacji i integracja z Supabase Auth

### 3.1. Klient Supabase po stronie serwera (SSR)

- **Aktualizacja sposobu tworzenia klienta**:
  - Obecnie `src/db/supabase.client.ts` używa `createClient` z `@supabase/supabase-js` z kluczem anon/service.
  - Docelowo dla obsługi sesji w cookies i SSR:
    - wprowadzamy `createServerClient` z pakietu `@supabase/ssr`,
    - integrujemy go z mechanizmem cookies Astro (zgodnie z wytycznymi w workspace: użycie `Astro.cookies` i `context.locals.supabase` zamiast globalnego klienta).
  - Nowa funkcja:
    - `export function initSupabaseServerClient(context: APIContext | MiddlewareContext): SupabaseClient<Database>;`
    - wykorzystuje:
      - `import.meta.env.SUPABASE_URL`,
      - `import.meta.env.SUPABASE_KEY` (anon key),
      - adapter cookies integrujący z `context.cookies` (get/set/delete).

- **Zmiana middleware**:
  - `src/middleware/index.ts`:
    - zamiast ustawiania globalnego `supabaseClient`, dla każdego requestu:
      - tworzy klienta serwerowego,
      - zapisuje w `context.locals.supabase`,
      - pobiera bieżącą sesję i użytkownika:
        - `const { data: { session } } = await supabase.auth.getSession();`,
        - jeśli sesja istnieje: ustawia `context.locals.user` i `context.locals.session`.
  - Umożliwia to każdemu endpointowi i stronie dostęp do bieżącego użytkownika przez `locals`.

- **Rozszerzenie typów w `src/env.d.ts`**:
  - Rozszerzenie namespace `App.Locals`:
    - `supabase: SupabaseClient<Database>;`
    - `user?: { id: string; email: string | null };`
    - `session?: { expires_at: number | null } & Record<string, unknown>;` (lub dokładniejszy typ z Supabase).
  - Zgodność z zasadą w workspace: używamy typu `SupabaseClient` eksportowanego z `src/db/supabase.client.ts`.

### 3.2. Klient Supabase po stronie przeglądarki (opcjonalny)

- **Browser client**:
  - Dla ewentualnych potrzeb (np. odczyt danych sesji po stronie klienta) można dodać:
    - `src/db/supabase.browser.ts` z funkcją `createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY)`.
  - Jednak główny przepływ logowania/rejestracji odbywa się przez API serwerowe, aby zachować spójność z RLS i cookie-based session management.

### 3.3. Powiązanie z RLS i modelami danych

- **Założenia RLS**:
  - Tabele domenowe (`flashcards`, `generations`, `generation_candidates`, `review_events`, `review_stats`, `user_roles`, itp.) mają reguły opierające się na `auth.uid()`:
    - np. `flashcards.owner_id = auth.uid()`,
    - `generations.user_id = auth.uid()`,
    - `generation_candidates.owner_id = auth.uid()`.
  - Endpointy API nigdy nie wykonują zapytań bezpośrednio z service role, jeśli operują na danych użytkownika:
    - w kodzie domenowym preferujemy `locals.supabase` (klient "user-level"),
    - `supabaseServiceClient` używany jest tylko do zadań administracyjnych (np. logowanie błędów, raporty KPI) i zawsze w sposób, który nie narusza prywatności (np. tylko agregaty).

- **Mapowanie użytkownika na dane**:
  - Wszystkie serwisy domenowe przyjmujące `userId: string` (np. `startGeneration`, `createFlashcard`, `listGenerationCandidates`) będą wywoływane z `userId = requireUserId(context)` w warstwie API,
  - brak potrzeby przekazywania `DEFAULT_USER_ID` w docelowym stanie produkcyjnym.

### 3.4. Przepływy Supabase Auth

- **Rejestracja**:
  - API wywołuje `supabase.auth.signUp({ email, password, options: { emailRedirectTo?: ... } })`.
  - Konfiguracja Supabase:
    - dla MVP można ustawić automatyczne potwierdzanie e-maili (brak dodatkowego kroku aktywacji),
    - spełnia wymaganie: po rejestracji konto jest aktywne, użytkownik zalogowany, otrzymuje potwierdzenie (e-mail).

- **Logowanie**:
  - API wywołuje `supabase.auth.signInWithPassword({ email, password })`.
  - Na sukces:
    - Supabase ustawia cookies sesyjne,
    - endpoint może zwrócić `CurrentUserDTO` do celów UI.
  - Na błąd:
    - jeśli Supabase zwróci `invalid_login_credentials`, mapujemy na `401` + `AUTH_ERROR_CODES.INVALID_CREDENTIALS` z generycznym komunikatem.

- **Wylogowanie**:
  - API wywołuje `supabase.auth.signOut()`,
  - usuwa cookies sesyjne,
  - UI po otrzymaniu odpowiedzi przekierowuje np. na stronę główną (`/`).

- **Resetowanie hasła**:
  - Użytkownik wypełnia `ResetPasswordForm`:
    - API wywołuje `auth.resetPasswordForEmail(email, { redirectTo: APP_URL + "/auth/update-password" })`.
    - Bez względu na istnienie konta zwraca success (bez ujawniania informacji o istnieniu konta).
  - Po kliknięciu w link w e-mailu:
    - Supabase kieruje na `/auth/update-password` z parametrami (hash w URL, cookies),
    - `UpdatePasswordForm` wywołuje endpoint `/api/auth/update-password`,
    - jeśli sesja recovery jest poprawna – hasło zmienione, użytkownik informowany o sukcesie i kierowany do logowania.

### 3.5. Zabezpieczenia i dobre praktyki

- **Ochrona przed atakami na formy auth**:
  - rate limiting po stronie Supabase (wbudowany) i ewentualny dodatkowy rate limit po stronie API (np. per IP/email),
  - brak dokładnych komunikatów o istnieniu / nieistnieniu konta,
  - logowanie nieudanych prób logowania w ograniczonej, zagregowanej formie (bez przechowywania haseł).
- **Sanityzacja danych**:
  - E-mail i hasło są traktowane jako dane tekstowe, bez interpolacji do SQL (Supabase używa parametrów),
  - przy wyświetlaniu emaili w UI stosujemy escapowanie HTML (domyślnie zapewniane przez React/Astro).
- **Zgodność z istniejącą architekturą**:
  - Wzorce walidacji, błędów i logowania w auth powielają istniejące mechanizmy (`buildErrorResponse`, rozdzielenie `services` i `validation`),
  - nowy moduł auth nie zmienia publicznych kontraktów istniejących endpointów domenowych, a jedynie dodaje spójny mechanizm autoryzacji i źródło `user_id`.
