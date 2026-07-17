-- INSERT ... RETURNING 시 SELECT 정책도 검사함.
-- 멤버 행이 아직 없으므로 owner_id로 본인 프로젝트를 읽을 수 있어야 함.
create policy "Owners can read own projects"
  on public.projects for select
  to authenticated
  using (owner_id = auth.uid());

-- 프로젝트 생성 시 owner를 project_members에 자동 추가
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();
