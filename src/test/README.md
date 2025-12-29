# Testing Guide

## Testy Jednostkowe (Vitest)

### Uruchamianie testów

```bash
# Wszystkie testy jednostkowe
npm run test:unit

# Testy w trybie watch (rozwojowy)
npm run test:unit:watch

# Interfejs webowy dla testów
npm run test:unit:ui

# Pokrycie kodu
npm run test:unit:coverage
```

### Struktura testów

- Testy jednostkowe: `src/**/__tests__/*.test.ts` lub `src/**/__tests__/*.test.tsx`
- Konfiguracja: `vitest.config.ts`
- Setup: `src/test/setup.ts`

### Zasady pisania testów

- Używaj `describe` i `it` dla grupowania testów
- Testuj zachowanie, nie implementację
- Używaj matcherów z `@testing-library/jest-dom`
- Czyść stan po każdym teście (automatycznie przez setup)

## Testy E2E (Playwright)

### Uruchamianie testów

```bash
# Wszystkie testy E2E
npm run test:e2e

# Interfejs webowy Playwright
npm run test:e2e:ui

# Debugowanie testów
npm run test:e2e:debug

# Instalacja przeglądarek (pierwsze uruchomienie)
npm run playwright:install
```

### Struktura testów

- Testy E2E: `e2e/*.spec.ts`
- Konfiguracja: `playwright.config.ts`

### Zasady pisania testów E2E

- Używaj Page Object Model dla złożonych scenariuszy
- Testuj rzeczywiste zachowania użytkowników
- Używaj locatorów zamiast selektorów CSS
- Wykorzystuj browser contexts do izolacji testów

## Wszystkie testy

```bash
npm test
```

## Środowisko testowe

- **Vitest**: szybkie testy jednostkowe z jsdom
- **Playwright**: testy E2E w Chromium
- **Testing Library**: testowanie komponentów React zgodnie z best practices
- **MSW**: mockowanie API dla testów jednostkowych
