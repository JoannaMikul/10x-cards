-- seed default tags for common study topics
begin;

insert into public.tags (name, slug, description)
values
    ('AI', 'ai', 'Artificial intelligence topics'),
    ('JavaScript', 'javascript', 'Modern JavaScript ecosystem'),
    ('React', 'react', 'React and related tooling'),
    ('Next.js', 'nextjs', 'Next.js framework topics'),
    ('TypeScript', 'typescript', 'Type-safe JavaScript'),
    ('CSS', 'css', 'Styling, layouts, responsive design'),
    ('HTML', 'html', 'Semantic markup and browser APIs'),
    ('English', 'english', 'Language-learning and vocabulary')
on conflict (slug) do update
set
    description = excluded.description,
    updated_at = timezone('utc', now());

commit;


