# API Endpoint Implementation Plan: GET /api/admin/kpi

## 1. Przegląd punktu końcowego
Endpoint zwraca kluczowe wskaźniki wydajności (KPI) wymagane w PRD aplikacji 10x-cards. Dostarcza metryk dotyczących akceptacji kart generowanych przez AI, stosunku kart AI do kart manualnych oraz wolumenu generacji. Dane są agregowane z tabel `flashcards`, `generation_candidates` oraz opcjonalnie `review_events` w zależności od parametrów filtrowania.

## 2. Szczegóły żądania
- **Metoda HTTP:** GET
- **Struktura URL:** `/api/admin/kpi`
- **Parametry:**
  - **Wymagane:** Brak (domyślnie `range=7d`)
  - **Opcjonalne:**
    - `range`: `7d|30d|custom` (domyślnie: `7d`)
    - `group_by`: `day|category|origin` (domyślnie: `day`)
    - `from`: Data ISO string (wymagane gdy `range=custom`)
    - `to`: Data ISO string (wymagane gdy `range=custom`)

## 3. Wykorzystywane typy
- **DTOs:**
  - `AnalyticsKpiResponse` - główna struktura odpowiedzi
  - `AnalyticsTotalsDTO` - podsumowanie całkowite
  - `AnalyticsTrendPointDTO` - punkt danych trendu
- **Command Modele:** Brak (endpoint tylko do odczytu)

## 4. Szczegóły odpowiedzi
- **Kod statusu sukcesu:** 200 OK
- **Struktura odpowiedzi:**
```json
{
  "ai_acceptance_rate": 0.78,
  "ai_share": 0.74,
  "totals": {
    "ai": 740,
    "manual": 260
  },
  "trend": [
    {
      "date": "2025-11-20",
      "ai": 30,
      "manual": 10,
      "accepted_ai": 25
    }
  ]
}
```

## 5. Przepływ danych
1. **Walidacja parametrów** - sprawdzenie poprawności `range`, `group_by`, dat `from/to`
2. **Sprawdzenie uprawnień** - weryfikacja roli administratora przez funkcję `is_admin()`
3. **Wywołanie service** - delegacja do `analytics.service.ts` z parametrami
4. **Agregacja danych** - wykonywanie zapytań SQL z odpowiednimi filtrami czasowymi i grupowaniem
5. **Formatowanie odpowiedzi** - mapowanie wyników na strukturę `AnalyticsKpiResponse`
6. **Obsługa błędów** - przechwytywanie i logowanie wyjątków

## 6. Względy bezpieczeństwa
- **Autoryzacja:** Endpoint dostępny wyłącznie dla użytkowników z rolą administratora
- **Walidacja danych:** Wszystkie parametry wejściowe walidowane schematem Zod
- **SQL Injection:** Użycie parametrizowanych zapytań Supabase
- **Rate limiting:** Ograniczenie zakresu dat do maksymalnie 90 dni wstecz
- **RLS Bypass:** Service używa funkcji SECURITY DEFINER dla dostępu do danych wszystkich użytkowników

## 7. Obsługa błędów
- **400 Bad Request:** Nieprawidłowe parametry (`range`, `group_by`, `from`, `to`)
- **403 Forbidden:** Brak uprawnień administratora
- **500 Internal Server Error:** Błędy bazy danych lub przetwarzania

## 8. Rozważania dotyczące wydajności
- **Indeksy:** Wykorzystanie istniejących indeksów na `created_at` w tabelach `flashcards` i `generation_candidates`
- **Cache:** Brak cache'a - dane KPI wymagają aktualności
- **Optymalizacja zapytań:** Użycie CTE (Common Table Expressions) dla złożonych agregacji
- **Timeout:** 30 sekund na wykonanie zapytania
- **Memory:** Efektywne przetwarzanie dużych zbiorów danych przez strumieniowanie wyników

## 9. Etapy wdrożenia

### Etapa 1: Przygotowanie schematów walidacji
1. Utworzyć `src/lib/validation/admin-kpi.schema.ts`
2. Zaimplementować schemat Zod dla parametrów `range`, `group_by`, `from`, `to`
3. Dodać reguły walidacji zakresów dat (maksymalnie 90 dni)

### Etapa 2: Implementacja service
1. Utworzyć `src/lib/services/analytics.service.ts`
2. Zaimplementować funkcję `getKpiMetrics()` przyjmującą parametry filtrowania
3. Dodać funkcję pomocniczą `calculateAiAcceptanceRate()` dla obliczania współczynnika akceptacji
4. Zaimplementować funkcję `aggregateTrendData()` dla danych trendu z odpowiednim grupowaniem
5. Dodać funkcję `calculateTotals()` dla podsumowania całkowitego

### Etapa 3: Implementacja endpointu API
1. Utworzyć `src/pages/api/admin/kpi.ts`
2. Dodać `export const prerender = false`
3. Zaimplementować funkcję `GET()` z obsługą parametrów query
4. Dodać walidację parametrów przy użyciu schematu Zod
5. Sprawdzić uprawnienia administratora przy użyciu `is_admin()`
6. Wywołać `analytics.service.getKpiMetrics()` z parametrami
7. Zmapować wynik na `AnalyticsKpiResponse`
8. Dodać obsługę błędów z odpowiednimi kodami statusu

### Etapa 4: Testowanie i optymalizacja
1. Dodać testy jednostkowe dla `analytics.service.ts`
2. Przetestować endpoint z różnymi parametrami
3. Zweryfikować wydajność zapytań przy dużych zbiorach danych
4. Dodać monitoring błędów i czasów wykonania
5. Przeprowadzić testy obciążeniowe dla różnych zakresów dat

### Etapa 5: Dokumentacja i deployment
1. Zaktualizować dokumentację API w `.ai/api-plan.md`
2. Dodać komentarze JSDoc do wszystkich funkcji
3. Przeprowadzić code review
4. Zaimplementować w środowisku produkcyjnym
