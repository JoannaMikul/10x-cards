# API Endpoint Implementation Plan: Generation Error Logs (Admin)

## 1. Przegląd punktu końcowego

Endpoint `GET /api/admin/generation-error-logs` służy do pobierania listy błędów generowania fiszek przez użytkowników systemu. Jest przeznaczony wyłącznie dla administratorów systemu i umożliwia monitorowanie problemów z generowaniem treści AI. Endpoint obsługuje filtrowanie po użytkowniku, modelu AI oraz zakresie dat, a także paginację wyników.

## 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/admin/generation-error-logs`
- **Parametry**:
  - **Opcjonalne**:
    - `user_id` (string, UUID format) - filtruje błędy po konkretnym użytkowniku
    - `model` (string) - filtruje błędy po modelu AI używanym podczas generowania
    - `from` (string, ISO date format) - filtruje błędy od określonej daty (włącznie)
    - `to` (string, ISO date format) - filtruje błędy do określonej daty (włącznie)
    - `limit` (number, 1-100, domyślnie 20) - maksymalna liczba wyników na stronę
    - `cursor` (string, base64-encoded) - kursor paginacji dla kolejnej strony wyników

- **Request Body**: Brak (GET request)

## 3. Wykorzystywane typy

**Istniejące typy DTO (z `src/types.ts`):**

- `GenerationErrorLogDTO` - zawiera pola: id, user_id, model, error_code, error_message, source_text_hash, source_text_length, created_at
- `GenerationErrorLogListResponse` - rozszerza `PaginatedResponse<GenerationErrorLogDTO>`

**Nowe typy do utworzenia:**

- `GenerationErrorLogsQuery` interface w schemacie walidacji
- Rozszerzenie `error-logs.service.ts` o funkcję `getGenerationErrorLogs`

## 4. Szczegóły odpowiedzi

**Sukces (200 OK):**

```typescript
{
  data: GenerationErrorLogDTO[],
  page: {
    next_cursor: string | null,
    has_more: boolean
  }
}
```

**Kody błędów:**

- `400 Bad Request` - nieprawidłowe parametry (UUID, format daty, zakres limit)
- `403 Forbidden` - użytkownik nie posiada uprawnień administratora
- `500 Internal Server Error` - błąd serwera/bazy danych

## 5. Przepływ danych

1. **Walidacja parametrów**: Parsowanie i walidacja query parameters przy użyciu Zod schema
2. **Sprawdzenie uprawnień**: Weryfikacja statusu administratora przez funkcję `is_admin()`
3. **Konstrukcja zapytania**: Budowanie zapytania Supabase z filtrami i paginacją
4. **Wykonanie zapytania**: Pobranie danych z tabeli `generation_error_logs` z uwzględnieniem RLS
5. **Formatowanie odpowiedzi**: Mapowanie wyników na DTO i dodanie metadanych paginacji
6. **Obsługa błędów**: Przechwytywanie i formatowanie błędów zgodnie ze specyfikacją

## 6. Względy bezpieczeństwa

- **Autoryzacja**: Wymagane uprawnienia administratora sprawdzane przez funkcję `is_admin()` przed każdym dostępem
- **RLS Protection**: Tabela `generation_error_logs` posiada politykę RLS `USING (is_admin())` zapewniającą, że tylko administratorzy mogą czytać dane
- **Walidacja wejścia**: Wszystkie parametry są walidowane przy użyciu Zod schemas
- **SQL Injection Protection**: Zapytania wykonywane przez Supabase ORM, bezpieczne przed SQL injection
- **Rate Limiting**: Rozważyć implementację rate limiting dla endpointów admin (nie wymagane przez specyfikację, ale zalecane)
- **Audit Logging**: Wszystkie dostępy administratorów powinny być logowane dla celów bezpieczeństwa

## 7. Obsługa błędów

**Scenariusze błędów i odpowiedzi:**

- **403 Forbidden**: Użytkownik nie jest administratorem

  ```json
  {
    "error": {
      "code": "ACCESS_DENIED",
      "message": "Administrator privileges required"
    }
  }
  ```

- **400 Bad Request**: Nieprawidłowe parametry

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request parameters",
      "details": {
        "issues": [
          {
            "message": "Invalid UUID format",
            "path": ["user_id"]
          }
        ]
      }
    }
  }
  ```

- **500 Internal Server Error**: Błąd bazy danych lub serwera
  ```json
  {
    "error": {
      "code": "INTERNAL_ERROR",
      "message": "Failed to retrieve generation error logs"
    }
  }
  ```

## 8. Rozważania dotyczące wydajności

- **Indeksy bazy danych**: Wykorzystanie istniejących indeksów na `created_at DESC` i `user_id`
- **Paginacja**: Cursor-based pagination dla efektywnego przeglądania dużych zbiorów danych
- **Filtrowanie**: Optymalizacja zapytań z wieloma filtrami poprzez odpowiednie indeksy
- **Cache**: Rozważyć cache dla często używanych zapytań (bez filtrów użytkownika)
- **Limit wyników**: Maksymalny limit 100 rekordów na żądanie zapobiega przeciążeniu

## 9. Etapy wdrożenia

1. **Stworzyć schemat walidacji** (`src/lib/validation/generation-error-logs.schema.ts`)
   - Zdefiniować Zod schemas dla wszystkich parametrów
   - Obsłużyć domyślne wartości i transformacje

2. **Rozszerzyć error-logs.service.ts**
   - Dodać funkcję `getGenerationErrorLogs` z parametrami filtrowania
   - Zaimplementować paginację i sortowanie

3. **Stworzyć endpoint API** (`src/pages/api/admin/generation-error-logs.ts`)
   - Implementować handler GET zgodnie ze wzorcem innych endpointów
   - Dodać sprawdzenie uprawnień administratora

4. **Zaimplementować filtrowanie i paginację**
   - Obsłużyć wszystkie parametry filtrujące (user_id, model, from, to)
   - Zaimplementować cursor-based pagination

5. **Dodać kompleksową obsługę błędów**
   - Implementować wszystkie scenariusze błędów zgodnie ze specyfikacją
   - Dodać odpowiednie logowanie błędów

6. **Przetestować endpoint**
   - Testy jednostkowe dla service layer
   - Testy integracyjne dla całego endpointa
   - Testy bezpieczeństwa (non-admin access, parameter validation)

7. **Optymalizacja i refaktoring**
   - ✅ Code review i optymalizacje wydajnościowe
   - ✅ Dodanie dokumentacji i komentarzy
   - ✅ Aktualizacja tego planu implementacji
