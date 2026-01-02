# GitHub Actions Workflows

## master.yml - Deploy to Cloudflare Pages

Workflow ręcznego wdrożenia aplikacji na Cloudflare Pages.

### Triggery

- Ręczne uruchomienie (`workflow_dispatch`) z poziomu GitHub Actions

### Jobs

#### 1. lint

Sprawdzenie jakości kodu za pomocą ESLint.

**Kroki:**

- Checkout kodu
- Setup Node.js (wersja z `.nvmrc`)
- Instalacja zależności (`npm ci`)
- Uruchomienie lintera

#### 2. unit-test

Uruchomienie testów jednostkowych.

**Kroki:**

- Checkout kodu
- Setup Node.js
- Instalacja zależności
- Uruchomienie testów jednostkowych

**Zależności:** `lint`

#### 3. build

Zbudowanie aplikacji dla produkcji.

**Kroki:**

- Checkout kodu
- Setup Node.js
- Instalacja zależności
- Build aplikacji
- Upload artefaktów buildu

**Zależności:** `lint`, `unit-test`

**Wymagane sekrety GitHub (Settings → Secrets and variables → Actions → Secrets):**

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`

**Wymagane zmienne GitHub (Settings → Secrets and variables → Actions → Variables):**

- `OPENROUTER_DEFAULT_MODEL`
- `NODE_ENV=production` (wartość stała w workflow)

#### 4. deploy

Wdrożenie aplikacji na Cloudflare Pages.

**Kroki:**

- Checkout kodu
- Download artefaktów buildu
- Deploy na Cloudflare Pages za pomocą Wrangler

**Zależności:** `build`

**Environment:** `production`

**Wymagane sekrety:**

- `CLOUDFLARE_API_TOKEN` - Token API Cloudflare
- `CLOUDFLARE_ACCOUNT_ID` - ID konta Cloudflare

**Wymagane zmienne:**

- `CLOUDFLARE_PROJECT_NAME` - Nazwa projektu w Cloudflare Pages

#### 5. status-notification

Podsumowanie wyników pipeline'u.

**Kroki:**

- Utworzenie podsumowania w GitHub Actions Summary

**Zależności:** `lint`, `unit-test`, `build`, `deploy`

**Warunek:** Zawsze (`if: always()`)

### Wersje akcji

Wszystkie akcje używają najnowszych stabilnych wersji:

- `actions/checkout@v6` - Checkout kodu z repozytorium
- `actions/setup-node@v6` - Konfiguracja środowiska Node.js
- `actions/upload-artifact@v6` - Upload artefaktów
- `actions/download-artifact@v7` - Download artefaktów
- `cloudflare/wrangler-action@v3` - Deploy na Cloudflare

### Cache

Workflow wykorzystuje cache npm dla przyspieszenia instalacji zależności:

```yaml
with:
  node-version-file: ".nvmrc"
  cache: "npm"
```

### Różnice względem pull-request.yml

| Feature     | pull-request.yml | master.yml                   |
| ----------- | ---------------- | ---------------------------- |
| Trigger     | PR do master     | Ręczny (`workflow_dispatch`) |
| Lint        | ✅               | ✅                           |
| Unit Tests  | ✅ (z coverage)  | ✅ (bez coverage)            |
| E2E Tests   | ✅               | ❌                           |
| Build       | ❌               | ✅                           |
| Deploy      | ❌               | ✅                           |
| Status      | Komentarz PR     | GitHub Actions Summary       |
| Environment | -                | production                   |

## pull-request.yml - Pull Request CI

Workflow CI dla pull requestów do gałęzi `master`.

### Triggery

- Pull request do gałęzi `master` (opened, synchronize, reopened)

### Jobs

Szczegółowy opis dostępny w pliku `pull-request.yml`.

**Główne różnice:**

- Trigger: PR vs ręczny workflow_dispatch
- Zawiera testy E2E
- Nie wykonuje buildu produkcyjnego
- Nie wykonuje deploymentu
- Dodaje komentarz z wynikami do PR
- Testy jednostkowe z coverage (pull-request.yml) vs bez coverage (master.yml)
