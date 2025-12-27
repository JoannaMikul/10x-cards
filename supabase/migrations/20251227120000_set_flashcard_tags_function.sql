begin;

create or replace function public.set_flashcard_tags(
    p_owner_id uuid,
    p_card_id uuid,
    p_tag_ids bigint[]
)
returns setof public.tags
language plpgsql
security invoker
set search_path = public
as $$
begin
    perform 1
      from public.flashcards
     where id = p_card_id
       and owner_id = p_owner_id
       and deleted_at is null
     for update;

    if not found then
        raise exception using errcode = 'P0001', message = 'flashcard_not_found';
    end if;

    delete from public.card_tags where card_id = p_card_id;

    if coalesce(array_length(p_tag_ids, 1), 0) > 0 then
        insert into public.card_tags(card_id, tag_id)
        select p_card_id, distinct_tag_id
        from (
            select distinct unnest(p_tag_ids) as distinct_tag_id
        ) as deduped
        where distinct_tag_id is not null;
    end if;

    update public.flashcards
       set updated_at = now()
     where id = p_card_id;

    return query
    select t.*
      from public.tags t
      join public.card_tags ct on ct.tag_id = t.id
     where ct.card_id = p_card_id
     order by t.id;
end;
$$;

revoke all on function public.set_flashcard_tags(uuid, uuid, bigint[]) from public;
grant execute on function public.set_flashcard_tags(uuid, uuid, bigint[]) to authenticated;

commit;


