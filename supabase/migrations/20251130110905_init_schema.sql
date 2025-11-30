-- migration metadata:
-- purpose: establish the initial 10x-cards domain schema (extensions, types, helper functions, tables, indexes, triggers, rls).
-- touches: extensions citext/pg_trgm/pgcrypto/unaccent, enums card_origin/generation_status/candidate_status/review_outcome, functions normalize_flashcard_text/is_admin/enforce_generation_rate_limit/sync_review_stats, tables user_roles/categories/tags/sources/flashcards/card_tags/generations/generation_candidates/generation_error_logs/review_events/review_stats plus all supporting indexes and policies.
-- notes: every table has row level security enabled, destructive statements are avoided, and triggers protect data integrity and sr metrics.

begin;

-- ensure required extensions exist for case-insensitive text, trigram search, crypto hashing, and text normalization.
create extension if not exists citext with schema public;
create extension if not exists pg_trgm with schema public;
create extension if not exists pgcrypto with schema public;
create extension if not exists unaccent with schema public;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'card_origin') then
        create type card_origin as enum ('ai-full', 'ai-edited', 'manual');
    end if;
    if not exists (select 1 from pg_type where typname = 'generation_status') then
        create type generation_status as enum ('pending', 'running', 'succeeded', 'failed', 'cancelled');
    end if;
    if not exists (select 1 from pg_type where typname = 'candidate_status') then
        create type candidate_status as enum ('proposed', 'edited', 'accepted', 'rejected');
    end if;
    if not exists (select 1 from pg_type where typname = 'review_outcome') then
        create type review_outcome as enum ('fail', 'hard', 'good', 'easy', 'again');
    end if;
end;
$$;

-- helper to normalize flashcard faces for deduplication.
create or replace function public.normalize_flashcard_text(front text, back text)
returns text
language sql
immutable
as $$
    select trim(
        regexp_replace(
            regexp_replace(
                unaccent(lower(coalesce(front, '') || ' ' || coalesce(back, ''))),
                '\s+',
                ' ',
                'g'
            ),
            '\u00a0',
            ' ',
            'g'
        )
    );
$$;

-- user role mapping used for admin checks.
create table public.user_roles (
    user_id uuid not null references auth.users (id) on delete cascade,
    role text not null check (role = 'admin'),
    granted_at timestamptz not null default now(),
    primary key (user_id, role)
);

-- security helper to elevate admins in rls checks.
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        return false;
    end if;

    return exists (
        select 1
        from public.user_roles ur
        where ur.user_id = v_user_id
          and ur.role = 'admin'
    );
end;
$$;

-- card grouping metadata (categories).
create table public.categories (
    id bigserial primary key,
    name citext not null unique,
    slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
    description text,
    color text check (color ~ '^#[0-9a-f]{6}$'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- tagging metadata (mirrors categories with tighter length and no color).
create table public.tags (
    id bigserial primary key,
    name citext not null unique check (char_length(name) <= 64),
    slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- content sources (books, urls, etc.).
create table public.sources (
    id bigserial primary key,
    name citext not null unique,
    slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
    kind text not null check (kind in ('book', 'article', 'course', 'url', 'other')),
    url text check (url ~ '^https?://'),
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- flashcards owned by users with deduplication fingerprints and soft-delete flag.
create table public.flashcards (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id),
    category_id bigint references public.categories (id) on delete set null,
    content_source_id bigint references public.sources (id) on delete set null,
    front text not null check (char_length(front) <= 200),
    back text not null check (char_length(back) <= 500),
    front_back_fingerprint text generated always as (public.normalize_flashcard_text(front, back)) stored,
    origin card_origin not null,
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- m2m table between flashcards and tags.
create table public.card_tags (
    card_id uuid not null references public.flashcards (id) on delete cascade,
    tag_id bigint not null references public.tags (id) on delete restrict,
    created_at timestamptz not null default now(),
    primary key (card_id, tag_id)
);

-- generation jobs powering ai pipelines.
create table public.generations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id),
    status generation_status not null default 'pending',
    model text not null,
    sanitized_input_text text not null check (char_length(sanitized_input_text) between 1000 and 10000),
    sanitized_input_length integer generated always as (char_length(sanitized_input_text)) stored,
    sanitized_input_sha256 bytea generated always as (digest(sanitized_input_text, 'sha256'::text)) stored,
    prompt_tokens integer check (prompt_tokens >= 0),
    temperature numeric(3, 2) check (temperature between 0 and 2),
    started_at timestamptz,
    completed_at timestamptz,
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- candidate cards produced during a generation flow.
create table public.generation_candidates (
    id uuid primary key default gen_random_uuid(),
    generation_id uuid not null references public.generations (id) on delete cascade,
    owner_id uuid not null references auth.users (id),
    status candidate_status not null default 'proposed',
    front text not null check (char_length(front) <= 200),
    back text not null check (char_length(back) <= 500),
    front_back_fingerprint text generated always as (public.normalize_flashcard_text(front, back)) stored,
    suggested_category_id bigint references public.categories (id) on delete set null,
    suggested_tags jsonb,
    accepted_card_id uuid unique references public.flashcards (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- audit table for generation errors (partition-ready).
create table public.generation_error_logs (
    id bigserial primary key,
    user_id uuid not null references auth.users (id),
    model text not null,
    source_text_hash bytea not null,
    source_text_length integer not null,
    error_code text not null,
    error_message text not null,
    created_at timestamptz not null default now()
);

-- spaced repetition review events.
create table public.review_events (
    id bigserial primary key,
    user_id uuid not null references auth.users (id),
    card_id uuid not null references public.flashcards (id),
    reviewed_at timestamptz not null default now(),
    outcome review_outcome not null,
    response_time_ms integer check (response_time_ms >= 0),
    prev_interval_days integer,
    next_interval_days integer check (next_interval_days >= 0),
    was_learning_step boolean not null default false,
    payload jsonb
);

-- denormalized stats per (user, card) maintained via trigger.
create table public.review_stats (
    user_id uuid not null references auth.users (id),
    card_id uuid not null references public.flashcards (id) on delete cascade,
    total_reviews integer not null default 0,
    successes integer not null default 0,
    consecutive_successes integer not null default 0,
    last_outcome review_outcome,
    last_reviewed_at timestamptz,
    next_review_at timestamptz,
    last_interval_days integer,
    aggregates jsonb,
    primary key (user_id, card_id)
);

-- trigger helper preventing more than 5 generations per hour per user.
create or replace function public.enforce_generation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cutoff timestamptz := now() - interval '1 hour';
    v_request_count integer;
begin
    if new.user_id is null then
        return new;
    end if;

    select count(1)
    into v_request_count
    from public.generations g
    where g.user_id = new.user_id
      and g.created_at >= v_cutoff;

    if v_request_count >= 5 then
        raise exception 'generation_rate_limit_exceeded'
            using detail = 'użytkownik osiągnął limit 5 żądań generacji na godzinę',
                  hint = 'spróbuj ponownie później lub skontaktuj się z administratorem';
    end if;

    return new;
end;
$$;

create trigger generations_before_insert_rate_limit
    before insert on public.generations
    for each row
    execute function public.enforce_generation_rate_limit();

-- trigger helper syncing review_stats after each review event.
create or replace function public.sync_review_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_success integer := case when new.outcome in ('good', 'easy') then 1 else 0 end;
    v_next_review_at timestamptz := case
        when new.next_interval_days is null then null
        else new.reviewed_at + make_interval(days => new.next_interval_days)
    end;
begin
    insert into public.review_stats (
        user_id,
        card_id,
        total_reviews,
        successes,
        consecutive_successes,
        last_outcome,
        last_reviewed_at,
        next_review_at,
        last_interval_days,
        aggregates
    )
    values (
        new.user_id,
        new.card_id,
        1,
        v_success,
        case when v_success = 1 then 1 else 0 end,
        new.outcome,
        new.reviewed_at,
        v_next_review_at,
        new.next_interval_days,
        jsonb_build_object(
            'last_response_time_ms', new.response_time_ms,
            'was_learning_step', new.was_learning_step
        )
    )
    on conflict (user_id, card_id) do update
    set total_reviews = public.review_stats.total_reviews + 1,
        successes = public.review_stats.successes + v_success,
        consecutive_successes = case
            when v_success = 1 then public.review_stats.consecutive_successes + 1
            else 0
        end,
        last_outcome = new.outcome,
        last_reviewed_at = new.reviewed_at,
        next_review_at = v_next_review_at,
        last_interval_days = new.next_interval_days,
        aggregates = coalesce(public.review_stats.aggregates, '{}'::jsonb) || jsonb_build_object(
            'last_response_time_ms', new.response_time_ms,
            'was_learning_step', new.was_learning_step
        );

    return new;
end;
$$;

create trigger review_events_after_insert_sync_stats
    after insert on public.review_events
    for each row
    execute function public.sync_review_stats();

-- indexes for performance and data integrity beyond primary/unique keys.
create unique index flashcards_owner_fingerprint_unique
    on public.flashcards (owner_id, front_back_fingerprint)
    where deleted_at is null;

create index flashcards_owner_created_idx
    on public.flashcards (owner_id, created_at desc);

create index flashcards_category_idx
    on public.flashcards (category_id);

create index flashcards_content_source_idx
    on public.flashcards (content_source_id);

create index flashcards_front_trgm_idx
    on public.flashcards using gin (front gin_trgm_ops);

create index flashcards_back_trgm_idx
    on public.flashcards using gin (back gin_trgm_ops);

create index card_tags_tag_idx
    on public.card_tags (tag_id);

create unique index generations_active_per_user_unique
    on public.generations (user_id)
    where status in ('pending', 'running');

create index generations_user_created_idx
    on public.generations (user_id, created_at desc);

create index generations_status_idx
    on public.generations (status);

create unique index generation_candidates_owner_fingerprint_unique
    on public.generation_candidates (owner_id, front_back_fingerprint)
    where status in ('proposed', 'edited');

create index generation_candidates_generation_status_idx
    on public.generation_candidates (generation_id, status);

create index generation_error_logs_created_idx
    on public.generation_error_logs (created_at desc);

create index generation_error_logs_user_created_idx
    on public.generation_error_logs (user_id, created_at desc);

create index review_events_user_reviewed_idx
    on public.review_events (user_id, reviewed_at desc);

create index review_events_card_reviewed_idx
    on public.review_events (card_id, reviewed_at desc);

create index review_stats_card_next_review_idx
    on public.review_stats (card_id, next_review_at);

create unique index categories_slug_unique_idx
    on public.categories (slug);

create unique index tags_slug_unique_idx
    on public.tags (slug);

create unique index sources_slug_unique_idx
    on public.sources (slug);

-- enable row level security for every table defined above.
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.sources enable row level security;
alter table public.flashcards enable row level security;
alter table public.card_tags enable row level security;
alter table public.generations enable row level security;
alter table public.generation_candidates enable row level security;
alter table public.generation_error_logs enable row level security;
alter table public.review_events enable row level security;
alter table public.review_stats enable row level security;

-- rls policies (separated per role and action to keep intent explicit).

-- user_roles: only admins may manage assignments.
create policy user_roles_select_authenticated_admins
    on public.user_roles
    for select
    to authenticated
    using (public.is_admin());

create policy user_roles_insert_authenticated_admins
    on public.user_roles
    for insert
    to authenticated
    with check (public.is_admin());

create policy user_roles_delete_authenticated_admins
    on public.user_roles
    for delete
    to authenticated
    using (public.is_admin());

-- categories: everyone can read, only admins write.
create policy categories_select_anon_all
    on public.categories
    for select
    to anon
    using (true);

create policy categories_select_authenticated_all
    on public.categories
    for select
    to authenticated
    using (true);

create policy categories_insert_authenticated_admins
    on public.categories
    for insert
    to authenticated
    with check (public.is_admin());

create policy categories_update_authenticated_admins
    on public.categories
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy categories_delete_authenticated_admins
    on public.categories
    for delete
    to authenticated
    using (public.is_admin());

-- tags: mirror categories permissions.
create policy tags_select_anon_all
    on public.tags
    for select
    to anon
    using (true);

create policy tags_select_authenticated_all
    on public.tags
    for select
    to authenticated
    using (true);

create policy tags_insert_authenticated_admins
    on public.tags
    for insert
    to authenticated
    with check (public.is_admin());

create policy tags_update_authenticated_admins
    on public.tags
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy tags_delete_authenticated_admins
    on public.tags
    for delete
    to authenticated
    using (public.is_admin());

-- sources: public reads, admins mutate.
create policy sources_select_anon_all
    on public.sources
    for select
    to anon
    using (true);

create policy sources_select_authenticated_all
    on public.sources
    for select
    to authenticated
    using (true);

create policy sources_insert_authenticated_admins
    on public.sources
    for insert
    to authenticated
    with check (public.is_admin());

create policy sources_update_authenticated_admins
    on public.sources
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy sources_delete_authenticated_admins
    on public.sources
    for delete
    to authenticated
    using (public.is_admin());

-- flashcards: owners and admins can fully manage, anon policies exist for completeness but still require auth.uid().
create policy flashcards_select_anon_owner_or_admin
    on public.flashcards
    for select
    to anon
    using (
        (owner_id = auth.uid() or public.is_admin())
        and (deleted_at is null or public.is_admin())
    );

create policy flashcards_select_authenticated_owner_or_admin
    on public.flashcards
    for select
    to authenticated
    using (
        (owner_id = auth.uid() or public.is_admin())
        and (deleted_at is null or public.is_admin())
    );

create policy flashcards_insert_anon_owner_or_admin
    on public.flashcards
    for insert
    to anon
    with check (owner_id = auth.uid() or public.is_admin());

create policy flashcards_insert_authenticated_owner_or_admin
    on public.flashcards
    for insert
    to authenticated
    with check (owner_id = auth.uid() or public.is_admin());

create policy flashcards_update_anon_owner_or_admin
    on public.flashcards
    for update
    to anon
    using (owner_id = auth.uid() or public.is_admin())
    with check (owner_id = auth.uid() or public.is_admin());

create policy flashcards_update_authenticated_owner_or_admin
    on public.flashcards
    for update
    to authenticated
    using (owner_id = auth.uid() or public.is_admin())
    with check (owner_id = auth.uid() or public.is_admin());

create policy flashcards_delete_anon_owner_or_admin
    on public.flashcards
    for delete
    to anon
    using (owner_id = auth.uid() or public.is_admin());

create policy flashcards_delete_authenticated_owner_or_admin
    on public.flashcards
    for delete
    to authenticated
    using (owner_id = auth.uid() or public.is_admin());

-- card_tags: align visibility with owning flashcard.
create policy card_tags_select_anon_linked_owner_or_admin
    on public.card_tags
    for select
    to anon
    using (
        exists (
            select 1
            from public.flashcards f
            where f.id = card_id
              and (f.owner_id = auth.uid() or public.is_admin())
              and (f.deleted_at is null or public.is_admin())
        )
    );

create policy card_tags_select_authenticated_linked_owner_or_admin
    on public.card_tags
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.flashcards f
            where f.id = card_id
              and (f.owner_id = auth.uid() or public.is_admin())
              and (f.deleted_at is null or public.is_admin())
        )
    );

create policy card_tags_insert_anon_linked_owner_or_admin
    on public.card_tags
    for insert
    to anon
    with check (
        exists (
            select 1
            from public.flashcards f
            where f.id = card_id
              and (f.owner_id = auth.uid() or public.is_admin())
              and (f.deleted_at is null or public.is_admin())
        )
    );

create policy card_tags_insert_authenticated_linked_owner_or_admin
    on public.card_tags
    for insert
    to authenticated
    with check (
        exists (
            select 1
            from public.flashcards f
            where f.id = card_id
              and (f.owner_id = auth.uid() or public.is_admin())
              and (f.deleted_at is null or public.is_admin())
        )
    );

create policy card_tags_delete_anon_linked_owner_or_admin
    on public.card_tags
    for delete
    to anon
    using (
        exists (
            select 1
            from public.flashcards f
            where f.id = card_id
              and (f.owner_id = auth.uid() or public.is_admin())
        )
    );

create policy card_tags_delete_authenticated_linked_owner_or_admin
    on public.card_tags
    for delete
    to authenticated
    using (
        exists (
            select 1
            from public.flashcards f
            where f.id = card_id
              and (f.owner_id = auth.uid() or public.is_admin())
        )
    );

-- generations tied to user ownership.
create policy generations_select_anon_owner_or_admin
    on public.generations
    for select
    to anon
    using (user_id = auth.uid() or public.is_admin());

create policy generations_select_authenticated_owner_or_admin
    on public.generations
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_admin());

create policy generations_insert_anon_owner_or_admin
    on public.generations
    for insert
    to anon
    with check (user_id = auth.uid() or public.is_admin());

create policy generations_insert_authenticated_owner_or_admin
    on public.generations
    for insert
    to authenticated
    with check (user_id = auth.uid() or public.is_admin());

create policy generations_update_anon_owner_or_admin
    on public.generations
    for update
    to anon
    using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());

create policy generations_update_authenticated_owner_or_admin
    on public.generations
    for update
    to authenticated
    using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());

create policy generations_delete_anon_owner_or_admin
    on public.generations
    for delete
    to anon
    using (user_id = auth.uid() or public.is_admin());

create policy generations_delete_authenticated_owner_or_admin
    on public.generations
    for delete
    to authenticated
    using (user_id = auth.uid() or public.is_admin());

-- generation candidates owned by creator.
create policy generation_candidates_select_anon_owner_or_admin
    on public.generation_candidates
    for select
    to anon
    using (owner_id = auth.uid() or public.is_admin());

create policy generation_candidates_select_authenticated_owner_or_admin
    on public.generation_candidates
    for select
    to authenticated
    using (owner_id = auth.uid() or public.is_admin());

create policy generation_candidates_insert_anon_owner_or_admin
    on public.generation_candidates
    for insert
    to anon
    with check (owner_id = auth.uid() or public.is_admin());

create policy generation_candidates_insert_authenticated_owner_or_admin
    on public.generation_candidates
    for insert
    to authenticated
    with check (owner_id = auth.uid() or public.is_admin());

create policy generation_candidates_update_anon_owner_or_admin
    on public.generation_candidates
    for update
    to anon
    using (owner_id = auth.uid() or public.is_admin())
    with check (owner_id = auth.uid() or public.is_admin());

create policy generation_candidates_update_authenticated_owner_or_admin
    on public.generation_candidates
    for update
    to authenticated
    using (owner_id = auth.uid() or public.is_admin())
    with check (owner_id = auth.uid() or public.is_admin());

create policy generation_candidates_delete_anon_owner_or_admin
    on public.generation_candidates
    for delete
    to anon
    using (owner_id = auth.uid() or public.is_admin());

create policy generation_candidates_delete_authenticated_owner_or_admin
    on public.generation_candidates
    for delete
    to authenticated
    using (owner_id = auth.uid() or public.is_admin());

-- generation error logs: admins only (no anon policy to avoid leakage).
create policy generation_error_logs_select_authenticated_admins
    on public.generation_error_logs
    for select
    to authenticated
    using (public.is_admin());

create policy generation_error_logs_insert_authenticated_admins
    on public.generation_error_logs
    for insert
    to authenticated
    with check (public.is_admin());

create policy generation_error_logs_update_authenticated_admins
    on public.generation_error_logs
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy generation_error_logs_delete_authenticated_admins
    on public.generation_error_logs
    for delete
    to authenticated
    using (public.is_admin());

-- review events: scoped to event owner.
create policy review_events_select_anon_owner_or_admin
    on public.review_events
    for select
    to anon
    using (user_id = auth.uid() or public.is_admin());

create policy review_events_select_authenticated_owner_or_admin
    on public.review_events
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_admin());

create policy review_events_insert_anon_owner_or_admin
    on public.review_events
    for insert
    to anon
    with check (user_id = auth.uid() or public.is_admin());

create policy review_events_insert_authenticated_owner_or_admin
    on public.review_events
    for insert
    to authenticated
    with check (user_id = auth.uid() or public.is_admin());

create policy review_events_update_anon_owner_or_admin
    on public.review_events
    for update
    to anon
    using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());

create policy review_events_update_authenticated_owner_or_admin
    on public.review_events
    for update
    to authenticated
    using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());

create policy review_events_delete_anon_owner_or_admin
    on public.review_events
    for delete
    to anon
    using (user_id = auth.uid() or public.is_admin());

create policy review_events_delete_authenticated_owner_or_admin
    on public.review_events
    for delete
    to authenticated
    using (user_id = auth.uid() or public.is_admin());

-- review stats: derived data but still user-owned for reads/writes.
create policy review_stats_select_anon_owner_or_admin
    on public.review_stats
    for select
    to anon
    using (user_id = auth.uid() or public.is_admin());

create policy review_stats_select_authenticated_owner_or_admin
    on public.review_stats
    for select
    to authenticated
    using (user_id = auth.uid() or public.is_admin());

create policy review_stats_insert_anon_owner_or_admin
    on public.review_stats
    for insert
    to anon
    with check (user_id = auth.uid() or public.is_admin());

create policy review_stats_insert_authenticated_owner_or_admin
    on public.review_stats
    for insert
    to authenticated
    with check (user_id = auth.uid() or public.is_admin());

create policy review_stats_update_anon_owner_or_admin
    on public.review_stats
    for update
    to anon
    using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());

create policy review_stats_update_authenticated_owner_or_admin
    on public.review_stats
    for update
    to authenticated
    using (user_id = auth.uid() or public.is_admin())
    with check (user_id = auth.uid() or public.is_admin());

create policy review_stats_delete_anon_owner_or_admin
    on public.review_stats
    for delete
    to anon
    using (user_id = auth.uid() or public.is_admin());

create policy review_stats_delete_authenticated_owner_or_admin
    on public.review_stats
    for delete
    to authenticated
    using (user_id = auth.uid() or public.is_admin());

commit;

