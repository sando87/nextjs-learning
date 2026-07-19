-- 업무별 실제 작업시간 (시작~종료). 담당자(user) 필드는 두지 않음 — task.assignee 기준.
create table public.task_work_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  started_at timestamp not null,
  ended_at timestamp not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at > started_at)
);

create index task_work_logs_task_id_idx on public.task_work_logs (task_id);
create index task_work_logs_started_at_idx on public.task_work_logs (started_at);

alter table public.task_work_logs enable row level security;

create policy "Members can read task_work_logs"
  on public.task_work_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  );

create policy "Members can manage task_work_logs"
  on public.task_work_logs for all
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  );
