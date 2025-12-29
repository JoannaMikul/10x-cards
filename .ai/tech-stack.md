Frontend - Astro z React dla komponentów interaktywnych:

- Astro 5 pozwala na tworzenie szybkich, wydajnych stron i aplikacji z minimalną ilością JavaScript
- React 19 zapewni interaktywność tam, gdzie jest potrzebna
- TypeScript 5 dla statycznego typowania kodu i lepszego wsparcia IDE
- Tailwind 4 pozwala na wygodne stylowanie aplikacji
- Shadcn/ui zapewnia bibliotekę dostępnych komponentów React, na których oprzemy UI

Backend - Supabase jako kompleksowe rozwiązanie backendowe:

- Zapewnia bazę danych PostgreSQL
- Zapewnia SDK w wielu językach, które posłużą jako Backend-as-a-Service
- Jest rozwiązaniem open source, które można hostować lokalnie lub na własnym serwerze
- Posiada wbudowaną autentykację użytkowników

AI - Komunikacja z modelami przez usługę Openrouter.ai:

- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

CI/CD i Hosting:

- Github Actions do tworzenia pipeline'ów CI/CD
- DigitalOcean do hostowania aplikacji za pośrednictwem obrazu docker

Testowanie:

**Testy jednostkowe i integracyjne:**

- Vitest - szybki runner testów zoptymalizowany dla Vite/Astro z natywnym wsparciem dla TypeScript/ESM
- React Testing Library - testowanie komponentów React zgodnie z best practices (testowanie zachowania, nie implementacji)
- @testing-library/user-event - realistyczne symulacje interakcji użytkownika
- @testing-library/jest-dom - niestandardowe matchery DOM dla lepszych asercji
- MSW (Mock Service Worker) - mockowanie HTTP dla API i Supabase w testach i developmencie
- @vitest/ui - interfejs webowy do przeglądania wyników testów
- vitest-preview - debugowanie testów jednostkowych w przeglądarce

**Testy E2E (end-to-end):**

- Playwright - scenariusze smoke i regresyjne uruchamiane na wielu przeglądarkach (Chromium, Firefox, WebKit)
- @playwright/experimental-ct-react - opcjonalne testowanie komponentów React w prawdziwej przeglądarce
- @axe-core/playwright - automatyczne testy dostępności zintegrowane z testami E2E
- Lighthouse - audyty wydajności, dostępności, SEO i best practices

**Środowisko testowe:**

- Supabase CLI (supabase start) - lokalny projekt Supabase w Docker do testów integracyjnych
- Dedykowane środowiska: dev, test, prod z osobnymi kluczami API
- Automatyczne uruchamianie migracji przed testami
