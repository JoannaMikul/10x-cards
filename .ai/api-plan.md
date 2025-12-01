# REST API Plan

## 1. Resources

- `Auth Session` → Supabase Auth (`auth.users`, handled by Supabase SDK); API only validates JWT and enforces RLS.
- `user_roles` → `user_roles` (admin-only role assignments).
- `categories` → `categories`.
- `tags` → `tags`.
- `sources` → `sources`.
- `flashcards` → `flashcards` (soft delete via `deleted_at`).
- `card_tags` → `card_tags` (managed through tag assignment endpoints).
- `generations` → `generations`.
- `generation_candidates` → `generation_candidates`.
- `generation_error_logs` → `generation_error_logs` (admin diagnostics).
- `review_events` → `review_events`.
- `review_stats` → `review_stats`.
- `analytics_kpi` → materialized/admin views combining `flashcards`, `generation_candidates`, `review_events`.

## 2. Endpoints

### Auth Session (Supabase-native)

- **Method/Path:** `POST /auth/v1/token`, `POST /auth/v1/signup`, etc. (handled by Supabase; not proxied).
- **Description:** Client obtains JWT; the API validates `Authorization: Bearer <supabase access token>` on every request.
- **Success:** `200 OK` with Supabase session payload.
- **Errors:** Standard Supabase Auth errors (`400 invalid_credentials`, `429 rate_limit_exceeded`).

### Categories

#### GET /api/categories

- **Description:** Public list of categories for filters/metadata chips. Until Supabase Auth is wired in, the handler logs events with `DEFAULT_USER_ID` but does not require a JWT.
- **Query params:**
  - `search` (optional string) – trimmed, case-insensitive `ILIKE` over `name` and `slug`, max 200 chars.
  - `limit` (optional int) – defaults to `20`, bounded to `1..100`; backend fetches `limit + 1` items to determine `has_more`.
  - `cursor` (optional string) – Base64-encoded `id` of the last record from the previous page. Invalid Base64 / non-positive IDs return `400 invalid_query`.
  - `sort` (optional enum `name|created_at`) – defaults to `name`. All queries also sort by `id ASC` to keep pagination deterministic.
- **Response example:**

```json
{
  "data": [
    {
      "id": 12,
      "name": "Networking",
      "slug": "networking",
      "description": "Layered protocols overview",
      "color": "#3366FF",
      "created_at": "2025-10-30T10:00:00.000Z",
      "updated_at": "2025-11-01T11:00:00.000Z"
    }
  ],
  "page": { "next_cursor": "MTI=", "has_more": true }
}
```

- **Success Codes:** `200 OK`.
- **Errors:**

| Status | `error.code`       | Notes                                                                                        |
| ------ | ------------------ | -------------------------------------------------------------------------------------------- |
| 400    | `invalid_query`    | Schema validation failures, malformed cursor, limits outside range, empty search, etc.       |
| 500    | `db_error`         | PostgREST/PG failures; response includes `{ code, message }` from Supabase                   |
| 500    | `unexpected_error` | Non-DB issues (cursor decoding crash, missing Supabase client, unexpected runtime exception) |

- **Observability:** Every 4xx/5xx routes through `recordCategoriesEvent`, which logs JSON to stdout (`scope: "api/categories"`, `userId = DEFAULT_USER_ID`) for future ingestion. Rate limiting/auth are planned but not yet enforced.
- **Mocks:** Contract fixtures (200/400/500) live at `src/lib/mocks/categories.api.mocks.ts`.

#### POST /api/categories (admin – planned)

- **Request:**

```json
{ "name": "DevOps", "slug": "devops", "description": "Tooling", "color": "#FF9900" }
```

- **Response:** `201 Created` with new record.
- **Validation:** `name`/`slug` unique, `slug` regex `^[a-z0-9-]+$`, `color` hex.
- **Errors:** `400 invalid_body`, `409 slug_taken`, `403 forbidden` (non-admin).

#### PATCH /api/categories/:id (admin)

- Supports partial updates; maintains `updated_at`.
- **Errors:** `404 not_found`, `409 constraint_violation`.

#### DELETE /api/categories/:id (admin)

- Hard delete blocked if FK exists; return `409 category_in_use`.

### Tags

#### GET /api/tags

- **Description:** Public tag listing used for filters and metadata chips. Mirrors the categories endpoint with the extra invariant `name ≤ 64` enforced at validation level to match the DB constraint.
- **Query params:**
  - `search` (optional string) – trimmed, case-insensitive `ILIKE` on `name` and `slug`, 1..200 characters.
  - `limit` (optional int) – defaults to `20`, bounded to `1..100`; backend fetches `limit + 1` rows to detect `has_more`.
  - `cursor` (optional string) – Base64-encoded positive `id` of the last record. Invalid Base64 or `id ≤ 0` → `400 invalid_query`.
  - `sort` (optional enum `name|created_at`) – defaults to `name`. Queries always apply a secondary `order("id","asc")` to keep pagination deterministic.
- **Sample response:**

```json
{
  "data": [
    {
      "id": 3,
      "name": "docker",
      "slug": "docker",
      "description": "Containers and OCI images",
      "created_at": "2025-11-01T08:00:00.000Z",
      "updated_at": "2025-11-01T08:00:00.000Z"
    }
  ],
  "page": { "next_cursor": "Mw==", "has_more": true }
}
```

- **Success codes:** `200 OK`.
- **Errors:**

| Status | `error.code`       | Notes                                                                                   |
| ------ | ------------------ | --------------------------------------------------------------------------------------- |
| 400    | `invalid_query`    | Zod validation failure, empty `search`, malformed cursor, limit outside range           |
| 500    | `db_error`         | PostgREST/PostgreSQL failure; response includes `{ code, message }` from Supabase       |
| 500    | `unexpected_error` | Runtime issues (missing Supabase client, cursor decoding crash, other unexpected error) |

- **Observability:** Handler logs every 4xx/5xx via `recordTagsEvent` (`scope: "api/tags"`, `userId = DEFAULT_USER_ID`).
- **Mocks:** Contract fixtures (200/400/500) live in `src/lib/mocks/tags.api.mocks.ts`.

### Sources

#### GET /api/sources

- Provides filters for flashcards; supports `kind`, `search`, pagination.
- Validates `url` scheme on create/update (`POST/PATCH /api/sources`).

### Flashcards

#### GET /api/flashcards

- **Description:** Returns authenticated user’s cards, excluding soft-deleted ones (unless `include_deleted=true` and user is admin).
- **Query:** `limit` (default 20, max 100), `cursor` (opaque `created_at:id`), `category_id`, `tag_ids[]`, `content_source_id`, `origin`, `search` (trigram search), `sort` (`created_at|-created_at|updated_at|next_review_at`).
- **Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "front": "Question",
      "back": "Answer",
      "origin": "ai-edited",
      "metadata": { "language": "EN" },
      "category_id": 1,
      "content_source_id": 2,
      "tags": [
        {
          "id": 3,
          "name": "docker",
          "slug": "docker",
          "description": "...",
          "created_at": "...",
          "updated_at": "..."
        }
      ],
      "owner_id": "uuid",
      "created_at": "...",
      "updated_at": "...",
      "deleted_at": null
    }
  ],
  "page": { "next_cursor": "2025-01-01T10:00:00Z#uuid", "has_more": true },
  "aggregates": { "total": 154, "by_origin": { "ai-full": 90, "manual": 20 } }
}
```

- **Success Codes:** `200 OK`.
- **Errors:** `401 unauthorized`.

#### POST /api/flashcards

- **Description:** Creates a manual or AI-backed flashcard for the authenticated user, enforcing length limits, uniqueness, and ownership via RLS.
- **Request:**

```json
{
  "front": "Explain TCP handshake",
  "back": "SYN, SYN-ACK, ACK ...",
  "category_id": 1,
  "content_source_id": 5,
  "tag_ids": [3, 4],
  "origin": "manual",
  "metadata": { "language": "PL" }
}
```

- **Validation:** `front ≤200 chars`, `back ≤500`, `origin ∈ card_origin`, duplicate fingerprint rejected (`409 duplicate_flashcard`), FK existence, RLS ensures `owner_id = auth.uid`.
- **Response:** `201 Created` with record.

#### GET /api/flashcards/:id

- Returns card if owner/admin; includes review stats snapshot.

#### PATCH /api/flashcards/:id

- Update or insert tags (replace set), updates metadata, resets `updated_at`.
- Soft-delete triggered by `deleted_at` provided.
- **Errors:** `404 not_found`, `409 duplicate_flashcard`.

#### DELETE /api/flashcards/:id

- Sets `deleted_at = now()` (soft delete). `204 No Content`.

#### POST /api/flashcards/:id/restore

- Clears `deleted_at`; admin can restore any card.

### Card Tags

#### PUT /api/flashcards/:id/tags

- Replaces tag set atomically.
- **Request:** `{ "tag_ids": [1,2,3] }`.
- **Response:** `200 OK` with updated tag array.

### Generations

#### POST /api/generations

- **Description:** Starts an AI-backed generation job for the authenticated user. Backend enforces at most one active (`pending`/`running`) job per user and applies
  the DB trigger limit of **5 requests / hour**. The server re-sanitizes text (normalize line endings, remove control chars, collapse whitespace) before persisting or
  hashing it.
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <jwt>` (required once auth wiring is finished; currently mocked by `DEFAULT_USER_ID`).
- **Body fields:**
  - `model` _(string, required)_ – e.g. `openrouter/gpt-4.1-mini`.
  - `sanitized_input_text` _(string, required)_ – must land between **1000** and **10000** characters **after** the server’s sanitation pass.
  - `temperature` _(number, optional)_ – range `[0, 2]`, rounded to 2 decimal places on insert.
- **Request example:**

```json
{
  "model": "openrouter/gpt-4.1-mini",
  "sanitized_input_text": "Sanitized text ...",
  "temperature": 0.7
}
```

- **Server Logic:** Validate JSON via Zod, sanitize text, guard final length, perform optimistic SELECT for active jobs, insert row with `status = 'pending'`, let
  worker observe new record.
- **Success response:** `202 Accepted`

```json
{
  "id": "a3de7fac-7d1b-4c21-a987-6a087d8b37a5",
  "status": "pending",
  "enqueued_at": "2025-11-30T12:34:56.000Z"
}
```

- **Error contract:** All errors follow `ApiErrorResponse`.

| Status | `error.code`            | Trigger                                                                 |
| ------ | ----------------------- | ----------------------------------------------------------------------- |
| 400    | `invalid_payload`       | Invalid JSON / schema validation failure                                |
| 400    | `length_out_of_range`   | Text after sanitation shorter than 1000 or longer than 10000 characters |
| 401    | `unauthorized`          | Missing/invalid Supabase JWT (future state)                             |
| 409    | `active_request_exists` | Optimistic SELECT or unique index (`status in (pending,running)`)       |
| 429    | `hourly_quota_reached`  | Supabase trigger `generation_rate_limit_exceeded`                       |
| 500    | `db_error`              | Misc. Postgres/PostgREST issue during insert                            |
| 500    | `unexpected_error`      | Non-PostgREST runtime error                                             |

- **Example error:**

```json
{
  "error": {
    "code": "active_request_exists",
    "message": "An active generation request is already in progress."
  }
}
```

- **Observability:** Endpoint emits structured console events (see `recordGenerationEvent` in `src/pages/api/generations.ts`) and writes hashes/lengths to
  `generation_error_logs` for 409/429/500 scenarios.
- **Mocks:** Ready-to-use contract examples (202/400/409/429/500) live in `src/lib/mocks/generations.api.mocks.ts`.

#### GET /api/generations

- Lists current user’s jobs (pagination by `created_at`).

#### GET /api/generations/:id

- Returns status, timestamps, token usage, error fields, plus candidates summary.

#### PATCH /api/generations/:id

- Allows client-side cancel while `status ∈ ('pending','running')`.
- **Request:** `{ "status": "cancelled" }`.
- **Response:** `200 OK`.
- **Errors:** `409 invalid_transition`.

### Generation Candidates

#### GET /api/generation-candidates

- **Query:** `generation_id`, `status[]`, `limit`, `cursor`.
- **Response:** records with suggested metadata.

#### PATCH /api/generation-candidates/:id

- **Request:** `{ "front": "...", "back": "...", "status": "edited" }`.
- Validates lengths, fingerprint uniqueness scoped to owner.

#### POST /api/generation-candidates/:id/accept

- **Description:** Atomically creates `flashcards` row (origin `ai-full` or `ai-edited`) and sets `accepted_card_id`.
- **Request:** optional overrides for metadata:

```json
{ "category_id": 1, "tag_ids": [2], "content_source_id": 5, "origin": "ai-edited" }
```

- **Response:** `201 Created` with flashcard DTO.
- **Errors:** `400 invalid_body`, `409 already_accepted`, `422 fingerprint_conflict`.

#### POST /api/generation-candidates/:id/reject

- Sets status `rejected`, records timestamp.

### Generation Error Logs (admin)

#### GET /api/admin/generation-error-logs

- **Query:** `user_id`, `model`, `from`, `to`, pagination.
- **Response:** list of logs for monitoring.
- **Errors:** `403 forbidden` for non-admin.

### Review Sessions & Events

#### POST /api/review-sessions

- **Description:** Persists batch of review outcomes and updates stats trigger-side.
- **Request:**

```json
{
  "session_id": "uuid",
  "started_at": "...",
  "completed_at": "...",
  "reviews": [
    {
      "card_id": "uuid",
      "outcome": "good",
      "response_time_ms": 4200,
      "prev_interval_days": 3,
      "next_interval_days": 5,
      "was_learning_step": false,
      "payload": { "deck": "networking" }
    }
  ]
}
```

- **Response:** `201 Created` with summary `{ "logged": 10 }`.
- **Validation:** `outcome ∈ review_outcome`, numeric ranges for intervals/time.

#### GET /api/review-events

- Lists user’s events; filters `card_id`, `from/to`, `limit`, `cursor`.

#### GET /api/review-stats

- Returns aggregated stats for user; filters `card_id`, `next_review_before`.

### Analytics KPI (admin)

#### GET /api/admin/kpi

- **Description:** Returns metrics required in PRD (acceptance rate of AI cards, AI/manual ratio, generation volume).
- **Query:** `range` (`7d|30d|custom` with `from/to`), `group_by` (`day|category|origin`).
- **Response:**

```json
{
  "ai_acceptance_rate": 0.78,
  "ai_share": 0.74,
  "totals": { "ai": 740, "manual": 260 },
  "trend": [{ "date": "2025-11-20", "ai": 30, "manual": 10, "accepted_ai": 25 }]
}
```

- **Errors:** `403 forbidden`.

### User Roles (admin)

#### GET /api/admin/user-roles

- Lists admin assignments for audit.

#### POST /api/admin/user-roles

- **Request:** `{ "user_id": "uuid", "role": "admin" }`.
- **Response:** `201 Created`.
- **Errors:** `409 role_exists`.

#### DELETE /api/admin/user-roles/:user_id/:role

- Removes role; `204 No Content`.

## 3. Authentication and Authorization

- **Mechanism:** Supabase Auth JWT; API verifies tokens via Supabase client on each request. Astro middleware (`src/middleware/index.ts`) injects session context.
- **Authorization:** Relies on Supabase RLS (policies described in `.ai/db-plan.md`). API-level guards enforce:
  - Ownership: queries use RPC/filters `owner_id = auth.uid()` unless `is_admin()`.
  - Admin routes: middleware checks `user_roles` for `admin`.
- **Rate Limiting:**
  - Global: e.g., 60 req/min per IP via Astro middleware.
  - Per-user custom: `POST /api/generations` uses stored proc to enforce single active job + 5/hour threshold, returning `429`.
- **Audit Logging:** Sensitive mutations (`user_roles`, admin analytics) log actor, timestamp, payload hash to `generation_error_logs` or separate audit channel.

## 4. Validation and Business Logic

- **Categories/Tags/Sources:** enforce uniqueness (`name`, `slug`), regex for slugs, `tags.name` length ≤64, `sources.url` must match `^https?://`, `kind` ∈ {`book`,`article`,`course`,`url`,`other`}, `color` hex.
- **Flashcards:**
  - `front ≤200`, `back ≤500`, `metadata` JSON schema (language, difficulty).
  - Duplicate prevention via `front_back_fingerprint`; API maps DB `23505` to `409 duplicate_flashcard`.
  - Soft delete by default; list endpoint excludes `deleted_at` unless `include_deleted`.
  - `origin` validated against enum (`card_origin`).
- **Generations:**
- `sanitized_input_text` sanitized; server enforces char length 1000–10000 and calculates SHA-256.
  - Status transitions limited to `pending/running -> cancelled/failed/succeeded`.
  - Only one active per user; request blocked if trigger raises exception, surfaced as `409`.
  - Worker updates `prompt_tokens`, `completed_at`, writes `generation_error_logs` on failure.
- **Generation Candidates:**
  - `front/back` same limits as flashcards.
  - Status flow `proposed -> edited -> {accepted,rejected}`.
  - `POST /accept` updates both candidate and flashcard in transaction to ensure `accepted_card_id` uniqueness.
- **Review Events/Stats:**
  - `outcome` enum `review_outcome`.
  - Non-negative integers for response time and intervals.
  - `review_stats` maintained by DB triggers; API only exposes R/O aggregates except admin overrides.

- **User Roles/Admin Endpoints:**
  - Only admins may mutate; attempts by non-admin receive `403`.
  - Validation ensures `role='admin'`.
- **Error Handling:**
  - Consistent JSON error envelope `{ "error": { "code": "duplicate_flashcard", "message": "..." } }`.
  - Database `CHECK` violations mapped to `422 unprocessable_entity`.
- **Business Logic Highlights:**
  - Accepting candidate automatically sets flashcard `origin` to `ai-full` unless `origin_override`.
  - `POST /review-sessions` triggers scheduling by writing `next_review_at`.
  - `GET /api/admin/kpi` reads from materialized view refreshed by cron to avoid heavy joins at request time; includes caching headers.
