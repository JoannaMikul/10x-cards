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

### Authentication & Authorization (Supabase)

- **Scope:** Supabase Auth endpoints (e.g. `/auth/v1/*`) are **out of scope** for this API plan (client talks to Supabase directly; we do not proxy them).
- **How requests are authenticated:** protected `/api/*` routes expect `Authorization: Bearer <supabase access token>`; the backend validates the token using Supabase and derives `userId` from it.
- **How access is authorized:** primarily via Postgres **RLS policies**; selected endpoints may additionally enforce app-level roles (e.g. “admin – planned”).
- **Public routes:** endpoints explicitly marked as public do not require a JWT (see notes in each endpoint section).

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

- **Description:** Public listing of content sources (books, articles, courses, URLs, others) used as flashcard metadata. Mirrors the contract of `/api/categories` and `/api/tags`.
- **Query params:**
  - `kind` – optional source-type filter; enum `{book,article,course,url,other,documentation,notes}`.
  - `search` – optional trimmed string (1..200 chars); case-insensitive `ILIKE` against `name` and `slug` with escaped patterns.
  - `limit` – default `20`, allowed `1..100`; backend fetches `limit + 1` rows to compute `has_more`.
  - `cursor` – optional Base64-encoded positive `id` of the previous page’s last item; invalid Base64 or `id ≤ 0` ⇒ `400 invalid_query`.
  - `sort` – default `name`; allowed `{name, created_at}` with an extra `id ASC` for deterministic ordering.
- **Pagination:** cursor-based on `id`; `next_cursor` encoded as Base64; no cursor ⇒ first page.
- **Response:**

```json
{
  "data": [
    {
      "id": 2,
      "name": "Effective TypeScript",
      "slug": "effective-typescript",
      "description": "Practical guide",
      "kind": "book",
      "url": "https://example.com/books/effective-typescript",
      "created_at": "2025-11-30T10:00:00.000Z",
      "updated_at": "2025-11-30T10:00:00.000Z"
    }
  ],
  "page": { "next_cursor": "Mg==", "has_more": true }
}
```

- **Success codes:** `200 OK`.
- **Errors:**

| Status | `error.code`       | Notes                                                                                              |
| ------ | ------------------ | -------------------------------------------------------------------------------------------------- |
| 400    | `invalid_query`    | Zod validation failure, empty `search`, invalid `kind/sort`, limit outside range, malformed cursor |
| 500    | `db_error`         | PostgREST/PostgreSQL failure; response includes `{ code, message }` from Supabase                  |
| 500    | `unexpected_error` | Missing Supabase client or other runtime failures (cursor decoding, etc.)                          |

- **Observability:** `recordSourcesEvent({ scope: "api/sources", userId: DEFAULT_USER_ID })` logs every 4xx/5xx payload.
- **Mocks:** `src/lib/mocks/sources.api.mocks.ts` (200 first page, 200 filtered page with cursor, 400 invalid cursor, 500 db error).

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

- **Description:** Creates a manual or AI‑backed flashcard for the authenticated user. The backend enforces field length limits, reference (FK) correctness, uniqueness via `front_back_fingerprint`, and RLS (`owner_id = auth.uid()`).
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt>` (required; in development the endpoint may operate with `DEFAULT_USER_ID` until full Auth is wired)
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

- **Validation:**
  - `front` — string, trimmed, length 1..200
  - `back` — string, trimmed, length 1..500
  - `origin` — enum: `ai-full | ai-edited | manual`
  - `category_id`, `content_source_id` — optional positive integers
  - `tag_ids` — optional array of positive integers, max 50, unique values
  - `metadata` — arbitrary JSON
  - Reference validation: ensure existence of `category_id`, `content_source_id`, and all `tag_ids`; missing → `404` with an appropriate code
  - Uniqueness: `(owner_id, front_back_fingerprint)` → conflict returned as `409 duplicate_flashcard`
- **Success:** `201 Created` with full `FlashcardDTO` record (including `tags`).
- **Errors:**

| Status | `error.code`           | Notes                                                                    |
| ------ | ---------------------- | ------------------------------------------------------------------------ |
| 400    | `invalid_body`         | Invalid JSON / Zod schema validation error                               |
| 401    | `unauthorized`         | Missing/invalid JWT (target state); in dev `DEFAULT_USER_ID` may be used |
| 404    | `category_not_found`   | The specified category does not exist                                    |
| 404    | `source_not_found`     | The specified content source does not exist                              |
| 404    | `tag_not_found`        | One or more tags do not exist                                            |
| 409    | `duplicate_flashcard`  | Collision on `front_back_fingerprint`                                    |
| 422    | `unprocessable_entity` | CHECK/FK violations surfaced from the DB                                 |
| 500    | `db_error`             | PostgREST/PostgreSQL failure (includes `{ code, message }`)              |
| 500    | `unexpected_error`     | Other unexpected runtime errors                                          |

- **Observability:** Every 4xx/5xx is logged as a structured JSON event via `recordFlashcardsEvent` (`scope: "api/flashcards"`, `userId = DEFAULT_USER_ID` in dev).
- **Mocks:** Contract examples live in `src/lib/mocks/flashcards.api.mocks.ts` (scenarios: 201, 400, 401, 404, 409, 422, 500).

#### GET /api/flashcards/:id

- Returns card if owner/admin; includes review stats snapshot.

#### PATCH /api/flashcards/:id

- Update or insert tags (replace set), updates metadata, resets `updated_at`.
- Soft-delete triggered by `deleted_at` provided.
- **Errors:** `404 not_found`, `409 duplicate_flashcard`.

#### DELETE /api/flashcards/:id

- Sets `deleted_at = now()` (soft delete). `204 No Content`.

#### POST /api/flashcards/:id/restore

- **Purpose:** Restores a soft-deleted card (clears `deleted_at`, refreshes `updated_at`) and returns the full `FlashcardDTO` with tags plus the owner's `review_stats` snapshot.
- **Authorization:** `Authorization: Bearer <jwt>`; the route is **admin-only**.
- **Body:** none (empty request).
- **Flow:**
  1. Guards ensure `locals.supabase` exists and the user is authenticated.
  2. Validate `id` with `flashcardIdParamSchema`.
  3. Verify admin privileges via `supabase.rpc("is_admin")`; `false` → `401 unauthorized`.
  4. Call `restoreFlashcard`, which executes the SQL function `restore_flashcard(p_card_id uuid)` and, on success, fetches the card, tags, and owner review stats.
- **Success:** `200 OK` + `FlashcardDTO` (with `deleted_at = null`).
- **Errors:**

| Status | `error.code`       | Scenario                                                                          |
| ------ | ------------------ | --------------------------------------------------------------------------------- |
| 400    | `invalid_query`    | Path parameter is not a valid UUID                                                |
| 401    | `unauthorized`     | Missing session or user is not an admin                                           |
| 404    | `not_found`        | Card does not exist or is not soft-deleted                                        |
| 500    | `db_error`         | PostgREST/PostgreSQL failure during RPC (e.g., `is_admin` or `restore_flashcard`) |
| 500    | `unexpected_error` | Any other runtime exception                                                       |

- **Observability:** All 4xx/5xx responses are logged via `recordRestoreEvent` (scope `api/flashcards/[id]/restore`, payload includes `userId`, `cardId`, DB details).
- **Mocks:** Contract scenarios for 200 / 401 (no auth) / 401 (non-admin) / 404 / 500 live in `src/lib/mocks/flashcards.api.mocks.ts`.

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
- **Request:** `GET /api/generations/{id}` where `id` is a UUID path param. Requires `Accept: application/json`.
- **Response 200:**

```json
{
  "generation": {
    "id": "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
    "model": "openrouter/gpt-4.1-mini",
    "status": "running",
    "temperature": 0.7,
    "prompt_tokens": 1280,
    "sanitized_input_length": 5600,
    "started_at": "2025-12-01T12:00:00.000Z",
    "completed_at": null,
    "created_at": "2025-12-01T11:58:00.000Z",
    "updated_at": "2025-12-01T12:00:30.000Z",
    "error_code": null,
    "error_message": null
  },
  "candidates_summary": {
    "total": 8,
    "by_status": {
      "proposed": 6,
      "edited": 1,
      "accepted": 1,
      "rejected": 0
    }
  }
}
```

- **Errors:**

| Status | `error.code`           | Trigger / note                                      |
| ------ | ---------------------- | --------------------------------------------------- |
| 400    | `invalid_params`       | Non-UUID path param                                 |
| 401    | `unauthorized`         | Missing/invalid Supabase JWT (future)               |
| 404    | `generation_not_found` | Record missing or belongs to a different user       |
| 500    | `db_error`             | Postgres/PostgREST failure when reading generations |
| 500    | `unexpected_error`     | Non-PostgREST runtime error                         |

- **Observability:** Emits `[api/generations/:id]` console events (see `recordGenerationDetailEvent`) and logs hash/length metadata via `logGenerationError` for server-side faults.
- **Mocks:** Contract examples (200/400/404/500) live in `src/lib/mocks/generations.api.mocks.ts`.

#### PATCH /api/generations/:id

- **Description:** Allows client-side cancellation of active AI generation jobs. Only transitions from `status ∈ ('pending','running')` to `'cancelled'` are permitted. Uses atomic database operations to prevent race conditions.
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt>` (required once auth wiring is finished; currently mocked by `DEFAULT_USER_ID`)
- **Request:**

```json
{ "status": "cancelled" }
```

- **Success response:** `200 OK`

```json
{
  "generation": {
    "id": "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
    "status": "cancelled",
    "completed_at": "2025-12-01T12:05:30.000Z",
    "updated_at": "2025-12-01T12:05:30.000Z"
  }
}
```

- **Error contract:** All errors follow `ApiErrorResponse`.

| Status | `error.code`           | Trigger                                                                       |
| ------ | ---------------------- | ----------------------------------------------------------------------------- |
| 400    | `invalid_params`       | Non-UUID path param                                                           |
| 400    | `invalid_payload`      | Invalid JSON / schema validation failure (only `status: "cancelled"` allowed) |
| 401    | `unauthorized`         | Missing/invalid Supabase JWT (future state)                                   |
| 404    | `generation_not_found` | Record missing or belongs to a different user                                 |
| 409    | `invalid_transition`   | Generation status is not `pending` or `running`                               |
| 500    | `db_error`             | Postgres/PostgREST failure during atomic update                               |
| 500    | `unexpected_error`     | Non-PostgREST runtime error                                                   |

- **Example error:**

```json
{
  "error": {
    "code": "invalid_transition",
    "message": "Generation cannot be cancelled as it is not in an active state."
  }
}
```

- **Observability:** Emits structured console events via `recordGenerationDetailEvent` (`scope: "api/generations/:id"`, `userId = DEFAULT_USER_ID` in dev). Logs hash/length metadata via `logGenerationError` for server-side faults.
- **Mocks:** Contract examples (200/400/404/409/500) live in `src/lib/mocks/generations.api.mocks.ts`.

### Generation Candidates

#### GET /api/generation-candidates

- **Description:** Returns cursor-paginated candidates for a specific generation owned by the current user, including AI-suggested metadata (`suggested_category_id`, `suggested_tags`). Consumers use it to review, edit, and accept/reject proposals.
- **Query params:**
  - `generation_id` (required UUID) – owning generation; endpoint verifies ownership via `getGenerationById`.
  - `status[]` (optional array of `proposed|edited|accepted|rejected`) – accepts repeated query params (`?status[]=proposed&status[]=edited`). Duplicates are deduplicated; array length capped at 4.
  - `limit` (optional int) – defaults to `20`, bounded to `1..100`. Handler fetches `limit + 1` rows to determine `has_more`.
  - `cursor` (optional string) – Base64-encoded candidate UUID representing the last item from the previous page. Decoded value must be a valid UUID; invalid Base64/UUID ⇒ `400 invalid_query`.
- **Pagination:** candidates ordered by `id ASC`. When there is another page, `next_cursor = base64(last_visible_id)`; otherwise `null`.
- **Response:**

```json
{
  "data": [
    {
      "id": "c1b38d86-d0a5-4e2d-a70b-02f4b0071b4a",
      "generation_id": "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
      "owner_id": "49e6ead8-c0d5-4747-8b8b-e70d650263b7",
      "front": "Czym różni się TCP od UDP?",
      "back": "TCP zapewnia niezawodną, połączeniową transmisję; UDP jest bezpołączeniowe...",
      "front_back_fingerprint": "4e6c3cfa05404f5ea266e7f0f86b1a52",
      "status": "proposed",
      "accepted_card_id": null,
      "suggested_category_id": 2,
      "suggested_tags": ["networking", "transport-layer"],
      "created_at": "2025-12-01T10:00:00.000Z",
      "updated_at": "2025-12-01T10:00:00.000Z"
    }
  ],
  "page": { "next_cursor": "YzFiMzhkODYtZDBhNS00ZTJkLWE3MGItMDJmNGIwMDcxYjRh", "has_more": true }
}
```

- **Success Codes:** `200 OK`.
- **Errors:**

| Status | `error.code`       | Notes                                                                                                   |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------------- |
| 400    | `invalid_query`    | Missing `generation_id`, invalid UUID, out-of-range `limit`, malformed Base64 cursor, bad status filter |
| 404    | `not_found`        | Generation not found or does not belong to the user                                                     |
| 500    | `db_error`         | PostgREST failure while verifying generation or fetching candidates                                     |
| 500    | `unexpected_error` | Missing Supabase client or non-DB runtime exception                                                     |

- **Observability:** Handler logs structured events via `recordCandidatesEvent` (`scope: "api/generation-candidates"`, `userId = DEFAULT_USER_ID`). Events capture query payloads for 4xx/5xx cases.
- **Mocks:** Contract fixtures (200, 400, 404, 500) live in `src/lib/mocks/generation-candidates.api.mocks.ts`.

#### PATCH /api/generation-candidates/:id

- **Description:** Partially updates a single candidate (`front`, `back`, `status`). Only records in `proposed` or `edited` statuses are allowed; other statuses return `404 not_found`.
- **Headers:** `Content-Type: application/json`.
- **Path params:** `id` (UUID) – candidate belonging to the user.
- **Request body (at least one field required):**
  - `front?: string (1..200, trim)` – new front content.
  - `back?: string (1..500, trim)` – new back content.
  - `status?: "edited"` – explicit marking of candidate as edited. If `front` or `back` are present and `status` is omitted, server automatically sets `"edited"`.
- **Business process:**
  1. Validate `params` (`getCandidateParamsSchema`). Invalid UUID → `400 invalid_params`.
  2. Attempt JSON parsing (`parseJsonBody`). Error → `400 invalid_body`.
  3. Validate payload (`updateGenerationCandidateSchema`). Rules: at least one field, character limits, `.strict()`.
  4. Construct `UpdateGenerationCandidateCommand` + `updated_at = now()`. Implicit `status: "edited"` when content changes.
  5. Call `updateCandidateForOwner`, which:
     - updates record (`eq owner_id`, `eq id`, `status in ("proposed","edited")`),
     - returns updated `GenerationCandidateDTO`.
  6. No match → `404 not_found`.
  7. Index violation `generation_candidates_owner_fingerprint_unique` mapped to `409 duplicate_candidate`.
- **Response 200:**

```json
{
  "candidate": {
    "id": "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
    "generation_id": "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
    "owner_id": "49e6ead8-c0d5-4747-8b8b-e70d650263b7",
    "front": "What is TCP three-way handshake?",
    "back": "SYN → SYN-ACK → ACK.",
    "front_back_fingerprint": "51b3022f1b8848fd9e430ad5a3dc1a2e",
    "status": "edited",
    "accepted_card_id": null,
    "suggested_category_id": 1,
    "suggested_tags": [2],
    "created_at": "2025-12-03T10:15:00.000Z",
    "updated_at": "2025-12-03T10:30:00.000Z"
  }
}
```

- **Errors:**

| Status | `error.code`          | Notes                                                                                |
| ------ | --------------------- | ------------------------------------------------------------------------------------ |
| 400    | `invalid_params`      | Path param not UUID                                                                  |
| 400    | `invalid_body`        | Invalid JSON, character limit violations, empty body                                 |
| 401    | `unauthorized`        | (future) missing JWT                                                                 |
| 404    | `not_found`           | Candidate does not exist, does not belong to user, or has `accepted/rejected` status |
| 409    | `duplicate_candidate` | Violation of `generation_candidates_owner_fingerprint_unique` index                  |
| 500    | `db_error`            | PostgREST/Postgres error                                                             |
| 500    | `unexpected_error`    | Missing Supabase client or other unnamed exception                                   |

- **Observability:** Console `recordUpdateEvent` (`scope: "api/generation-candidates/:id"`), level dependent on HTTP status.
- **Mocks:** Scenarios 200/400/404/409/500 available in `src/lib/mocks/generation-candidates.api.mocks.ts`.

#### POST /api/generation-candidates/:id/accept

- **Description:** Finalizes a single AI candidate by atomically creating a `flashcards` row and updating the candidate (`status = accepted`, `accepted_card_id = new_card_id`). Operation is entirely performed in SQL function `accept_generation_candidate(...)` (DB transaction), which eliminates the risk of orphaned records.
- **Headers:** `Content-Type: application/json`. Eventually also `Authorization: Bearer <jwt>`; currently `DEFAULT_USER_ID` is used.
- **Path params:** `id` (UUID) – identifier of candidate assigned to the user.
- **Request body (optional metadata overrides):**
  - `category_id?: number` – positive category ID (default `candidate.suggested_category_id`).
  - `tag_ids?: number[]` – array of positive, unique tag IDs (max 50). If missing → `candidate.suggested_tags` are used (after filtering to numbers).
  - `content_source_id?: number` – positive source ID (default `null`).
  - `origin?: "ai-full" | "ai-edited"` – no value → `"ai-edited"` for candidates in `edited` status, otherwise `"ai-full"`.
  - Body must be valid JSON; empty body treated as `{}`.
- **Business process:**
  1. Validate `params` (`getCandidateParamsSchema`) and `body` (`acceptGenerationCandidateSchema`). Errors reported as `400 invalid_body`.
  2. Fetch candidate (`getCandidateForOwner`). No record → `404 not_found`.
  3. Early conflict: when `accepted_card_id` is set → `409 already_accepted`.
  4. Pre-check fingerprint (`hasFingerprintConflict`) in `flashcards` table (`owner_id`, `front_back_fingerprint`, `deleted_at is null`). When match exists → `422 fingerprint_conflict`.
  5. Build final metadata (`origin`, `category_id`, `tag_ids`, `metadata.accepted_from_candidate_id`, `generation_id`, `candidate_fingerprint`).
  6. Call RPC `accept_generation_candidate`, which in one transaction:
     - locks candidate (`SELECT ... FOR UPDATE`),
     - verifies fingerprint conflict (second security level, mapped to `23505`),
     - creates `flashcards` record (with tags),
     - sets `status = accepted`, `accepted_card_id`.
  7. After RPC success, service fetches full `FlashcardDTO` (with tags) and returns it as `201` payload.
- **Response 201:**

```json
{
  "id": "b5e4a2d9-0a1b-4f2c-8a9d-3c7f1e2b4d6a",
  "front": "What is TCP three-way handshake?",
  "back": "SYN, SYN-ACK, ACK.",
  "origin": "ai-edited",
  "metadata": {
    "accepted_from_candidate_id": "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
    "generation_id": "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
    "candidate_fingerprint": "…"
  },
  "category_id": 1,
  "content_source_id": 5,
  "owner_id": "49e6ead8-c0d5-4747-8b8b-e70d650263b7",
  "created_at": "…",
  "updated_at": "…",
  "deleted_at": null,
  "tags": [
    { "id": 2, "name": "networking", "slug": "networking", "description": "…", "created_at": "…", "updated_at": "…" }
  ]
}
```

- **Errors:**

| Status | `error.code`           | Description                                                                                    |
| ------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| 400    | `invalid_body`         | Invalid JSON or Zod validation errors (`category_id`, `tag_ids`, `origin`, etc.)               |
| 401    | `unauthorized`         | Eventually missing authentication (not implemented)                                            |
| 404    | `not_found`            | Candidate does not exist or does not belong to user                                            |
| 409    | `already_accepted`     | Candidate already has `accepted_card_id` or `accepted` status                                  |
| 422    | `fingerprint_conflict` | Active flashcard of user with same fingerprint exists (pre-check or uniqueness in transaction) |
| 422    | `unprocessable_entity` | FK/CHECK error during flashcard creation (e.g. category/tag does not exist)                    |
| 500    | `db_error`             | PostgREST/PG error returned by RPC function                                                    |
| 500    | `unexpected_error`     | Other unexpected exceptions (missing Supabase client, missing candidate fingerprint, etc.)     |

- **Observability:** Endpoint logs every 4xx/5xx (and success 201) via `recordAcceptEvent` (`scope: "api/generation-candidates/:id/accept"`, `userId = DEFAULT_USER_ID`) with metadata (`candidateId`, `fingerprint`, `flashcardId`).
- **Mocks:** Contract scenarios (201, 400, 404, 409, 422 fingerprint, 422 FK, 500) added to `src/lib/mocks/generation-candidates.api.mocks.ts`.

#### POST /api/generation-candidates/:id/reject

- **Description:** Rejects a single candidate (`status = rejected`, `updated_at = now()`). Operation is idempotent — repeated call on already rejected candidate returns `200 OK` with current state without database changes. Candidate in `accepted` status cannot be reverted.
- **Headers:** (optional) `Content-Type: application/json`. Body must be empty (`{}`) or completely omitted.
- **Path params:** `id` (UUID) – candidate belonging to the user.
- **Body:** none (`RejectGenerationCandidateCommand = Record<string, never>`). Any field in body → `400 invalid_body`.
- **Business process:**
  1. Validate `params` (`getCandidateParamsSchema`); invalid UUID → `400 invalid_params`.
  2. If `Content-Length > 0`, server attempts to parse JSON. Parse error or non-empty body → `400 invalid_body`.
  3. Call `rejectCandidateForOwner`, which conditionally updates record (`eq owner_id`, `eq id`, `status ∈ {proposed, edited}`, `accepted_card_id IS NULL`). Success → `200 { candidate }`.
  4. When update returns no record:
     - `getCandidateForOwner` fetches current state.
     - No record → `404 not_found`.
     - `status = accepted` or `accepted_card_id != null` → `409 invalid_transition`.
     - `status = rejected` → idempotent `200 OK` with current candidate.
     - Any other status ⇒ treated as `404 not_found` (cannot reject).
- **Response 200:**

```json
{
  "candidate": {
    "id": "6a4b1d8c-6bb3-48b6-a4d6-9f8f2d3b5e9c",
    "generation_id": "0a4f02a0-8ddc-4c02-8714-5b3469d3b0ac",
    "owner_id": "49e6ead8-c0d5-4747-8b8b-e70d650263b7",
    "front": "What is TCP three-way handshake?",
    "back": "SYN → SYN-ACK → ACK.",
    "front_back_fingerprint": "51b3022f1b8848fd9e430ad5a3dc1a2e",
    "status": "rejected",
    "accepted_card_id": null,
    "suggested_category_id": 1,
    "suggested_tags": [2],
    "created_at": "2025-12-03T10:15:00.000Z",
    "updated_at": "2025-12-03T11:00:00.000Z"
  }
}
```

- **Errors:**

| Status | `error.code`         | Description                                                                                         |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------- |
| 400    | `invalid_params`     | Path param not UUID                                                                                 |
| 400    | `invalid_body`       | Invalid JSON or body contains fields other than allowed `{}`                                        |
| 401    | `unauthorized`       | (future) missing JWT                                                                                |
| 404    | `not_found`          | Candidate does not exist, does not belong to user, or has status outside `proposed/edited/rejected` |
| 409    | `invalid_transition` | Transition from `accepted`/`accepted_card_id != null` to `rejected` is blocked                      |
| 500    | `db_error`           | PostgREST/Postgres error during update                                                              |
| 500    | `unexpected_error`   | Missing Supabase client, unexpected runtime exception                                               |

- **Observability:** `recordRejectEvent` (`scope: "api/generation-candidates/:id/reject"`, `userId = DEFAULT_USER_ID`) logs all 4xx/5xx and successes (newly rejected or idempotent).
- **Mocks:** Contract scenarios (200 newly rejected, 200 idempotent, 400 invalid_params, 400 invalid_body, 404 not_found, 409 invalid_transition, 500 db_error) should be maintained in `src/lib/mocks/generation-candidates.api.mocks.ts`.

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
  - Status transitions limited to `pending/running -> cancelled/failed/succeeded`; PATCH endpoint validates transitions and returns `409 invalid_transition` for invalid attempts.
  - Only one active per user; request blocked if trigger raises exception, surfaced as `409`.
  - Worker updates `prompt_tokens`, `completed_at`, writes `generation_error_logs` on failure.
  - PATCH `/api/generations/:id` allows atomic cancellation with race condition protection.
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
