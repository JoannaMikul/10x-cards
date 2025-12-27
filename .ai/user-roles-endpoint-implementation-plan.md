# User Roles API Endpoints Implementation Plan

## API Endpoint Implementation Plan: GET /api/admin/user-roles

### 1. Przegląd punktu końcowego

- **Cel**: Zwraca listę wszystkich przypisań ról administratorów w systemie dla celów audytu.
- **Zakres uprawnień**: **Tylko administratorzy** - endpoint wymaga sprawdzenia funkcji `is_admin()`.
- **Kontrakt**:
  - Sukces: `200 OK` z paginowaną listą `UserRoleDTO`.
  - Błędy: `ApiErrorResponse` z kodami błędów autoryzacji.

### 2. Szczegóły żądania

- **Metoda HTTP**: `GET`
- **Ścieżka**: `/api/admin/user-roles`
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <jwt>` (wymagany kontekst administratora)
  - **Opcjonalne**: `Accept: application/json`
- **Parametry**:
  - **Wymagane**: Brak
  - **Opcjonalne**: Brak (paginacja może być dodana w przyszłości jeśli lista będzie duża)
- **Request Body**: Brak

### 3. Wykorzystywane typy (DTO i Command modele)

- **DTO**:
  - `UserRoleDTO` (z `src/types.ts`) - pojedyncza rola użytkownika
  - `UserRoleListResponse` (z `src/types.ts`) - paginowana lista ról
- **Command modele**: Brak (endpoint tylko do odczytu)

### 4. Szczegóły odpowiedzi

- **200 OK**:

  ```json
  {
    "data": [
      {
        "user_id": "uuid",
        "role": "admin",
        "granted_at": "2024-12-27T10:00:00Z"
      }
    ],
    "page": {
      "next_cursor": null,
      "has_more": false
    }
  }
  ```

- **401 Unauthorized**:
  - `error.code = "unauthorized"` gdy brak sesji użytkownika
- **403 Forbidden**:
  - `error.code = "insufficient_permissions"` gdy użytkownik nie ma roli administratora
- **500 Internal Server Error**:
  - `error.code = "db_error"` dla błędów PostgREST/PostgreSQL

### 5. Przepływ danych

1. **Astro API Route**: `src/pages/api/admin/user-roles.ts` (do utworzenia).
2. **Guard rails / preconditions**:
   - `locals.supabase` musi być dostępne (zgodnie z regułami: używać klienta z `context.locals`)
   - `locals.user` musi istnieć (inaczej `401 unauthorized`)
   - Funkcja `is_admin()` musi zwrócić `true` (inaczej `403 forbidden`)
3. **Warstwa serwisowa**:
   - Dodać `getUserRoles()` w `src/lib/services/user-roles.service.ts`
   - Zapytanie do tabeli `user_roles` z RLS automatycznie filtrujące
4. **Odpowiedź**:
   - `200` + JSON z listą ról
5. **Observability**:
   - Każdy `4xx/5xx` logować jako zdarzenie JSON ze `scope: "api/admin/user-roles"`

### 6. Względy bezpieczeństwa

- **Autentyfikacja**:
  - Endpoint wymaga użytkownika w `locals.user` (brak → `401`).
- **Autoryzacja (admin only)**:
  - Wymagane sprawdzenie `is_admin()` przed jakimkolwiek dostępem do danych.
  - RLS na tabeli `user_roles` wymusza dostęp tylko dla administratorów.
- **Ryzyka**:
  - **Information disclosure**: Lista administratorów powinna być dostępna tylko dla adminów.

### 7. Wydajność

- **Operacje DB**: Jedno proste zapytanie SELECT na tabeli `user_roles`
- **Indeksy**: Wykorzystuje PK indeks na `(user_id, role)`
- **Optymalizacja**: Lista administratorów jest zazwyczaj mała, więc bez paginacji początkowo

### 8. Kroki implementacji

#### 8.1. Warstwa serwisowa (`src/lib/services/user-roles.service.ts`)

- **Dodać funkcję** `getUserRoles(supabase: SupabaseClient): Promise<UserRoleListResponse>`:
  - Zapytanie SELECT \* FROM user_roles ORDER BY granted_at DESC
  - RLS automatycznie filtruje dostęp

#### 8.2. API Route (Astro)

- **Utworzyć plik**: `src/pages/api/admin/user-roles.ts`
  - `export const prerender = false`
  - `GET`: sprawdzenie autoryzacji admin, wywołanie serwisu, obsługa błędów

#### 8.3. Błędy/kontrakty

- **Rozszerz** `src/lib/errors.ts` o `USER_ROLES_ERROR_CODES`:
  - `UNAUTHORIZED`, `INSUFFICIENT_PERMISSIONS`, `DB_ERROR`

#### 8.4. Mocks kontraktowe

- **Rozszerz** `src/lib/mocks/user-roles.api.mocks.ts` o scenariusze dla:
  - `200` success
  - `401 unauthorized`
  - `403 insufficient_permissions`
  - `500 db_error`

## API Endpoint Implementation Plan: POST /api/admin/user-roles

### 1. Przegląd punktu końcowego

- **Cel**: Przyznaje rolę administratora wskazanemu użytkownikowi.
- **Zakres uprawnień**: **Tylko administratorzy** - endpoint wymaga sprawdzenia funkcji `is_admin()`.
- **Kontrakt**:
  - Sukces: `201 Created` (rola została przyznana).
  - Błędy: `ApiErrorResponse` z kodami błędów walidacji i autoryzacji.

### 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Ścieżka**: `/api/admin/user-roles`
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
  - **Opcjonalne**: Brak
- **Parametry**:
  - **Wymagane w body**:
    - `user_id` (UUID)
    - `role` (string, obecnie tylko "admin")
- **Request Body**:

  ```json
  {
    "user_id": "uuid",
    "role": "admin"
  }
  ```

### 3. Wykorzystywane typy (DTO i Command modele)

- **DTO**: Brak (endpoint nie zwraca danych)
- **Command modele**:
  - `CreateUserRoleCommand` (z `src/types.ts`) – wejście

### 4. Szczegóły odpowiedzi

- **201 Created**: Pusta odpowiedź (rola została przyznana)
- **400 Bad Request**:
  - `error.code = "invalid_body"` gdy niepoprawny JSON/schemat (Zod)
- **401 Unauthorized**:
  - `error.code = "unauthorized"` gdy brak sesji użytkownika
- **403 Forbidden**:
  - `error.code = "insufficient_permissions"` gdy użytkownik nie ma roli administratora
- **409 Conflict**:
  - `error.code = "role_exists"` gdy użytkownik już ma tę rolę
- **500 Internal Server Error**:
  - `error.code = "db_error"` dla błędów PostgREST/PostgreSQL

### 5. Przepływ danych

1. **Astro API Route**: `src/pages/api/admin/user-roles.ts` (rozszerzenie istniejącego pliku).
2. **Guard rails / preconditions**:
   - `locals.supabase` musi być dostępne
   - `locals.user` musi istnieć (inaczej `401`)
   - Funkcja `is_admin()` musi zwrócić `true` (inaczej `403`)
3. **Walidacja body**:
   - Zod: `createUserRoleSchema.safeParse(requestBody)`
4. **Warstwa serwisowa**:
   - Dodać `createUserRole()` w `src/lib/services/user-roles.service.ts`
   - Sprawdzenie czy rola już istnieje (409)
   - INSERT do tabeli `user_roles`
5. **Odpowiedź**:
   - `201` bez body
6. **Observability**:
   - Logowanie wszystkich zmian ról dla audytu

### 6. Względy bezpieczeństwa

- **Autentyfikacja**:
  - Endpoint wymaga użytkownika w `locals.user` (brak → `401`).
- **Autoryzacja (admin only)**:
  - Wymagane sprawdzenie `is_admin()` przed przyznaniem roli.
  - RLS na tabeli `user_roles` wymusza dostęp tylko dla administratorów.
- **Ryzyka**:
  - **Privilege escalation**: Dokładna walidacja, że tylko admin może przyznawać role.

### 7. Wydajność

- **Operacje DB**: SELECT (sprawdzenie) + INSERT (jedna rola)
- **Indeksy**: Wykorzystuje PK indeks na `(user_id, role)`
- **Optymalizacja**: Operacja atomowa, rzadko wykonywana

### 8. Kroki implementacji

#### 8.1. Warstwa walidacji (`src/lib/validation/user-roles.schema.ts`)

- **Utworzyć schemat** `createUserRoleSchema`:
  - `user_id`: UUID
  - `role`: enum ["admin"]

#### 8.2. Warstwa serwisowa (`src/lib/services/user-roles.service.ts`)

- **Dodać funkcję** `createUserRole(supabase: SupabaseClient, cmd: CreateUserRoleCommand): Promise<void>`:
  - Sprawdź czy rola już istnieje (SELECT)
  - Jeśli istnieje → throw error "role_exists"
  - Jeśli nie istnieje → INSERT do user_roles

#### 8.3. API Route (Astro)

- **Rozszerzyć plik**: `src/pages/api/admin/user-roles.ts`
  - Dodaj obsługę metody `POST`
  - Walidacja auth admin, parsowanie body, wywołanie serwisu

#### 8.4. Błędy/kontrakty

- **Rozszerz** `USER_ROLES_ERROR_CODES` o:
  - `INVALID_BODY`, `ROLE_EXISTS`

## API Endpoint Implementation Plan: DELETE /api/admin/user-roles/:user_id/:role

### 1. Przegląd punktu końcowego

- **Cel**: Odbiera rolę administratora wskazanemu użytkownikowi.
- **Zakres uprawnień**: **Tylko administratorzy** - endpoint wymaga sprawdzenia funkcji `is_admin()`.
- **Kontrakt**:
  - Sukces: `204 No Content` (rola została odebrana).
  - Błędy: `ApiErrorResponse` z kodami błędów autoryzacji.

### 2. Szczegóły żądania

- **Metoda HTTP**: `DELETE`
- **Ścieżka**: `/api/admin/user-roles/:user_id/:role`
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <jwt>`
  - **Opcjonalne**: Brak
- **Parametry**:
  - **Wymagane (path)**:
    - `user_id` (UUID)
    - `role` (string, obecnie tylko "admin")
- **Request Body**: Brak

### 3. Wykorzystywane typy (DTO i Command modele)

- **DTO**: Brak (endpoint nie zwraca danych)
- **Command modele**: Brak (parametry w ścieżce)

### 4. Szczegóły odpowiedzi

- **204 No Content**: Pusta odpowiedź (rola została odebrana)
- **400 Bad Request**:
  - `error.code = "invalid_path_params"` gdy nieprawidłowe parametry ścieżki
- **401 Unauthorized**:
  - `error.code = "unauthorized"` gdy brak sesji użytkownika
- **403 Forbidden**:
  - `error.code = "insufficient_permissions"` gdy użytkownik nie ma roli administratora
- **404 Not Found**:
  - `error.code = "role_not_found"` gdy użytkownik nie posiada wskazanej roli
- **500 Internal Server Error**:
  - `error.code = "db_error"` dla błędów PostgREST/PostgreSQL

### 5. Przepływ danych

1. **Astro API Route**: `src/pages/api/admin/user-roles/[userId]/[role].ts` (do utworzenia).
2. **Guard rails / preconditions**:
   - `locals.supabase` musi być dostępne
   - `locals.user` musi istnieć (inaczej `401`)
   - Funkcja `is_admin()` musi zwrócić `true` (inaczej `403`)
3. **Walidacja parametrów ścieżki**:
   - Zod: `userRolePathParamsSchema.safeParse(params)`
4. **Warstwa serwisowa**:
   - Dodać `deleteUserRole()` w `src/lib/services/user-roles.service.ts`
   - Sprawdzenie czy rola istnieje (404 jeśli nie)
   - DELETE z tabeli `user_roles`
5. **Odpowiedź**:
   - `204` bez body
6. **Observability**:
   - Logowanie wszystkich zmian ról dla audytu

### 6. Względy bezpieczeństwa

- **Autentyfikacja**:
  - Endpoint wymaga użytkownika w `locals.user` (brak → `401`).
- **Autoryzacja (admin only)**:
  - Wymagane sprawdzenie `is_admin()` przed odebraniem roli.
  - RLS na tabeli `user_roles` wymusza dostęp tylko dla administratorów.
- **Ryzyka**:
  - **Denial of service**: Admin może przypadkowo odebrać sobie rolę.

### 7. Wydajność

- **Operacje DB**: SELECT (sprawdzenie) + DELETE (jedna rola)
- **Indeksy**: Wykorzystuje PK indeks na `(user_id, role)`
- **Optymalizacja**: Operacja atomowa, rzadko wykonywana

### 8. Kroki implementacji

#### 8.1. Warstwa walidacji (`src/lib/validation/user-roles.schema.ts`)

- **Dodać schemat** `userRolePathParamsSchema`:
  - `userId`: UUID
  - `role`: enum ["admin"]

#### 8.2. Warstwa serwisowa (`src/lib/services/user-roles.service.ts`)

- **Dodać funkcję** `deleteUserRole(supabase: SupabaseClient, userId: string, role: string): Promise<void>`:
  - Sprawdź czy rola istnieje (SELECT)
  - Jeśli nie istnieje → throw error "role_not_found"
  - Jeśli istnieje → DELETE z user_roles

#### 8.3. API Route (Astro)

- **Utworzyć plik**: `src/pages/api/admin/user-roles/[userId]/[role].ts`
  - `export const prerender = false`
  - `DELETE`: sprawdzenie auth admin, walidacja params, wywołanie serwisu

#### 8.4. Błędy/kontrakty

- **Rozszerz** `USER_ROLES_ERROR_CODES` o:
  - `INVALID_PATH_PARAMS`, `ROLE_NOT_FOUND`

### Wspólne uwagi implementacyjne dla wszystkich endpointów:

- Wszystkie endpointy muszą używać `export const prerender = false`
- Korzystanie z `context.locals.supabase` zamiast bezpośredniego importu klienta
- Implementacja zgodnie z zasadami clean code (early returns, guard clauses)
- Dodanie odpowiednich komentarzy JSDoc dla wszystkich funkcji publicznych
- Zgodność z istniejącymi wzorcami kodu w projekcie
- Wszystkie operacje na rolach powinny być logowane dla celów audytu
