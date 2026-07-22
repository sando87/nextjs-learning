-- 부모-자식 하이라키: parent_id 추가, 관련 업무(task_links) 제거

alter table public.tasks
  add column parent_id uuid references public.tasks (id) on delete cascade;

alter table public.tasks
  add constraint tasks_parent_not_self check (parent_id is distinct from id);

create index tasks_project_parent_idx on public.tasks (project_id, parent_id);

drop policy if exists "Members can read task_links" on public.task_links;
drop policy if exists "Members can manage task_links" on public.task_links;
drop table if exists public.task_links;
