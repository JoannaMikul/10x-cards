# GitHub Actions Workflows

Ten katalog zawiera konfiguracje GitHub Actions dla projektu 10x-cards.

## Workflows

### pull-request.yml

Workflow uruchamiany automatycznie przy każdym pull requeście do brancha `master`.

#### Struktura Pipeline

```text
lint
├── unit-test (równolegle)
└── e2e-test (równolegle)
    └── status-comment (tylko po sukcesie wszystkich)
```

#### Etapy

1. **Lint** - Lintowanie kodu
   - Uruchamia `npm run lint`
   - Blokuje dalsze etapy w przypadku błędów

2. **Unit Tests** (równolegle po lincie)
   - Uruchamia `npm run test:unit:coverage`
   - Zbiera coverage testów jednostkowych
   - Uploaduje artefakty coverage do GitHub

3. **E2E Tests** (równolegle po lincie)
   - Uruchamia `npm run test:e2e`
   - Używa środowiska `integration` z sekretami
   - Instaluje przeglądarki Playwright (chromium)
   - Uploaduje raporty i wyniki testów jako artefakty

4. **Status Comment** (tylko po sukcesie wszystkich)
   - Dodaje komentarz do PR z podsumowaniem statusu
   - Uruchamia się tylko gdy wszystkie poprzednie etapy zakończą się sukcesem

#### Wymagana Konfiguracja

Konfiguracja jest przechowywana w Environment `integration`:

**Environment Variables** (Settings → Environments → integration → Environment variables):

- `TEST_BASE_URL` - URL środowiska testowego (np. `http://localhost:3000`)
- `OPENROUTER_DEFAULT_MODEL` - Domyślny tryb OpenRouter dla testów
- `E2E_USERNAME_ID` - ID użytkownika testowego w bazie danych
- `E2E_USERNAME` - Login użytkownika testowego (email)
- `E2E_PASSWORD` - Hasło użytkownika testowego

**Environment Secrets** (Settings → Environments → integration → Environment secrets):

- `PUBLIC_SUPABASE_URL` - URL instancji Supabase
- `PUBLIC_SUPABASE_ANON_KEY` - Klucz publiczny Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Klucz service role Supabase
- `OPENROUTER_API_KEY` - Klucz API OpenRouter

#### Artefakty

Workflow zbiera następujące artefakty (dostępne przez 7 dni):

- `unit-test-coverage` - Raport coverage testów jednostkowych
- `playwright-report` - HTML raport z testów E2E
- `test-results` - Surowe wyniki testów E2E

#### Wersje Akcji

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/upload-artifact@v6`
- `actions/github-script@v8`

#### Node.js

Wersja Node.js jest automatycznie pobierana z pliku `.nvmrc` (obecnie: 22.17.0).

## Konfiguracja Środowiska Integration

W ustawieniach repozytorium GitHub należy:

1. **Utworzyć środowisko integration** (Settings → Environments):
   - Utworzyć środowisko o nazwie `integration`
   - (Opcjonalnie) Skonfigurować protection rules dla środowiska

2. **Dodać Environment Variables** (Settings → Environments → integration → Environment variables):
   - `TEST_BASE_URL`
   - `OPENROUTER_DEFAULT_MODEL`
   - `E2E_USERNAME_ID`
   - `E2E_USERNAME`
   - `E2E_PASSWORD`

3. **Dodać Environment Secrets** (Settings → Environments → integration → Environment secrets):
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENROUTER_API_KEY`

## Lokalne Testowanie

Aby przetestować workflow lokalnie, można użyć narzędzia [act](https://github.com/nektos/act):

```bash
# Instalacja act (macOS)
brew install act

# Uruchomienie workflow
act pull_request
```

**Uwaga:** Lokalne uruchomienie wymaga skonfigurowania sekretów w pliku `.secrets`.
