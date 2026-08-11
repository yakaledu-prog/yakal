-- Categories are editorial metadata, so existing posts remain uncategorized
-- until an editor deliberately assigns one.
alter table public.blog_posts
  add column category text null,
  add constraint blog_posts_category_check
    check (
      category is null
      or category in ('Study Skills', 'Admissions', 'Parent Guide', 'Yakal News')
    );
