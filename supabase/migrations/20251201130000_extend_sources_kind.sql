-- extend allowed source kinds with documentation & notes and seed default records
begin;

alter table public.sources
    drop constraint if exists sources_kind_check;

alter table public.sources
    add constraint sources_kind_check
        check (kind in ('book', 'article', 'course', 'url', 'other', 'documentation', 'notes'));

insert into public.sources (name, slug, description, kind, url)
values
    (
        'React – Official Docs',
        'react-official-docs',
        'React core documentation at react.dev',
        'documentation',
        'https://react.dev/'
    ),
    (
        'Personal Notes',
        'personal-notes',
        'Internal study notes for flashcards',
        'notes',
        null
    ),
    (
        'Next.js – Official Docs',
        'nextjs-official-docs',
        'Next.js reference docs at nextjs.org/docs',
        'documentation',
        'https://nextjs.org/docs'
    ),
    (
        'Medium – Featured Article',
        'medium-featured-article',
        'Representative article sourced from Medium platform',
        'article',
        'https://medium.com/'
    )
on conflict (slug) do update
set
    description = excluded.description,
    kind = excluded.kind,
    url = excluded.url,
    updated_at = timezone('utc', now());

commit;

