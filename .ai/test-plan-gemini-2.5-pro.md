# Kompleksowy Plan Testów dla Projektu "10x-cards"

## 1. Wprowadzenie i cele testowania

### 1.1. Wprowadzenie

Niniejszy dokument przedstawia kompleksowy plan testów dla aplikacji internetowej "10x-cards" w jej fazie rozwoju Minimum Viable Product (MVP). Plan ten ma na celu usystematyzowanie procesu weryfikacji jakości oprogramowania, zapewnienie zgodności z wymaganiami funkcjonalnymi i niefunkcjonalnymi oraz identyfikację i eliminację defektów przed wdrożeniem produkcyjnym.

### 1.2. Cele testowania

Głównymi celami procesu testowania są:

- **Weryfikacja funkcjonalności**: Potwierdzenie, że wszystkie funkcje zdefiniowane w zakresie MVP działają zgodnie ze specyfikacją.
- **Zapewnienie jakości i niezawodności**: Identyfikacja i naprawa błędów w celu zapewnienia stabilnego i przewidywalnego działania aplikacji.
- **Ocena użyteczności**: Sprawdzenie, czy interfejs użytkownika jest intuicyjny i przyjazny dla docelowej grupy odbiorców (profesjonalistów IT).
- **Weryfikacja bezpieczeństwa**: Upewnienie się, że dane użytkowników są odpowiednio chronione i odizolowane.
- **Sprawdzenie integracji**: Potwierdzenie poprawnej komunikacji pomiędzy frontendem, backendem (Supabase) i usługami zewnętrznymi (OpenRouter).

## 2. Zakres testów

### 2.1. Funkcjonalności objęte testami (In-Scope)

Testowaniu podlegają wszystkie funkcjonalności zdefiniowane w `Project scope` dla MVP:

- **Rejestracja i uwierzytelnianie użytkowników**: Pełen cykl życia konta (rejestracja, logowanie, wylogowanie, reset hasła).
- **Automatyczne generowanie fiszek (AI)**: Proces od wklejenia tekstu, przez konfigurację, aż po otrzymanie propozycji fiszek.
- **Przegląd i zarządzanie kandydatami na fiszki**: Edycja, akceptacja i odrzucanie propozycji wygenerowanych przez AI.
- **Ręczne tworzenie i edycja fiszek**: Formularz do manualnego dodawania i modyfikacji fiszek.
- **Przeglądanie i organizacja fiszek**: Wyszukiwanie, filtrowanie (po kategoriach, tagach, źródłach, pochodzeniu) i sortowanie kolekcji fiszek.
- **System Spaced Repetition**: Weryfikacja logiki planowania kolejnych powtórek (na podstawie metadanych fiszki).
- **Dashboard analityczny**: Wyświetlanie podstawowych wskaźników KPI.
- **Obsługa błędów i walidacja**: Poprawna walidacja danych wejściowych i komunikacja błędów użytkownikowi.

### 2.2. Funkcjonalności wyłączone z testów (Out-of-Scope)

Zgodnie z dokumentacją, następujące elementy są wyłączone z testów dla wersji MVP:

- Niestandardowy algorytm spaced repetition (testowany jest tylko efekt jego działania, nie sam algorytm).
- Import plików innych niż czysty tekst.
- Udostępnianie zestawów fiszek między użytkownikami.
- Integracje z zewnętrznymi platformami edukacyjnymi.
- Aplikacje mobilne.
- Timery i limity czasowe w procesie nauki.

## 3. Typy testów do przeprowadzenia

W celu zapewnienia kompleksowego pokrycia, zostaną przeprowadzone następujące rodzaje testów:

- **Testy jednostkowe (Unit Tests)**:
  - **Cel**: Weryfikacja poprawności działania pojedynczych funkcji, komponentów React i hooków w izolacji.
  - **Przykłady**: Testowanie logiki walidacji `zod`, funkcji pomocniczych w `src/lib/utils`, renderowania komponentów UI w zależności od `props`, logiki customowych hooków (np. `useCandidates` z zamockowanym `fetch`).

- **Testy integracyjne (Integration Tests)**:
  - **Cel**: Sprawdzenie współpracy pomiędzy różnymi częściami systemu.
  - **Przykłady**: Testowanie endpointów API Astro (wysłanie żądania i weryfikacja odpowiedzi z zamockowaną bazą danych), testowanie interakcji między komponentami na jednej stronie (np. formularz filtra i lista fiszek), weryfikacja przepływu danych między frontendem a backendem.

- **Testy End-to-End (E2E Tests)**:
  - **Cel**: Symulacja rzeczywistych scenariuszy użytkowania aplikacji z perspektywy użytkownika końcowego w przeglądarce.
  - **Przykłady**: Pełny scenariusz od rejestracji, przez wygenerowanie fiszek, ich akceptację, aż po naukę; testowanie polityk RLS poprzez próbę dostępu do zasobów innego użytkownika.

- **Testy dymne (Smoke Tests)**:
  - **Cel**: Szybka weryfikacja, czy najważniejsze funkcjonalności działają po każdej nowej implementacji (buildzie).
  - **Przykłady**: Sprawdzenie, czy strona główna się ładuje, czy można się zalogować i wylogować.

- **Testy regresji (Regression Tests)**:
  - **Cel**: Upewnienie się, że nowe zmiany nie zepsuły istniejących, działających funkcjonalności.
  - **Automatyzacja**: Zestaw testów E2E i integracyjnych uruchamiany automatycznie w ramach procesu CI/CD.

- **Testy manualne eksploracyjne**:
  - **Cel**: Nieskryptowane testowanie aplikacji w celu znalezienia błędów, które mogły zostać pominięte w testach automatycznych. Skupienie na użyteczności i nietypowych przypadkach użycia.

## 4. Scenariusze testowe dla kluczowych funkcjonalności

Poniżej przedstawiono wysokopoziomowe scenariusze testowe. Każdy scenariusz powinien zostać rozwinięty w szczegółowe przypadki testowe.

| ID           | Funkcjonalność          | Scenariusz                                                                                             | Oczekiwany rezultat                                                                                                        | Priorytet |
| :----------- | :---------------------- | :----------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :-------- |
| **AUTH-01**  | Uwierzytelnianie        | Użytkownik poprawnie rejestruje nowe konto, wylogowuje się i loguje ponownie.                          | Rejestracja, wylogowanie i logowanie kończą się sukcesem. Użytkownik ma dostęp do chronionych zasobów po zalogowaniu.      | Krytyczny |
| **AUTH-02**  | Uwierzytelnianie        | Użytkownik próbuje zalogować się z nieprawidłowym hasłem.                                              | Wyświetlony zostaje komunikat o błędnych danych logowania.                                                                 | Wysoki    |
| **AUTH-03**  | Bezpieczeństwo          | Zalogowany Użytkownik A próbuje uzyskać dostęp do fiszek Użytkownika B poprzez bezpośredni URL do API. | Żądanie zostaje odrzucone z powodu braku uprawnień (błąd 403/404).                                                         | Krytyczny |
| **GEN-01**   | Generator AI            | Użytkownik wkleja poprawny tekst (> min. długość), wybiera model i klika "Start generation".           | Zadanie generowania zostaje utworzone. Panel statusu pokazuje postęp, a po zakończeniu przekierowuje do widoku kandydatów. | Krytyczny |
| **GEN-02**   | Generator AI            | Użytkownik próbuje wygenerować fiszki z tekstu o zbyt małej lub zbyt dużej długości.                   | Formularz wyświetla błąd walidacji, a przycisk generowania jest nieaktywny.                                                | Wysoki    |
| **GEN-03**   | Generator AI            | Użytkownik przekracza limit 5 generacji na godzinę.                                                    | API zwraca błąd o przekroczonym limicie, a UI wyświetla stosowny komunikat.                                                | Wysoki    |
| **CAND-01**  | Zarządzanie kandydatami | Użytkownik akceptuje wygenerowanego kandydata.                                                         | Kandydat zmienia status na "accepted", a w kolekcji fiszek pojawia się nowa fiszka z odpowiednimi danymi.                  | Krytyczny |
| **CAND-02**  | Zarządzanie kandydatami | Użytkownik edytuje treść kandydata przed jego akceptacją.                                              | Zmiany są zapisywane, a status kandydata zmienia się na "edited". Zaakceptowana fiszka zawiera zmienioną treść.            | Wysoki    |
| **CARD-01**  | Zarządzanie fiszkami    | Użytkownik manualnie tworzy nową fiszkę, dodając jej tagi i kategorię.                                 | Fiszka zostaje poprawnie zapisana w bazie danych i pojawia się na liście.                                                  | Krytyczny |
| **CARD-02**  | Zarządzanie fiszkami    | Użytkownik używa filtrów (np. po tagu i kategorii) oraz wyszukiwarki.                                  | Lista fiszek jest poprawnie aktualizowana, aby odzwierciedlić aktywne filtry i zapytanie. Parametry są widoczne w URL.     | Wysoki    |
| **CARD-03**  | Zarządzanie fiszkami    | Użytkownik usuwa fiszkę (soft-delete), a następnie ją przywraca.                                       | Fiszka znika z domyślnego widoku, pojawia się w widoku "usuniętych", a po przywróceniu wraca do kolekcji.                  | Wysoki    |
| **S-REP-01** | Spaced Repetition       | Użytkownik przeprowadza sesję nauki.                                                                   | Data następnej powtórki (`next_review_at`) dla fiszek, które pojawiły się w sesji, jest poprawnie zaktualizowana.          | Wysoki    |

## 5. Środowisko testowe

- **Środowisko lokalne**: Do developmentu i uruchamiania testów jednostkowych/integracyjnych. Wymagania zgodne z sekcją `Getting started locally` w `README.md` (Node.js 22.17.0, npm, skonfigurowane zmienne środowiskowe).
- **Środowisko CI (Continuous Integration)**: GitHub Actions. Testy będą uruchamiane automatycznie na każdym pushu do gałęzi `main` i na Pull Requestach. Środowisko to będzie korzystać z osobnej, testowej instancji Supabase.
- **Środowisko Staging**: Osobna, w pełni skonfigurowana instancja aplikacji na DigitalOcean, odzwierciedlająca środowisko produkcyjne. Będzie używana do testów E2E i testów manualnych przed wdrożeniem. Będzie korzystać z dedykowanego klucza API do OpenRouter z niskim budżetem.
- **Przeglądarki**: Testy będą przeprowadzane na najnowszych wersjach przeglądarek: Google Chrome, Mozilla Firefox. Dodatkowo, testy responsywności będą obejmować symulację widoków mobilnych.

## 6. Narzędzia do testowania

- **Test Runner (jednostkowe, integracyjne)**: **Vitest** - oba są popularne w ekosystemie React/Vite i dobrze współpracują z TypeScript.
- **Biblioteka do testowania komponentów**: **React Testing Library** - do testowania komponentów React w sposób, w jaki używałby ich użytkownik.
- **Framework do testów E2E**: **Playwright** - oba narzędzia oferują potężne możliwości do automatyzacji testów w przeglądarce. Playwright jest preferowany ze względu na szybkość i wsparcie dla wielu przeglądarek.
- **Mockowanie API**: **Mock Service Worker (MSW)** lub wbudowane mechanizmy mockowania w Vitest/Jest do symulowania odpowiedzi z API i usług zewnętrznych (Supabase, OpenRouter).
- **CI/CD**: **GitHub Actions** - do automatyzacji uruchamiania testów.

## 7. Harmonogram testów

Proces testowania będzie prowadzony równolegle z procesem deweloperskim, zgodnie z metodyką Agile.

- **Testy jednostkowe**: Pisane przez deweloperów w trakcie tworzenia nowych funkcjonalności.
- **Testy integracyjne**: Pisane po zintegrowaniu kilku komponentów lub stworzeniu nowego endpointu API.
- **Testy E2E**: Tworzone i aktualizowane po zakończeniu prac nad większymi funkcjonalnościami (np. cały moduł logowania).
- **Testy regresji**: Uruchamiane automatycznie przed każdym mergem do gałęzi `main`.
- **Testy manualne**: Przeprowadzane przed każdym wydaniem nowej wersji na środowisku Staging.

## 8. Kryteria akceptacji testów

### 8.1. Kryteria wejścia

- Kod źródłowy został wdrożony na odpowiednim środowisku testowym.
- Wszystkie testy jednostkowe i integracyjne dla danej funkcjonalności przechodzą pomyślnie.
- Dokumentacja techniczna i wymagania są dostępne dla zespołu testerskiego.

### 8.2. Kryteria wyjścia

- **100%** zdefiniowanych testów dymnych musi zakończyć się sukcesem.
- **95%** wszystkich zautomatyzowanych testów (jednostkowych, integracyjnych, E2E) musi zakończyć się sukcesem.
- Brak otwartych błędów o priorytecie **Krytycznym**.
- Nie więcej niż 3 otwarte błędy o priorytecie **Wysokim**.
- Pokrycie kodu testami jednostkowymi na poziomie co najmniej **70%**.

## 9. Role i odpowiedzialności w procesie testowania

- **Deweloperzy**:
  - Odpowiedzialni za pisanie testów jednostkowych i integracyjnych.
  - Naprawianie błędów zgłoszonych przez zespół QA.
  - Utrzymywanie i konfiguracja środowiska CI.
- **Inżynier QA / Tester**:
  - Projektowanie i implementacja testów E2E.
  - Przeprowadzanie testów manualnych i eksploracyjnych.
  - Zarządzanie procesem zgłaszania i śledzenia błędów.
  - Tworzenie i utrzymywanie niniejszego planu testów.
  - Ostateczna akceptacja jakości produktu przed wdrożeniem.
- **Product Owner / Manager Projektu**:
  - Dostarczanie wymagań i kryteriów akceptacji.
  - Priorytetyzacja naprawy błędów.

## 10. Procedury raportowania błędów

Wszystkie znalezione defekty będą raportowane i śledzone przy użyciu narzędzia do zarządzania projektami (np. GitHub Issues, Jira).

Każdy raport o błędzie musi zawierać następujące informacje:

- **Tytuł**: Zwięzły i jednoznaczny opis problemu.
- **Środowisko**: Wersja aplikacji, przeglądarka, system operacyjny.
- **Kroki do odtworzenia**: Szczegółowa, ponumerowana lista kroków prowadzących do wystąpienia błędu.
- **Obserwowany rezultat**: Co faktycznie się stało.
- **Oczekiwany rezultat**: Co powinno się stać zgodnie ze specyfikacją.
- **Priorytet/Waga**: (Krytyczny, Wysoki, Średni, Niski)
- **Załączniki**: Zrzuty ekranu, nagrania wideo, logi z konsoli.

Błędy będą przypisywane do odpowiednich deweloperów, a ich status będzie aktualizowany w miarę postępu prac (Nowy -> W trakcie -> Do weryfikacji -> Zamknięty/Odrzucony).
