# Schemat bazy danych 10x-cards

## 1. Lista tabel z kolumnami, typami danych i ograniczeniami

**Rozszerzenia / typy niestandardowe**

- `CREATE EXTENSION IF NOT EXISTS citext;`
- `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
- `CREATE TYPE card_origin AS ENUM ('ai-full','ai-edited','manual');`
- `CREATE TYPE generation_status AS ENUM ('pending','running','succeeded','failed','cancelled');`
- `CREATE TYPE candidate_status AS ENUM ('proposed','edited','accepted','rejected');`
- `CREATE TYPE review_outcome AS ENUM ('fail','hard','good','easy','again');`
- Funkcja `normalize_flashcard_text(front text, back text)` zwraca zunifikowany ciąg (lowercase, usunięte znaki diakrytyczne, zbite spacje) i służy do deduplikacji.

### `user_roles`

| Kolumna      | Typ         | Ograniczenia / opis                                          |
| ------------ | ----------- | ------------------------------------------------------------ |
| `user_id`    | uuid        | PK (wraz z `role`), FK → `auth.users(id)`, ON DELETE CASCADE |
| `role`       | text        | CHECK (`role='admin'`), PK (wraz z `user_id`)                |
| `granted_at` | timestamptz | NOT NULL DEFAULT now()                                       |

### `categories`

| Kolumna       | Typ         | Ograniczenia / opis                             |
| ------------- | ----------- | ----------------------------------------------- |
| `id`          | bigserial   | PK                                              |
| `name`        | citext      | NOT NULL, UNIQUE (case-insensitive)             |
| `slug`        | text        | NOT NULL, UNIQUE, CHECK (slug ~ '^[a-z0-9-]+$') |
| `description` | text        | NULL                                            |
| `color`       | text        | NULL, CHECK (color ~ '^#[0-9A-Fa-f]{6}$')       |
| `created_at`  | timestamptz | NOT NULL DEFAULT now()                          |
| `updated_at`  | timestamptz | NOT NULL DEFAULT now()                          |

### `tags`

Struktura analogiczna do `categories` (bez pola `color`), z dodatkową CHECK `char_length(name) ≤ 64`.

### `sources`

| Kolumna       | Typ         | Ograniczenia / opis                                                 |
| ------------- | ----------- | ------------------------------------------------------------------- |
| `id`          | bigserial   | PK                                                                  |
| `name`        | citext      | NOT NULL, UNIQUE                                                    |
| `slug`        | text        | NOT NULL, UNIQUE                                                    |
| `kind`        | text        | NOT NULL, CHECK (kind IN ('book','article','course','url','other')) |
| `url`         | text        | NULL, CHECK (url ~ '^https?://')                                    |
| `description` | text        | NULL                                                                |
| `created_at`  | timestamptz | NOT NULL DEFAULT now()                                              |
| `updated_at`  | timestamptz | NOT NULL DEFAULT now()                                              |

### `flashcards`

| Kolumna                  | Typ         | Ograniczenia / opis                                                  |
| ------------------------ | ----------- | -------------------------------------------------------------------- |
| `id`                     | uuid        | PK, DEFAULT gen_random_uuid()                                        |
| `owner_id`               | uuid        | NOT NULL, FK → `auth.users(id)`                                      |
| `category_id`            | bigint      | FK → `categories(id)`                                                |
| `content_source_id`      | bigint      | FK → `sources(id)`                                                   |
| `front`                  | text        | NOT NULL, CHECK (char_length(front) ≤ 200)                           |
| `back`                   | text        | NOT NULL, CHECK (char_length(back) ≤ 500)                            |
| `front_back_fingerprint` | text        | GENERATED ALWAYS AS (`normalize_flashcard_text(front, back)`) STORED |
| `origin`                 | card_origin | NOT NULL                                                             |
| `metadata`               | jsonb       | NULL (np. autor zewnętrzny)                                          |
| `created_at`             | timestamptz | NOT NULL DEFAULT now()                                               |
| `updated_at`             | timestamptz | NOT NULL DEFAULT now()                                               |
| `deleted_at`             | timestamptz | NULL (soft-delete)                                                   |

### `card_tags`

| Kolumna      | Typ                  | Ograniczenia / opis                               |
| ------------ | -------------------- | ------------------------------------------------- |
| `card_id`    | uuid                 | NOT NULL, FK → `flashcards(id)` ON DELETE CASCADE |
| `tag_id`     | bigint               | NOT NULL, FK → `tags(id)` ON DELETE RESTRICT      |
| `created_at` | timestamptz          | NOT NULL DEFAULT now()                            |
| PK           | (`card_id`,`tag_id`) |                                                   |

### `generations`

| Kolumna                  | Typ               | Ograniczenia / opis                                                        |
| ------------------------ | ----------------- | -------------------------------------------------------------------------- |
| `id`                     | uuid              | PK, DEFAULT gen_random_uuid()                                              |
| `user_id`                | uuid              | NOT NULL, FK → `auth.users(id)`                                            |
| `status`                 | generation_status | NOT NULL DEFAULT 'pending'                                                 |
| `model`                  | text              | NOT NULL                                                                   |
| `sanitized_input_text`   | text              | NOT NULL, CHECK (char_length(sanitized_input_text) BETWEEN 1000 AND 10000) |
| `sanitized_input_length` | integer           | GENERATED ALWAYS AS (char_length(sanitized_input_text)) STORED             |
| `sanitized_input_sha256` | bytea             | GENERATED ALWAYS AS (digest(sanitized_input_text,'sha256')) STORED         |
| `prompt_tokens`          | integer           | NULL, CHECK (prompt_tokens >= 0)                                           |
| `temperature`            | numeric(3,2)      | NULL, CHECK (temperature BETWEEN 0 AND 2)                                  |
| `started_at`             | timestamptz       | NULL                                                                       |
| `completed_at`           | timestamptz       | NULL                                                                       |
| `error_code`             | text              | NULL                                                                       |
| `error_message`          | text              | NULL                                                                       |
| `created_at`             | timestamptz       | NOT NULL DEFAULT now()                                                     |
| `updated_at`             | timestamptz       | NOT NULL DEFAULT now()                                                     |

### `generation_candidates`

| Kolumna                  | Typ              | Ograniczenia / opis                                                  |
| ------------------------ | ---------------- | -------------------------------------------------------------------- |
| `id`                     | uuid             | PK, DEFAULT gen_random_uuid()                                        |
| `generation_id`          | uuid             | NOT NULL, FK → `generations(id)` ON DELETE CASCADE                   |
| `owner_id`               | uuid             | NOT NULL, FK → `auth.users(id)`                                      |
| `status`                 | candidate_status | NOT NULL DEFAULT 'proposed'                                          |
| `front`                  | text             | NOT NULL, CHECK (char_length(front) ≤ 200)                           |
| `back`                   | text             | NOT NULL, CHECK (char_length(back) ≤ 500)                            |
| `front_back_fingerprint` | text             | GENERATED ALWAYS AS (`normalize_flashcard_text(front, back)`) STORED |
| `suggested_category_id`  | bigint           | NULL, FK → `categories(id)`                                          |
| `suggested_tags`         | jsonb            | NULL (lista slugów/tagów)                                            |
| `accepted_card_id`       | uuid             | NULL, UNIQUE, FK → `flashcards(id)`                                  |
| `created_at`             | timestamptz      | NOT NULL DEFAULT now()                                               |
| `updated_at`             | timestamptz      | NOT NULL DEFAULT now()                                               |

### `generation_error_logs`

| Kolumna              | Typ         | Ograniczenia / opis             |
| -------------------- | ----------- | ------------------------------- |
| `id`                 | bigserial   | PK                              |
| `user_id`            | uuid        | NOT NULL, FK → `auth.users(id)` |
| `model`              | text        | NOT NULL                        |
| `source_text_hash`   | bytea       | NOT NULL                        |
| `source_text_length` | integer     | NOT NULL                        |
| `error_code`         | text        | NOT NULL                        |
| `error_message`      | text        | NOT NULL                        |
| `created_at`         | timestamptz | NOT NULL DEFAULT now()          |

### `review_events`

| Kolumna              | Typ            | Ograniczenia / opis                   |
| -------------------- | -------------- | ------------------------------------- |
| `id`                 | bigserial      | PK                                    |
| `user_id`            | uuid           | NOT NULL, FK → `auth.users(id)`       |
| `card_id`            | uuid           | NOT NULL, FK → `flashcards(id)`       |
| `reviewed_at`        | timestamptz    | NOT NULL DEFAULT now()                |
| `outcome`            | review_outcome | NOT NULL                              |
| `response_time_ms`   | integer        | NULL, CHECK (response_time_ms >= 0)   |
| `prev_interval_days` | integer        | NULL                                  |
| `next_interval_days` | integer        | NULL, CHECK (next_interval_days >= 0) |
| `was_learning_step`  | boolean        | NOT NULL DEFAULT false                |
| `payload`            | jsonb          | NULL (szczegóły algorytmu SR)         |

### `review_stats`

| Kolumna                 | Typ                   | Ograniczenia / opis                               |
| ----------------------- | --------------------- | ------------------------------------------------- |
| `user_id`               | uuid                  | NOT NULL, FK → `auth.users(id)`                   |
| `card_id`               | uuid                  | NOT NULL, FK → `flashcards(id)` ON DELETE CASCADE |
| `total_reviews`         | integer               | NOT NULL DEFAULT 0                                |
| `successes`             | integer               | NOT NULL DEFAULT 0                                |
| `consecutive_successes` | integer               | NOT NULL DEFAULT 0                                |
| `last_outcome`          | review_outcome        | NULL                                              |
| `last_reviewed_at`      | timestamptz           | NULL                                              |
| `next_review_at`        | timestamptz           | NULL                                              |
| `last_interval_days`    | integer               | NULL                                              |
| `aggregates`            | jsonb                 | NULL (np. rozkład trudności)                      |
| PK                      | (`user_id`,`card_id`) |                                                   |

## 2. Relacje między tabelami

- `auth.users (1) ──< user_roles` (użytkownik może mieć wiele ról).
- `auth.users (1) ──< flashcards` (owner_id).
- `categories (1) ──< flashcards`; `sources (1) ──< flashcards`.
- `flashcards (M) ──< card_tags >── (M) tags` (tabela łącząca).
- `auth.users (1) ──< generations`; `generations (1) ──< generation_candidates`.
- `generation_candidates (1) ──? flashcards`: opcjonalna 1:1 przez `accepted_card_id`.
- `auth.users (1) ──< review_events`; `flashcards (1) ──< review_events`.
- `review_stats` jest 1:1 względem pary (`user_id`,`card_id`) i synchronizowana triggerami po `review_events`.
- `generation_error_logs` jest 1:N względem `auth.users`.

## 3. Indeksy

- `flashcards`: UNIQUE BTREE (`owner_id`,`front_back_fingerprint`) filtrujący `deleted_at IS NULL`; BTREE (`owner_id`,`created_at DESC`); GIN pg_trgm na kolumnach `front` i `back` dla wyszukiwania pełnotekstowego; BTREE na `category_id`, `content_source_id`.
- `card_tags`: BTREE na `tag_id`, umożliwia filtrowanie po tagach.
- `generations`: częściowy UNIQUE (`user_id`) WHERE `status IN ('pending','running')` (limit jednego aktywnego żądania); BTREE (`user_id`,`created_at DESC`); BTREE na `status`.
- `generation_candidates`: UNIQUE (`owner_id`,`front_back_fingerprint`) WHERE `status IN ('proposed','edited')` (antyduplikat); BTREE na (`generation_id`,`status`).
- `generation_error_logs`: BTREE (`created_at DESC`), BTREE (`user_id`,`created_at`).
- `review_events`: BTREE (`user_id`,`reviewed_at DESC`), BTREE (`card_id`,`reviewed_at DESC`).
- `review_stats`: PK index (`user_id`,`card_id`), dodatkowy BTREE (`card_id`,`next_review_at`) dla modułu powtórek.
- `categories`, `tags`, `sources`: UNIQUE BTREE na (`lower(name)` / `slug`).

## 4. Zasady PostgreSQL (RLS)

**Funkcje pomocnicze**

- `create function is_admin() returns boolean` – sprawdza istnienie rekordu w `user_roles` dla `auth.uid()`.

**Polityki**

- `flashcards`, `card_tags`, `generations`, `generation_candidates`, `review_events`, `review_stats`: RLS ENABLED. Polityka SELECT/INSERT/UPDATE/DELETE `USING (owner_id = auth.uid() OR is_admin())` oraz `WITH CHECK (owner_id = auth.uid() OR is_admin())`. Dodatkowo filtr ukrywający miękkousunięte rekordy: `USING (deleted_at IS NULL OR is_admin())`.
- `categories`, `tags`, `sources`: RLS ENABLED. Polityka SELECT `USING (true)` (wszyscy). Pisanie ograniczone do adminów: `WITH CHECK (is_admin())`.
- `generation_error_logs`: RLS ENABLED. Tylko admini: `USING (is_admin())`.
- `user_roles`: tylko admini mogą SELECT/INSERT/DELETE.
- Widoki lub funkcje do KPI powinny korzystać z SECURITY DEFINER, aby agregować dane bez łamania RLS.

## 5. Dodatkowe uwagi

- **Trigger limitu 5/h**: `BEFORE INSERT` na `generations` odrzuca nowe wstawienia, jeśli istnieje ≥5 rekordów użytkownika z `created_at >= now() - interval '1 hour'`.
- **Soft-delete**: dla `flashcards` aktualizacja `deleted_at` usuwa kartę z widoków użytkownika; admin może przeglądać/reaktywować rekordy.
- **Review stats maintenance**: `AFTER INSERT` na `review_events` aktualizuje/UPSERTuje `review_stats` (total, successes, next_review_at) zgodnie z wynikiem algorytmu spaced repetition.
- **Sanityzacja tekstu**: aplikacja zapisuje tylko dane po stronie klienta po oczyszczeniu; hashów używamy do deduplikacji i audytu wejść AI.
- **Partycjonowanie i retencja**: `generation_error_logs` i `review_events` mogą zostać podzielone miesięcznie przy rosnących wolumenach; starsze wpisy (np. >90 dni) można przenosić do archiwum.
- **Monitorowanie KPI**: rekomendowane widoki materializowane łączące `flashcards`, `generation_candidates`, `review_events` z filtrami po `origin` i `status` — odświeżane przez cron/Scheduler Supabase.
