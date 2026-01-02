# Deployment na Cloudflare Pages

## Wymagane zmienne środowiskowe

### GitHub Secrets

Następujące sekrety muszą być skonfigurowane w GitHub Repository Settings → Secrets and variables → Actions:

#### Cloudflare

- `CLOUDFLARE_API_TOKEN` - Token API z Cloudflare z uprawnieniami do Cloudflare Pages
- `CLOUDFLARE_ACCOUNT_ID` - ID konta Cloudflare

#### Supabase

- `PUBLIC_SUPABASE_URL` - URL projektu Supabase
- `PUBLIC_SUPABASE_ANON_KEY` - Klucz publiczny (anon) Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Klucz service role Supabase

#### OpenRouter

- `OPENROUTER_API_KEY` - Klucz API do OpenRouter.ai

### GitHub Variables

Następujące zmienne muszą być skonfigurowane w GitHub Repository Settings → Secrets and variables → Actions → Variables:

- `CLOUDFLARE_PROJECT_NAME` - Nazwa projektu w Cloudflare Pages
- `OPENROUTER_DEFAULT_MODE` - Domyślny tryb OpenRouter (np. "auto")

### Cloudflare Pages - Zmienne środowiskowe

Po pierwszym deploymencie, w Cloudflare Pages Dashboard należy skonfigurować następujące zmienne środowiskowe:

#### Production Environment

- `SUPABASE_URL` - URL projektu Supabase
- `SUPABASE_KEY` - Klucz publiczny (anon) Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Klucz service role Supabase
- `OPENROUTER_API_KEY` - Klucz API do OpenRouter.ai
- `OPENROUTER_DEFAULT_MODE` - Domyślny tryb OpenRouter
- `NODE_ENV` - `production`

## Jak uzyskać Cloudflare API Token

1. Zaloguj się do Cloudflare Dashboard
2. Przejdź do **My Profile** → **API Tokens**
3. Kliknij **Create Token**
4. Wybierz szablon **Edit Cloudflare Workers** lub utwórz custom token z uprawnieniami:
   - Account - Cloudflare Pages - Edit
5. Skopiuj wygenerowany token i dodaj jako `CLOUDFLARE_API_TOKEN` w GitHub Secrets

## Jak znaleźć Account ID

1. Zaloguj się do Cloudflare Dashboard
2. Wybierz swoją domenę lub przejdź do Workers & Pages
3. Account ID znajduje się w prawym panelu bocznym lub w URL: `https://dash.cloudflare.com/{ACCOUNT_ID}/...`

## Struktura workflow

Workflow `master.yml` wykonuje następujące kroki:

1. **Lint** - Sprawdzenie jakości kodu
2. **Unit Tests** - Uruchomienie testów jednostkowych
3. **Build** - Zbudowanie aplikacji dla produkcji
4. **Deploy** - Wdrożenie na Cloudflare Pages
5. **Status Notification** - Podsumowanie wyników w GitHub Actions

**Trigger:** Ręczny (`workflow_dispatch`) - workflow uruchamia się tylko po ręcznym wywołaniu w GitHub Actions.

## Konfiguracja Astro

Projekt został skonfigurowany do użycia adaptera `@astrojs/cloudflare`:

```javascript
adapter: cloudflare({
  platformProxy: {
    enabled: true,
  },
});
```

Adapter ten umożliwia:

- Renderowanie po stronie serwera (SSR) na Cloudflare Workers
- Dostęp do Cloudflare bindings (KV, D1, R2, etc.)
- Optymalizację dla Cloudflare Edge Network

## Pierwsze wdrożenie

### Przygotowanie

1. **Utwórz projekt w Cloudflare Pages Dashboard**
   - Przejdź do Workers & Pages
   - Kliknij **Create application** → **Pages** → **Connect to Git**
   - **NIE** łącz repozytorium - wybierz **Direct Upload**
   - Nadaj nazwę projektu (np. `10x-cards-production`)

2. **Skonfiguruj GitHub Repository Settings**
   - **Secrets** (zakładka "Secrets"):
     ```
     CLOUDFLARE_API_TOKEN=<twój-token-api>
     CLOUDFLARE_ACCOUNT_ID=<twój-account-id>
     PUBLIC_SUPABASE_URL=<url-projektu-supabase>
     PUBLIC_SUPABASE_ANON_KEY=<klucz-anon-supabase>
     SUPABASE_SERVICE_ROLE_KEY=<klucz-service-role-supabase>
     OPENROUTER_API_KEY=<klucz-api-openrouter>
     ```
   - **Variables** (zakładka "Variables"):

     ```
     CLOUDFLARE_PROJECT_NAME=<nazwa-projektu-w-cloudflare>
     OPENROUTER_DEFAULT_MODE=auto
     ```

     **CLOUDFLARE_PROJECT_NAME** - to dokładnie ta sama nazwa, którą nadałeś projektowi w Cloudflare Pages Dashboard (np. `10x-cards`, `my-project-name`). Znajdziesz ją w URL: `https://dash.cloudflare.com/{account-id}/pages/view/{project-name}`

3. **Utwórz environment `production`**
   - W Repository Settings → Environments
   - Kliknij **New environment**
   - Nazwij `production`

### Uruchomienie deploymentu

4. **Uruchom workflow ręcznie:**
   - Przejdź do **GitHub Actions** → **Deploy to Cloudflare Pages**
   - Kliknij **Run workflow**
   - Wybierz gałąź `master` i kliknij **Run workflow**

5. **Skonfiguruj zmienne środowiskowe w Cloudflare**
   - Po pierwszym deploymencie przejdź do Cloudflare Pages Dashboard
   - **Settings** → **Environment variables**
   - Dodaj zmienne dla środowiska **Production**:
     ```
     SUPABASE_URL=<url-projektu-supabase>
     SUPABASE_KEY=<klucz-anon-supabase>
     SUPABASE_SERVICE_ROLE_KEY=<klucz-service-role-supabase>
     OPENROUTER_API_KEY=<klucz-api-openrouter>
     OPENROUTER_DEFAULT_MODE=auto
     NODE_ENV=production
     ```

6. **Redeploy aplikacji**
   - Uruchom workflow ponownie lub skonfiguruj auto-redeploy po zmianach zmiennych

## Monitorowanie

- **GitHub Actions**: Logi deploymentu i status wszystkich jobów
- **Cloudflare Pages Dashboard**: Status deploymentu i logi runtime
- **Cloudflare Analytics**: Metryki wydajności i ruchu

## Rozwiązywanie problemów

### Błąd: "Invalid binding `SESSION`"

To ostrzeżenie można zignorować - dotyczy KV namespace dla sesji, które nie jest wymagane na starcie.

### Błąd: "Missing environment variables"

Sprawdź czy wszystkie wymagane zmienne są skonfigurowane zarówno w GitHub jak i Cloudflare.

### Błąd: "Deployment failed"

1. Sprawdź logi w GitHub Actions
2. Sprawdź czy `npm run build` działa lokalnie
3. Sprawdź czy wszystkie sekrety są poprawne

### Aplikacja nie działa po deploymencie

1. Sprawdź logi w Cloudflare Dashboard
2. Sprawdź czy zmienne środowiskowe są ustawione w Cloudflare
3. Sprawdź czy Supabase URL i klucze są poprawne

## Aktualizacja aplikacji

Workflow uruchamia się ręcznie, więc po każdej zmianie wymagającej redeploymentu:

1. Przejdź do **GitHub Actions** → **Deploy to Cloudflare Pages**
2. Kliknij **Run workflow**
3. Wybierz odpowiednią gałąź i uruchom

## Przydatne linki

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Astro Cloudflare Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
