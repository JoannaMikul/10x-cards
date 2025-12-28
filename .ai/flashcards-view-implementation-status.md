# Status implementacji widoku Flashcards

## Zrealizowane kroki

- Dodano nowe typy viewmodeli (`FlashcardsFilters`, `FlashcardsViewState`, `FlashcardFormValues`, `FlashcardFormState`, `FlashcardSelectionState`) oraz zaktualizowano kontrakty w `src/types.ts`.
- Wprowadzono domyślne wartości filtrów i pomocnicze funkcje (`DEFAULT_FLASHCARDS_FILTERS`, `createDefaultFlashcardsFilters`) w `src/components/flashcards/constants.ts`.
- Zaimplementowano hook `useUrlQueryState` synchronizujący stan z parametrami URL.
- Utworzono `FlashcardsFiltersContext` z parserem/serializacją filtrów i resetem stanu.
- Przygotowano główny hook `useFlashcards` obsługujący pobieranie listy, paginację, CRUD (create/update/delete/restore), agregaty oraz obsługę błędów/toastów.
- Dodano pełen zestaw komponentów filtrów (`SearchInput`, `SortDropdown`, `FiltersSidebar`, `FiltersDrawer`) sprzężonych z kontekstem i walidacją limitów.
- Utworzono komponenty listy (`FlashcardList`, `FlashcardItem`, `LoadMoreButton`) z obsługą skeletonów, stanu pustego, akcji kart i zaznaczania do powtórek.
- Zaimplementowano modal `FlashcardFormModal` z walidacją `react-hook-form + zod`, mapowaniem błędów API i obsługą trybów create/edit.

## Kolejne kroki

- Dodać dialog potwierdzenia (`ConfirmDialog`) dla operacji delete/restore, zgodny z planem (krok 7).
- Połączyć wszystkie elementy w głównym komponencie `FlashcardsPage`, w tym toolbar, zarządzanie stanem i nawigację do `/reviews` (krok 8).
- Utworzyć stronę `src/pages/flashcards.astro`, wpiąć `FlashcardsPage` w layout i nawigację aplikacji (krok 9).
