begin;

create or replace function public.accept_generation_candidate(
    p_owner_id uuid,
    p_candidate_id uuid,
    p_origin card_origin,
    p_category_id bigint default null,
    p_tag_ids bigint[] default array[]::bigint[],
    p_content_source_id bigint default null,
    p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_candidate public.generation_candidates%rowtype;
    v_new_card_id uuid;
    v_has_conflict boolean;
begin
    select *
    into v_candidate
    from public.generation_candidates
    where id = p_candidate_id
      and owner_id = p_owner_id
    for update;

    if not found then
        raise exception using errcode = 'P0001', message = 'candidate_not_found';
    end if;

    if v_candidate.accepted_card_id is not null or v_candidate.status = 'accepted' then
        raise exception using errcode = 'P0001', message = 'candidate_already_accepted';
    end if;

    select exists (
        select 1
        from public.flashcards f
        where f.owner_id = p_owner_id
          and f.front_back_fingerprint = v_candidate.front_back_fingerprint
          and f.deleted_at is null
    )
    into v_has_conflict;

    if v_has_conflict then
        raise exception using errcode = 'P0001', message = 'candidate_fingerprint_conflict';
    end if;

    insert into public.flashcards (
        owner_id,
        category_id,
        content_source_id,
        front,
        back,
        origin,
        metadata
    )
    values (
        p_owner_id,
        p_category_id,
        p_content_source_id,
        v_candidate.front,
        v_candidate.back,
        p_origin,
        coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_new_card_id;

    if coalesce(array_length(p_tag_ids, 1), 0) > 0 then
        insert into public.card_tags (card_id, tag_id)
        select v_new_card_id, distinct_tag_id
        from (
            select distinct unnest(p_tag_ids) as distinct_tag_id
        ) as tag_values
        where distinct_tag_id is not null;
    end if;

    update public.generation_candidates
    set status = 'accepted',
        accepted_card_id = v_new_card_id,
        updated_at = now()
    where id = v_candidate.id;

    return v_new_card_id;
end;
$$;

revoke all on function public.accept_generation_candidate(uuid, uuid, card_origin, bigint, bigint[], bigint, jsonb) from public;
grant execute on function public.accept_generation_candidate(uuid, uuid, card_origin, bigint, bigint[], bigint, jsonb) to authenticated;

commit;

