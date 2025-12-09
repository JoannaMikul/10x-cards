# Plan implementacji widoku Kandydaci (z AI)

## 1. Przegląd

Widok Kandydaci (z AI) służy do przeglądu, edycji i podejmowania decyzji dotyczących propozycji fiszek wygenerowanych przez AI. Umożliwia użytkownikowi akceptację, odrzucenie lub edycję każdej fiszki, zapewniając kontrolę nad jakością materiału. Widok integruje się z endpointem API do pobierania listy kandydatów, ich aktualizacji oraz akcji akceptacji i odrzucenia, z walidacją limitów znaków (pytanie: 200, odpowiedź: 500) i blokadą duplikatów.

## 2. Routing widoku

Ścieżka widoku: `/candidates`. Widok powinien być dostępny pod tym adresem URL w aplikacji Astro, z przekierowaniem niezalogowanych użytkowników do logowania (zgodnie z US-000 i US-001).

## 3. Struktura komponentów

Hierarchia komponentów:

- `CandidatesPage` (główny komponent widoku, Astro + React)
  - `CandidateList` (lista kandydatów z paginacją)
    - `CandidateItem` (pojedynczy kandydat)
      - `CandidateEditor` (edytor front/back)
      - `AcceptRejectBar` (pasek akcji akceptuj/odrzuć)
  - `Toasts` (komponent do wyświetlania powiadomień, z Shadcn/ui - Sonner)
  - `FormError` (komponent do błędów walidacji)

## 4. Szczegóły komponentów

### CandidatesPage

- **Opis komponentu**: Główny kontener widoku, zarządza stanem listy kandydatów, paginacją i integracją API. Składa się z nagłówka, listy kandydatów oraz komponentów do obsługi błędów i powiadomień.
- **Główne elementy**: `<div>` z nagłówkiem (h1 "Kandydaci z AI"), `<CandidateList>`, `<Toasts>`, `<FormError>`.
- **Obsługiwane interakcje**: Ładowanie listy po załadowaniu komponentu, obsługa paginacji (kliknięcie "Następna strona"), odświeżanie po akcjach.
- **Obsługiwana walidacja**: Brak bezpośredniej; deleguje do dzieci.
- **Typy**: `GenerationCandidateListResponse`, `GenerationPollingState`.
- **Propsy**: Brak (główny komponent); przyjmuje `generationId` z URL params jeśli potrzebne.

### CandidateList

- **Opis komponentu**: Wyświetla paginowaną listę kandydatów w formie tabeli lub kafelków, obsługuje ładowanie i paginację.
- **Główne elementy**: `<Table>` (Shadcn) z iteracją po `data` z API, przycisk "Następna" jeśli `has_more`, komponent ładowania (Shadcn Progress).
- **Obsługiwane interakcje**: Kliknięcie paginacji, filtrowanie po statusie (opcjonalne z query params).
- **Obsługiwana walidacja**: Walidacja cursor z API.
- **Typy**: `PaginatedResponse<GenerationCandidateDTO>`.
- **Propsy**: `candidates: GenerationCandidateListResponse`, `onPageChange: (cursor: string | null) => void`, `loading: boolean`.

### CandidateItem

- **Opis komponentu**: Przedstawia pojedynczego kandydata z front/back, metadanymi (sugerowane kategorie/tag'i), statusem i akcjami.
- **Główne elementy**: `<Card>` (Shadcn), `<p>` dla front/back, `<Badge>` (Shadcn) dla statusu, `<CandidateEditor>` (ukryty domyślnie), `<AcceptRejectBar>`.
- **Obsługiwane interakcje**: Kliknięcie "Edytuj" (pokazuje edytor), zapis po edycji.
- **Obsługiwana walidacja**: Limity znaków w edytorze (200/500).
- **Typy**: `GenerationCandidateDTO`.
- **Propsy**: `candidate: GenerationCandidateDTO`, `onEdit: (id: string, changes: UpdateGenerationCandidateCommand) => void`, `onAccept: (id: string, command: AcceptGenerationCandidateCommand) => void`, `onReject: (id: string) => void`.

### CandidateEditor

- **Opis komponentu**: Formularz edycji front/back z walidacją, sugerowanymi metadanymi.
- **Główne elementy**: `<Textarea>` (Shadcn) dla front/back z licznikami, `<Select>` dla kategorii/tagów, przycisk "Zapisz".
- **Obsługiwane interakcje**: Wpisanie tekstu, zmiana metadanych, submit.
- **Obsługiwana walidacja**: Długość front <=200, back <=500; blokada pustych pól.
- **Typy**: `UpdateGenerationCandidateCommand`, `AcceptGenerationCandidateCommand`.
- **Propsy**: `candidate: GenerationCandidateDTO`, `onSave: (changes: UpdateGenerationCandidateCommand) => void`, `onCancel: () => void`, `errors: string[]`.

### AcceptRejectBar

- **Opis komponentu**: Pasek z przyciskami akceptuj/odrzuć, z potwierdzeniem dla odrzucenia.
- **Główne elementy**: `<Button>` (Shadcn) dla Accept/Reject, dialog potwierdzenia (opcjonalny).
- **Obsługiwane interakcje**: Kliknięcie Accept (wywołuje API), Reject (z potwierdzeniem).
- **Obsługiwana walidacja**: Sprawdzenie statusu (tylko proposed/edited).
- **Typy**: `AcceptGenerationCandidateCommand`, `RejectGenerationCandidateCommand`.
- **Propsy**: `candidateId: string`, `onAccept: (command?: AcceptGenerationCandidateCommand) => void`, `onReject: () => void`, `disabled: boolean`.

### Toasts

- **Opis komponentu**: Komponent do wyświetlania powiadomień o sukcesach/błędach (zintegrowany z Shadcn Sonner).
- **Główne elementy**: `<Sonner>` z toastami.
- **Obsługiwane interakcje**: Automatyczne po akcjach API.
- **Obsługiwana walidacja**: Brak.
- **Typy**: Brak specyficznych.
- **Propsy**: `toasts: Toast[]` (z hooka), lub globalny.

### FormError

- **Opis komponentu**: Wyświetla błędy walidacji lub API.
- **Główne elementy**: `<Alert>` (Shadcn) z listą błędów.
- **Obsługiwane interakcje**: Brak; statyczny.
- **Obsługiwana walidacja**: Wyświetla błędy z API lub lokalne.
- **Typy**: `ApiErrorResponse`.
- **Propsy**: `errors: string[]`, `visible: boolean`.

## 5. Typy

Wykorzystaj istniejące typy z `src/types.ts`:

- `GenerationCandidateDTO`: Zawiera `id`, `generation_id`, `owner_id`, `front`, `back`, `front_back_fingerprint`, `status`, `accepted_card_id`, `suggested_category_id`, `suggested_tags`, `created_at`, `updated_at`.
- `GenerationCandidateListResponse`: `PaginatedResponse<GenerationCandidateDTO>` z `data`, `page: { next_cursor: string | null, has_more: boolean }`.
- `UpdateGenerationCandidateCommand`: `front?: string`, `back?: string`, `status?: 'edited'`.
- `AcceptGenerationCandidateCommand`: `category_id?: number`, `tag_ids?: number[]`, `content_source_id?: number`, `origin?: Enums<'card_origin'>`.
- `RejectGenerationCandidateCommand`: Pusty obiekt `{}`.

Nowe typy ViewModel:

- `CandidateEditState`: `{ isEditing: boolean, tempFront: string, tempBack: string, errors: string[], categoryId?: number, tagIds?: number[] }` – stan edytora dla pojedynczego kandydata, z tymczasowymi wartościami i błędami walidacji.
- `CandidatesViewState`: `{ candidates: GenerationCandidateDTO[], loading: boolean, error?: ApiErrorResponse, nextCursor: string | null, hasMore: boolean, filters: { status?: string[] } }` – globalny stan widoku, integrujący listę, ładowanie i paginację.

## 6. Zarządzanie stanem

Stan zarządzany za pomocą React hooks w `CandidatesPage`:

- `useState<CandidatesViewState>` dla listy kandydatów, ładowania, błędów, paginacji.
- `useState<CandidateEditState | null>` dla aktywnego edytora (tylko jeden na raz).
- Custom hook `useCandidates` (w `src/components/hooks/useCandidates.ts`): Zarządza fetch listy (GET /api/generation-candidates z generation_id z URL), paginacją (obsługa cursor), mutacjami (PATCH, POST accept/reject). Używa `useSWR` lub `useEffect` + `useCallback` dla optymalizacji. Cel: Enkapsulacja logiki API, automatyczne odświeżanie po mutacjach.

## 7. Integracja API

Integracja z endpointem `/api/generation-candidates` używając fetch lub Supabase client:

- **GET /api/generation-candidates?generation_id=UUID&limit=20&cursor=...&status[]=proposed**: Żądanie zwraca `GenerationCandidateListResponse`. Obsługa query params dla filtrów statusu.
- **PATCH /api/generation-candidates/:id**: Body `UpdateGenerationCandidateCommand`, odpowiedź `200 { candidate: GenerationCandidateDTO }`.
- **POST /api/generation-candidates/:id/accept**: Body `AcceptGenerationCandidateCommand` (opcjonalny), odpowiedź `201 FlashcardDTO`.
- **POST /api/generation-candidates/:id/reject**: Body `{}` (pusty), odpowiedź `200 { candidate: GenerationCandidateDTO }`.
  Użyj `FormData` lub JSON.stringify dla body, headers `Content-Type: application/json`. Obsługa błędów z `ApiErrorResponse` (kody: invalid_query, not_found, duplicate_candidate itp.).

## 8. Interakcje użytkownika

- **Przegląd listy**: Automatyczne ładowanie po mount, paginacja przyciskiem "Następna" (jeśli `has_more`).
- **Edycja kandydata**: Kliknięcie "Edytuj" pokazuje `CandidateEditor`, edycja front/back z licznikami, wybór metadanych; "Zapisz" wysyła PATCH, ukrywa edytor i odświeża listę.
- **Akceptacja**: Kliknięcie "Akceptuj" w `AcceptRejectBar` (opcjonalnie z potwierdzeniem), wysyła POST /accept z metadanymi, usuwa z listy lub zmienia status, toast sukcesu.
- **Odrzucenie**: Kliknięcie "Odrzuć" z dialogiem potwierdzenia, wysyła POST /reject, usuwa z listy lub zmienia status, toast potwierdzenia.
- **Skróty klawiaturowe**: Enter na edytorze zapisuje, Esc anuluje; A/Accept, R/Reject (opcjonalne dla dostępności).
- **Powiadomienia**: Toast sukces/błąd po każdej akcji API.

## 9. Warunki i walidacja

- **Walidacja frontendowa**: W `CandidateEditor` – `front.length <= 200 && front.trim().length > 0`, `back.length <= 500 && back.trim().length > 0`; błędy wyświetlają w `FormError`. Blokada submit jeśli niepoprawne.
- **Walidacja API**: Endpoint sprawdza limity, duplikaty (fingerprint), status (tylko proposed/edited). Komponenty reagują: disable przycisków jeśli status accepted/rejected, toast z błędem (np. 409 duplicate_candidate blokuje zapis).
- **Wpływ na UI**: Błędy lokalne (walidacja) blokują submit; błędy API (4xx/5xx) pokazują toast i zachowują stan. Paginacja waliduje cursor (jeśli invalid, reset do pierwszej strony).

## 10. Obsługiwana błędów

- **Błędy API**: `ApiErrorResponse` – mapuj kody do komunikatów (np. 'not_found' → "Kandydat nie istnieje", 'duplicate_candidate' → "Fiszka już istnieje"). Wyświetl w `Toasts` (error variant) lub `FormError`.
- **Przypadki brzegowe**: Brak kandydatów – pusty stan z komunikatem "Brak propozycji"; błąd ładowania – retry button; sieć offline – fallback do cache (jeśli useSWR); limit znaków przekroczony – highlight pola + licznik na czerwono.
- **Dostępność**: `aria-live` dla toastów, focus management po edycjach, keyboard navigation.
- **Logowanie**: Console.error dla nieobsłużonych błędów, bez ujawniania szczegółów użytkownikowi.

## 11. Kroki implementacji

1. Utwórz stronę Astro w `src/pages/candidates.astro`: Importuj `CandidatesPage` jako client component (React), dodaj middleware check autoryzacji.
2. Zaimplementuj `CandidatesPage` w `src/components/CandidatesPage.tsx`: Ustaw useState dla stanu, użyj useEffect do initial fetch z generation_id (z URLSearchParams jeśli potrzebne).
3. Stwórz custom hook `useCandidates` w `src/components/hooks/useCandidates.ts`: Logika fetch (GET), mutacje (PATCH/POST), z useCallback i useSWR dla cache.
4. Zaimplementuj `CandidateList` i `CandidateItem` w `src/components/CandidateList.tsx`: Iteracja po danych, obsługa paginacji.
5. Dodaj `CandidateEditor` w `src/components/CandidateEditor.tsx`: Textarea z walidacją (useState dla temp values, onBlur walidacja).
6. Zaimplementuj `AcceptRejectBar` w `src/components/AcceptRejectBar.tsx`: Buttony z confirm dialog (Shadcn Dialog).
7. Integruj `Toasts` i `FormError` z Shadcn/ui: Użyj Sonner dla toastów, Alert dla błędów.
8. Dodaj typy w `src/types.ts` jeśli nowe (CandidateEditState, CandidatesViewState).
9. Styluj z Tailwind: Responsive grid dla listy, card shadows, loading spinners.
10. Optymalizuj: Virtualizacja listy jeśli >50 items (react-window), debounce edytora.
