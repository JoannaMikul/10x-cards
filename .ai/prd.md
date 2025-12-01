# Dokument wymagań produktu (PRD) - 10x-cards

## 1. Przegląd produktu

Produkt 10x-cards ma przyspieszyć przygotowywanie wysokiej jakości fiszek powtórkowych dla profesjonalistów IT uczących się technologii i języków obcych. Aplikacja webowa udostępnia dwa główne sposoby tworzenia fiszek: generowanie przez AI na podstawie wklejonego tekstu oraz ręczne dodawanie pojedynczych kart. Wygenerowane fiszki są recenzowane, edytowane i zapisywane wraz z metadanymi (autor, źródło, daty, kategorie i tagi) oraz integrowane z istniejącym algorytmem powtórek spaced repetition. System uwierzytelniania opiera się na kontach e-mail/hasło i restrykcjach RLS w Supabase. Kluczowe decyzje obejmują walidację wejścia (1000–10 000 znaków) i treści fiszek (pytanie 200 znaków, odpowiedź 500 znaków), limitowanie żądań generowania (jedno naraz, maksymalnie pięć na godzinę na użytkownika), sanityzację treści przed wysyłką do modelu oraz monitorowanie KPI na osobnym dashboardzie.

## 2. Problem użytkownika

Profesjonaliści uczący się nowych zagadnień teoretycznych i językowych rezygnują z fiszek, ponieważ przygotowanie materiału jest pracochłonne, wymaga powtarzalnych czynności i sprawdzania jakości. Obecne narzędzia do spaced repetition nie wspierają szybkiego przekształcania surowych notatek w gotowe fiszki, przez co użytkownicy tracą motywację do stosowania skutecznej metody nauki. Potrzebny jest prosty proces, który pozwoli wklepać notatki tekstowe, otrzymać dobre jakościowo fiszki z możliwością korekty oraz natychmiast rozpocząć powtórki.

## 3. Wymagania funkcjonalne

1. Uwierzytelnianie i zarządzanie kontem: rejestracja i logowanie e-mail/hasło, reset hasła, weryfikacja sesji, RLS w Supabase, ochrona przed nieautoryzowanym dostępem do fiszek.
2. Interfejs generowania AI: formularz wklejania tekstu z walidacją długości (1000–10 000 znaków), sanitacją i oczyszczaniem danych przed wysyłką do modelu, obsługą limitów żądań (kolejka jednego żądania, maksymalnie pięć prób na godzinę) oraz informacją o osiągnięciu limitu.
3. Recenzja fiszek generowanych: ekran przeglądu kandydatów z możliwością akceptacji, odrzucenia, edycji i ponownego zapisania treści; automatyczna walidacja pytania (<=200 znaków) i odpowiedzi (<=500 znaków) po stronie frontu, backendu i bazy oraz blokada duplikatów względem istniejących fiszek użytkownika.
4. Ręczne zarządzanie fiszkami: formularz dodawania fiszek od podstaw z tymi samymi limitami i walidacją, możliwość edycji i usuwania już zapisanych kart.
5. Lista fiszek: widok tabelaryczny/kafelkowy z paginacją, wyszukiwaniem, filtrowaniem po kategoriach i tagach, prezentacją metadanych, możliwością szybkiej edycji w modalach oraz integracją przycisku rozpoczęcia sesji powtórek.
6. Integracja modułu powtórek: wywołanie gotowego algorytmu spaced repetition z listy fiszek, przekazanie wymaganych danych, obsługa wyników sesji oraz zachowanie stanu kart po powrocie.
7. Dashboard KPI: osobny widok raportujący odsetek zaakceptowanych fiszek AI i udział AI w tworzeniu fiszek na użytkownika oraz inne podstawowe miary aktywności.
8. Testy i jakość: zestaw testów funkcjonalnych E2E i integracyjnych pokrywających główne scenariusze oraz wdrożenie standardowych praktyk bezpieczeństwa (walidacja, autoryzacja, sanitacja wejścia, obsługa błędów, logowanie).

## 4. Granice produktu

Zakres MVP nie obejmuje tworzenia dedykowanego algorytmu spaced repetition (wykorzystujemy istniejący moduł), importu plików w formatach innych niż zwykły tekst, współdzielenia zestawów fiszek między użytkownikami, integracji z zewnętrznymi platformami edukacyjnymi ani aplikacji mobilnych. Nie implementujemy timerów ani limitów czasowych w procesie recenzji fiszek. Otwarta pozostaje decyzja dotycząca wyboru konkretnej biblioteki do integracji algorytmu powtórek; wymaga to analizy kompatybilności z technologiami frontendu i backendu.

## 5. Historyjki użytkowników

ID: US-000
Tytuł: Dostęp dla niezalogowanego użytkownika
Opis: Jako nowy użytkownik chcę zainicjować rejestrację z dowolnego miejsca aplikacji, aby uzyskać dostęp do wszystkich funkcji.
Kryteria akceptacji:

- Ekrany funkcjonalne (generator, lista fiszek, powtórki) przekierowują niezalogowanego użytkownika do ekranu logowania z zachowaniem docelowego adresu powrotu po uwierzytelnieniu.
- Interfejs prezentuje jasne wezwanie do założenia konta oraz link do formularza rejestracji.
- Formularz rejestracyjny zawiera pola e-mail i hasło, waliduje ich poprawność oraz informuje o błędach.
- Po pomyślnej rejestracji konto aktywuje się automatycznie, użytkownik otrzymuje potwierdzenie i zostaje zalogowany do aplikacji.
- Próby wywołania API bez ważnej sesji kończą się komunikatem o braku autoryzacji i są logowane w celu monitorowania bezpieczeństwa.

ID: US-001
Tytuł: Logowanie i bezpieczny dostęp
Opis: Jako zarejestrowany użytkownik chcę logować się przy użyciu e-maila i hasła, aby mieć bezpieczny dostęp do moich fiszek oraz synchronizacji danych.
Kryteria akceptacji:

- Przy podaniu poprawnych danych użytkownik zostaje zalogowany, a sesja jest utrzymywana zgodnie z konfiguracją Supabase.
- Przy błędnych danych wyświetlany jest komunikat o niepoprawnym logowaniu bez ujawniania szczegółów.
- Hasła są przechowywane w sposób bezpieczny, a dostęp do danych w bazie jest ograniczony do autora fiszek dzięki regułom RLS.
- Tylko zalogowany użytkownik może wyświetlać, edytować i usuwać ficzki.
- Nie ma dostępu do fiszek innych użytkowników ani możliwości współdzielenia.

ID: US-002
Tytuł: Wklejanie tekstu do generowania
Opis: Jako użytkownik chcę wkleić surowy tekst do formularza, aby AI mogła stworzyć z niego propozycje fiszek.
Kryteria akceptacji:

- Formularz sprawdza długość tekstu i przyjmuje tylko wartości między 1000 a 10 000 znaków.
- Przy próbie wysłania tekstu spoza zakresu użytkownik otrzymuje informację o wymaganej długości.
- Tekst jest automatycznie oczyszczany z niebezpiecznych znaczników przed wysłaniem do backendu.

ID: US-003
Tytuł: Generowanie fiszek przez AI
Opis: Jako użytkownik chcę uzyskać propozycje fiszek wygenerowanych przez AI, aby skrócić czas przygotowania materiału.
Kryteria akceptacji:

- System pozwala mieć tylko jedno aktywne żądanie generowania na użytkownika naraz.
- Po przekroczeniu pięciu prób generowania w ciągu godziny użytkownik otrzymuje komunikat o przekroczeniu limitu i czas pozostały do resetu.
- Odpowiedź AI zawiera zestaw fiszek składających się z par pytanie-odpowiedź oraz powiązane metadane (sugerowane kategorie, tagi, źródło).

ID: US-004
Tytuł: Recenzja i zapis fiszek z AI
Opis: Jako użytkownik chcę przejrzeć, edytować, zaakceptować lub odrzucić każdą wygenerowaną fiszkę, aby zachować kontrolę nad jakością materiału.
Kryteria akceptacji:

- Każda propozycja fiszki udostępnia akcje akceptacji, edycji i odrzucenia bez konieczności przeładowania widoku.
- System blokuje zapis fiszki, jeśli pytanie przekracza 200 znaków, odpowiedź 500 znaków lub treść duplikuje istniejącą fiszkę użytkownika.
- Po zaakceptowaniu fiszka trafia do kolekcji z uzupełnionymi metadanymi (autor, źródło, daty, kategorie i tagi) i jest gotowa do powtórek.

ID: US-005
Tytuł: Ręczne dodawanie fiszki
Opis: Jako użytkownik chcę utworzyć fiszkę ręcznie, gdy potrzebuję doprecyzować pytanie lub materiał nie nadaje się do generowania AI.
Kryteria akceptacji:

- Formularz wymusza limity 200 znaków dla pytania i 500 dla odpowiedzi oraz pozwala dodać metadane (źródło, kategorie, tagi).
- Walidacja jest realizowana na froncie, backendzie i w bazie, a komunikaty błędów wyświetlane są w interfejsie.
- Po poprawnym zapisie fiszka pojawia się w liście użytkownika bez odświeżania całej strony.

ID: US-006
Tytuł: Edycja istniejącej fiszki
Opis: Jako użytkownik chcę edytować treść i metadane zapisanej fiszki, aby aktualizować materiał wraz z postępem nauki.
Kryteria akceptacji:

- Edycja dostępna jest z widoku listy w modalnym oknie lub rozwijanym panelu.
- System ponownie weryfikuje limity znaków i blokady duplikatów przed zapisaniem zmian.
- Zapisane zmiany są natychmiast widoczne w liście i udostępniane modułowi powtórek.

ID: US-007
Tytuł: Usuwanie fiszki
Opis: Jako użytkownik chcę usunąć fiszkę, która jest niepotrzebna lub błędna, aby utrzymać porządek w moim zestawie.
Kryteria akceptacji:

- Dostępna jest akcja usuń z potwierdzeniem przed ostatecznym skasowaniem.
- Usunięte fiszki znikają z listy, a moduł powtórek nie udostępnia ich w kolejnych sesjach.
- System loguje operację w celu audytu (metadane operacji przechowywane dla administratora produktu).

ID: US-008
Tytuł: Przegląd i filtrowanie fiszek
Opis: Jako użytkownik chcę przeglądać fiszki w liście z wyszukiwaniem, filtrowaniem i paginacją, aby szybko znaleźć potrzebne karty.
Kryteria akceptacji:

- Lista umożliwia filtrowanie po kategoriach, tagach i źródle oraz wyszukiwanie tekstowe po pytaniu i odpowiedzi.
- Paginacja utrzymuje wydajność i pamięta ustawienia użytkownika w ramach sesji.
- Metadane (autor, daty, tagi) są widoczne na liście oraz wykorzystywane do sortowania.

ID: US-009
Tytuł: Rozpoczęcie sesji powtórek
Opis: Jako użytkownik chcę uruchomić sesję powtórek bezpośrednio z listy fiszek, aby utrzymać rytm nauki.
Kryteria akceptacji:

- Z listy fiszek można wybrać zakres kart i zainicjować algorytm powtórek.
- Aplikacja przekazuje dane do istniejącego modułu spaced repetition i odbiera wyniki sesji.
- Postęp sesji aktualizuje stan fiszek (np. poziom trudności) i jest zapisywany dla przyszłych powtórek.

ID: US-010
Tytuł: Monitorowanie wskaźników KPI
Opis: Jako menedżer produktu chcę mieć dashboard KPI, aby monitorować skuteczność generowania i wykorzystania fiszek.
Kryteria akceptacji:

- Dashboard prezentuje co najmniej odsetek zaakceptowanych fiszek AI oraz udział fiszek tworzonych przez AI względem manualnych.
- Dane są odświeżane w ustalonym interwale i pochodzą z wiarygodnych logów aplikacyjnych.
- Eksport lub migawka danych do dalszej analizy jest dostępna w formie CSV lub JSON.

## 6. Metryki sukcesu

1. 75% fiszek wygenerowanych przez AI jest akceptowanych przez użytkowników.
2. 75% wszystkich fiszek utworzonych w systemie pochodzi z generowania AI, mierzone jako udział liczby fiszek utworzonych przez AI w stosunku do wszystkich nowych dodanych fiszek.
3. Monitorowanie liczby wygenerowanych fiszek i porównanie z liczbą zatwierdzonych do analizy jakości i użyteczności.
