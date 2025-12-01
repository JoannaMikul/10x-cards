-- seed default categories for core study flows
begin;

insert into public.categories (name, slug, description, color)
values
    ('IT', 'it', 'Technical knowledge, tooling, software engineering', '#473472'),
    ('Language', 'language', 'Flashcards for foreign-language learning', '#f97316')
on conflict (slug) do update
set
    description = excluded.description,
    color = excluded.color,
    updated_at = timezone('utc', now());

commit;


