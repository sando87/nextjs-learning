alter table public.tasks drop column if exists type;

drop type if exists public.task_type;
