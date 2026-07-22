-- 프로젝트별 기본 근무시간 (일 뷰 시간축)
alter table public.projects
  add column workday_start_hour integer not null default 9
    check (workday_start_hour >= 0 and workday_start_hour < 24),
  add column workday_end_hour integer not null default 18
    check (workday_end_hour > 0 and workday_end_hour <= 24);

alter table public.projects
  add constraint projects_workday_range_check
  check (workday_start_hour < workday_end_hour);
