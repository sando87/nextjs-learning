alter table public.comments
  add column user_id uuid references auth.users (id);

drop policy "Allow public insert" on public.comments;

create policy "Allow authenticated insert own comment"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);
