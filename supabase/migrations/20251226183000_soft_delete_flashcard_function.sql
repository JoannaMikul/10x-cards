begin;

create or replace function public.soft_delete_flashcard(
    p_owner_id uuid,
    p_card_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.flashcards
    set deleted_at = now(),
        updated_at = now()
    where id = p_card_id
      and owner_id = p_owner_id
      and deleted_at is null;

    if not found then
        raise exception using errcode = 'P0001', message = 'flashcard_not_found';
    end if;
end;
$$;

revoke all on function public.soft_delete_flashcard(uuid, uuid) from public;
grant execute on function public.soft_delete_flashcard(uuid, uuid) to authenticated;

commit;

