-- migration metadata:
-- purpose: add RPC function for logging generation errors with proper RLS handling
-- touches: functions log_generation_error

begin;

-- function to safely log generation errors from user context
create or replace function public.log_generation_error(
  p_user_id uuid,
  p_model text,
  p_error_code text,
  p_error_message text,
  p_source_text_hash bytea,
  p_source_text_length integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- validate required parameters
  if p_user_id is null then
    raise exception 'user_id cannot be null';
  end if;

  if p_model is null or trim(p_model) = '' then
    raise exception 'model cannot be null or empty';
  end if;

  if p_error_code is null or trim(p_error_code) = '' then
    raise exception 'error_code cannot be null or empty';
  end if;

  if p_error_message is null or trim(p_error_message) = '' then
    raise exception 'error_message cannot be null or empty';
  end if;

  if p_source_text_hash is null then
    raise exception 'source_text_hash cannot be null';
  end if;

  if p_source_text_length is null or p_source_text_length <= 0 then
    raise exception 'source_text_length must be a positive integer';
  end if;

  -- verify the user exists (optional - for data integrity)
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user does not exist';
  end if;

  -- insert the error log
  insert into public.generation_error_logs (
    user_id,
    model,
    error_code,
    error_message,
    source_text_hash,
    source_text_length
  ) values (
    p_user_id,
    trim(p_model),
    trim(p_error_code),
    trim(p_error_message),
    p_source_text_hash,
    p_source_text_length
  );

end;
$$;

-- grant execute permission to authenticated users
grant execute on function public.log_generation_error(
  uuid, text, text, text, bytea, integer
) to authenticated;

commit;
