-- task / work_log 공통 변경 이력 (주간 Replay 복원용)
create table public.schedule_change_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'work_log')),
  entity_id uuid not null,
  task_id uuid references public.tasks (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in ('created', 'updated', 'deleted')),
  field text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index schedule_change_events_project_created_idx
  on public.schedule_change_events (project_id, created_at);

create index schedule_change_events_entity_idx
  on public.schedule_change_events (entity_type, entity_id);

alter table public.schedule_change_events enable row level security;

create policy "Members can read schedule_change_events"
  on public.schedule_change_events for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "Members can insert schedule_change_events"
  on public.schedule_change_events for insert
  to authenticated
  with check (public.is_project_member(project_id));
