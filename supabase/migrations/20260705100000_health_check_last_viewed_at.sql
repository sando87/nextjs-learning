alter table public.health_check
  add column last_viewed_at timestamptz;

create policy "Allow public update last viewed at"
  on public.health_check for update
  using (true)
  with check (true);
