begin;

-- fix compute_generation_sha256 function to use extensions.digest function explicitly
create or replace function public.compute_generation_sha256()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    if new.sanitized_input_sha256 is null then
        new.sanitized_input_sha256 := extensions.digest(new.sanitized_input_text, 'sha256');
    end if;
    return new;
end;
$$;

commit;
