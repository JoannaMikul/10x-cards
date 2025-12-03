# Plan implementacji widoku Generator AI

## 1. Przegląd

Widok Generator AI (/generator) służy do inicjowania i monitorowania procesu generowania fiszek przez AI. Umożliwia użytkownikowi wklejenie tekstu źródłowego, wybór parametrów modelu AI (model i temperatura), walidację wejścia oraz obsługę limitów żądań. Po uruchomieniu zadania, widok wyświetla status postępu i umożliwia anulowanie. Jest to kluczowy element przepływu tworzenia fiszek, integrujący się z backendem Supabase i OpenRouter.ai, zapewniając szybkie i bezpieczne generowanie treści edukacyjnych.

## 2. Routing widoku

Ścieżka: `/generator` – dostępna dla zalogowanych użytkowników. Przekierowanie niezalogowanych do ekranu logowania z zachowaniem docelowego URL. Użyj Astro do routingu, z komponentem React dla interaktywności.

## 3. Struktura komponentów

- **GeneratorPage** (główny widok Astro + React root)
  - **GeneratorForm** (formularz wejścia)
    - **TextAreaWithCounter** (pole tekstowe z licznikiem)
    - **ModelSelector** (wybór modelu)
    - **TemperatureSlider** (suwak temperatury)
    - **SubmitButton** (przycisk startu/anulowania)
  - **GenerationStatusPanel** (panel statusu)
    - **ProgressIndicator** (wskaźnik postępu)
    - **ErrorToast** (komunikaty błędów)
  - **NavigationLinks** (linki do innych widoków, np. do kandydatów)

Hierarchia: GeneratorPage > GeneratorForm i GenerationStatusPanel jako równoległe dzieci; TextAreaWithCounter itp. jako dzieci GeneratorForm.

## 4. Szczegóły komponentów

### GeneratorPage

- **Opis**: Główny kontener widoku, zarządzający routingiem, autentykacją i layoutem. Integruje formularz i panel statusu, obsługuje globalny stan ładowania i błędy.
- **Główne elementy**: `<main>` z layoutem, `<GeneratorForm />`, `<GenerationStatusPanel />`, `<NavigationLinks />` (link do /candidates po sukcesie).
- **Obsługiwane zdarzenia**: onSubmit (uruchomienie generowania), onCancel (anulowanie), onStatusUpdate (polling statusu).
- **Warunki walidacji**: Sprawdzenie autentykacji; walidacja długości tekstu (1000-10000 po sanitacji); limit aktywnych żądań (1 na użytkownika).
- **Typy**: CreateGenerationCommand, GenerationDTO, ApiErrorResponse<'generation_error_code'>.
- **Propsy**: { user: User | null, initialText?: string } – użytkownik z sesji, opcjonalny początkowy tekst.

### GeneratorForm

- **Opis**: Formularz do wprowadzania danych wejściowych, z walidacją i sanitacją. Składa się z pól wejściowych i przycisków akcji.
- **Główne elementy**: `<form>`, `<TextAreaWithCounter />`, `<ModelSelector />`, `<TemperatureSlider />`, `<SubmitButton />`.
- **Obsługiwane zdarzenia**: onChange (aktualizacja tekstu), onModelChange, onTemperatureChange, onSubmit (walidacja i API call).
- **Warunki walidacji**: Długość tekstu 1000-10000 (debounce licznika); model wymagany; temperatura w [0,2]; sanitacja tekstu przed wysyłką (usunięcie niebezpiecznych znaków).
- **Typy**: CreateGenerationViewModel (rozszerzenie CreateGenerationCommand o lokalne pola jak rawInputText).
- **Propsy**: { onSubmit: (data: CreateGenerationCommand) => void, isLoading: boolean, currentStatus?: GenerationStatus }.

### TextAreaWithCounter

- **Opis**: Pole tekstowe z licznikiem znaków i walidacją długości. Obsługuje debounce dla wydajności.
- **Główne elementy**: `<textarea>`, `<span>` (licznik), `<div>` (komunikat błędu jeśli poza zakresem).
- **Obsługiwane zdarzenia**: onChange (aktualizacja tekstu i licznika).
- **Warunki walidacji**: Min 1000, max 10000; kolorowanie licznika (zielony/żółty/czerwony).
- **Typy**: { value: string, maxLength: number, minLength: number }.
- **Propsy**: { value: string, onChange: (value: string) => void, minLength: number, maxLength: number }.

### ModelSelector

- **Opis**: Dropdown do wyboru modelu AI (np. gpt-4o-mini).
- **Główne elementy**: `<select>` lub Shadcn Select.
- **Obsługiwane zdarzenia**: onChange (wybór modelu).
- **Warunki walidacji**: Wymagany wybór (domyślny model).
- **Typy**: { model: string, availableModels: string[] }.
- **Propsy**: { value: string, onChange: (model: string) => void, options: Array<{label: string, value: string}> }.

### TemperatureSlider

- **Opis**: Suwak do ustawiania temperatury (kreatywności modelu).
- **Główne elementy**: Shadcn Slider, etykiety (0 - niska, 2 - wysoka).
- **Obsługiwane zdarzenia**: onChange (aktualizacja wartości).
- **Warunki walidacji**: Wartość w [0,2], zaokrąglona do 2 miejsc dziesiętnych.
- **Typy**: { temperature: number }.
- **Propsy**: { value: number, onChange: (value: number) => void, min: 0, max: 2, step: 0.1 }.

### SubmitButton

- **Opis**: Przycisk do startu lub anulowania generowania, z blokadą podczas ładowania.
- **Główne elementy**: Shadcn Button, ikona ładowania.
- **Obsługiwane zdarzenia**: onClick (wywołanie submit lub cancel).
- **Warunki walidacji**: Wyłączony jeśli formularz niepoprawny lub zadanie aktywne.
- **Typy**: { isLoading: boolean, isActive: boolean }.
- **Propsy**: { onClick: () => void, disabled: boolean, label: string, variant: 'default' | 'destructive' }.

### GenerationStatusPanel

- **Opis**: Panel wyświetlający status zadania, z pollingiem i komunikatami.
- **Główne elementy**: `<div>` z statusem, `<ProgressIndicator />`, `<ErrorToast />`.
- **Obsługiwane zdarzenia**: onPoll (odświeżanie statusu), onCancel.
- **Warunki walidacji**: Brak; zależy od API.
- **Typy**: GenerationDTO, CandidatesSummary.
- **Propsy**: { generation: GenerationDTO | null, onCancel: () => void, onNavigateToCandidates: () => void }.

### ProgressIndicator

- **Opis**: Wskaźnik postępu generowania (pending, running, completed).
- **Główne elementy**: Shadcn Progress lub spinner.
- **Obsługiwane zdarzenia**: Brak.
- **Warunki walidacji**: Brak.
- **Typy**: { status: GenerationStatus }.
- **Propsy**: { status: string, progress?: number }.

### ErrorToast

- **Opis**: Komponent do wyświetlania błędów (np. limit przekroczony).
- **Główne elementy**: Shadcn Sonnar.
- **Obsługiwane zdarzenia**: onDismiss.
- **Warunki walidacji**: Brak.
- **Typy**: ApiErrorResponse.
- **Propsy**: { error: ApiErrorResponse | null, onDismiss: () => void }.

## 5. Typy

- **CreateGenerationViewModel**: Rozszerzenie CreateGenerationCommand dla frontendu.
  - model: string (wymagany, np. 'openrouter/gpt-4o-mini')
  - sanitized_input_text: string (po sanitacji, 1000-10000 znaków)
  - temperature?: number (0-2, opcjonalny, domyślnie 0.7)
  - raw_input_text?: string (lokalne, przed sanitacją)

- **GenerationStatus**: 'pending' | 'running' | 'completed' | 'cancelled' | 'error'

- **CandidatesSummary**: { total: number, by_status: Record<GenerationCandidateStatus, number> }

- **FormValidationState**: { isValid: boolean, errors: string[], warnings: string[] }

- **ApiErrorResponse<GenerationErrorCode>**: Jak w types.ts, z kodem błędu (np. 'active_request_exists', 'hourly_quota_reached').

Nowe typy: CreateGenerationViewModel (dla lokalnego stanu formularza), GenerationPollingState { id?: string, status: GenerationStatus, error?: ApiErrorResponse }.

## 6. Zarządzanie stanem

Użyj React Context lub Zustand dla globalnego stanu (użytkownik, sesja). Lokalnie w GeneratorPage: useState dla formularza (tekst, model, temperatura), stanu ładowania (isSubmitting, isPolling), błędu (errorMessage). Custom hook: useGeneration (zarządza pollingiem GET /api/generations/:id co 5s, anulowaniem PATCH, nawigacją do /candidates po sukcesie). useForm z React Hook Form dla walidacji formularza, z Zod resolverem opartym na createGenerationSchema.

## 7. Integracja API

- **POST /api/generations**: Żądanie z CreateGenerationCommand (po sanitacji tekstu). Odpowiedź: 202 { id, status: 'pending', enqueued_at }. Błąd: 400/409/429/500 z ApiErrorResponse.

- **GET /api/generations/:id**: Polling dla statusu. Odpowiedź: 200 { generation: GenerationDTO, candidates_summary: CandidatesSummary }.

- **PATCH /api/generations/:id**: { status: 'cancelled' } dla anulowania. Odpowiedź: 200 { generation: Partial<GenerationDTO> }.

Użyj fetch z headers (Content-Type: application/json, Authorization jeśli auth). Sanitacja: usuń HTML tags, normalizuj whitespace (użyj DOMPurify lub custom fn).

## 8. Interakcje użytkownika

- Wklejenie tekstu: onPaste/onChange aktualizuje licznik, waliduje długość (kolorowanie, komunikat).

- Wybór modelu/temperatury: Natychmiastowa aktualizacja stanu, walidacja.

- Kliknięcie "Start": Walidacja, sanitacja, POST API; przejście do stanu ładowania, polling.

- Anulowanie: PATCH API, reset formularza.

- Status completed: Link do /candidates z tostem sukcesu.

- Błąd limitu (429): Toast z czasem do resetu (oblicz z API lub stały 1h).

Dostępność: aria-labels, focus management, keyboard navigation.

## 9. Warunki i walidacja

- Frontend: Długość tekstu (1000-10000 po sanitacji – symuluj sanitację); model wymagany; temperatura [0,2]. Użyj Zod w useForm. Błędy: disabled submit, czerwone pola, komunikaty.

- Backend: Potwierdź po API (np. length_out_of_range). Dla limitów (active_request_exists, hourly_quota_reached): toast z message, blokada submitu.

- Wpływ: Nieprawidłowy stan blokuje submit, pokazuje błędy inline/toast; po sukcesie – redirect lub update UI.

## 10. Obsługa błędów

- 400 Invalid Payload: Toast z błędem walidacji, highlight błędnych pól.

- 409 Active Exists: Toast "Aktywne zadanie istnieje", disable submit.

- 429 Quota: Toast "Przekroczono limit (5/h), poczekaj X min", timer countdown.

- 500 Unexpected: Toast "Błąd serwera, spróbuj później", log do console.

- Network Error: Retry button w toaście, fallback do offline message.

Użyj try-catch w hookach, global ErrorBoundary dla crashy.

## 11. Kroki implementacji

1. Utwórz stronę Astro: src/pages/generator.astro z importem React komponentu GeneratorPage.

2. Zdefiniuj typy w src/types.ts (dodaj ViewModel jeśli potrzeba) lub lokalnie.

3. Zaimplementuj custom hook useGeneration z pollingiem (useInterval lub useEffect).

4. Stwórz GeneratorForm z React Hook Form + Zod schema (dopasuj do createGenerationSchema). Wymagana jest kompatybilność React Hook Forma z Shadcn. Użycie Controllera z RHF i Field z Shadcn.

5. Dodaj subkomponenty: TextAreaWithCounter (useDebounce), ModelSelector (stała lista modeli), TemperatureSlider (Shadcn).

6. Zaimplementuj GenerationStatusPanel z Progress i Sonner (Toast).

7. Dodaj sanitację tekstu z użyciem biblioteki sanitize-html.

8. Integruj API calls w hooku, obsługa auth (Supabase session).

9. Styluj z Tailwind/Shadcn, zapewnij responsywność.

10. Finalny code review i refaktoryzacja przed wdrożeniem.
