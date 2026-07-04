create table public.health_check (
  id bigint generated always as identity primary key,
  message text not null default 'connected',
  created_at timestamptz not null default now()
);

alter table public.health_check enable row level security;

create policy "Allow public read"
  on public.health_check for select
  using (true);

insert into public.health_check (message) values ('connected');
