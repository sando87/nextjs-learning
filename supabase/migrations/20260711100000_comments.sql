create table public.comments (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index comments_slug_created_at_idx on public.comments (slug, created_at);

alter table public.comments enable row level security;

create policy "Allow public read"
  on public.comments for select
  using (true);

create policy "Allow public insert"
  on public.comments for insert
  with check (true);
