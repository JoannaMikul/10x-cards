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
    ('English', 'english', 'Language-learning and vocabulary'),
    ('Astro', 'astro', 'Astro framework topics'),
    ('Git', 'git', 'Version control with Git'),
    ('Vite', 'vite', 'Vite build tool and development'),
    ('Performance', 'performance', 'Web performance optimization'),
    ('A11y', 'a11y', 'Accessibility and inclusive design'),
    ('API', 'api', 'API design and development'),
    ('State Management', 'state-management', 'State management patterns and libraries'),
    ('SSR', 'ssr', 'Server-side rendering techniques'),
    ('Testowanie', 'testowanie', 'Testing methodologies and frameworks'),
    ('Vitest', 'vitest', 'Vitest testing framework'),
    ('Playwright', 'playwright', 'Playwright testing framework'),
    ('UI/UX', 'ui-ux', 'User interface and user experience design'),
    ('Algorithms', 'algorithms', 'Algorithm design and analysis'),
    ('Design Patterns', 'design-patterns', 'Software design patterns'),
    ('Security', 'security', 'Security best practices and vulnerabilities')
on conflict (slug) do update
set
    description = excluded.description,
    updated_at = timezone('utc', now());

commit;


