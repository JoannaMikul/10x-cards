begin;

create or replace function public.restore_flashcard(
    p_card_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception using errcode = 'P0001', message = 'not_admin';
    end if;

    update public.flashcards
       set deleted_at = null,
           updated_at = now()
     where id = p_card_id
       and deleted_at is not null;

    if not found then
        raise exception using errcode = 'P0001', message = 'flashcard_not_found';
    end if;
end;
$$;

revoke all on function public.restore_flashcard(uuid) from public;
grant execute on function public.restore_flashcard(uuid) to authenticated;

commit;


