-- profiles: auth.users와 1:1, 멤버 검색용
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);

-- 기존 가입자 backfill
insert into public.profiles (id, email, display_name)
select
  id,
  email,
  coalesce(
    nullif(split_part(email, '@', 1), ''),
    left(id::text, 8)
  )
from auth.users
on conflict (id) do nothing;

-- 신규 가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(split_part(new.email, '@', 1), ''),
      left(new.id::text, 8)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

-- project_members
create type public.project_role as enum ('owner', 'member');

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.project_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_project_id_idx on public.project_members (project_id);
create index project_members_user_id_idx on public.project_members (user_id);

-- tasks
create type public.task_type as enum ('Dev', 'QA', 'R&D', 'Art', 'Sound', 'Run');
create type public.task_status as enum ('planned', 'doing', 'done', 'hold');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  assignee_id uuid references auth.users (id) on delete set null,
  type public.task_type not null default 'Dev',
  status public.task_status not null default 'planned',
  start_date date,
  end_date date,
  priority int not null default 100,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_id_idx on public.tasks (project_id, sort_order);

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  color text not null default '#71717a',
  unique (project_id, name)
);

create index tags_project_id_idx on public.tags (project_id);

-- task_tags
create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

-- task_links
create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  source_task_id uuid not null references public.tasks (id) on delete cascade,
  target_task_id uuid not null references public.tasks (id) on delete cascade,
  unique (source_task_id, target_task_id),
  check (source_task_id <> target_task_id)
);

create index task_links_source_idx on public.task_links (source_task_id);
create index task_links_target_idx on public.task_links (target_task_id);

-- project_members / tasks → profiles FK (PostgREST embed용)
alter table public.project_members
  add constraint project_members_profiles_fkey
  foreign key (user_id) references public.profiles (id);

alter table public.tasks
  add constraint tasks_assignee_profiles_fkey
  foreign key (assignee_id) references public.profiles (id);

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = p_project_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = p_project_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- profiles RLS
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Members can read co-member profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm1
      join public.project_members pm2 on pm1.project_id = pm2.project_id
      where pm1.user_id = auth.uid()
        and pm2.user_id = profiles.id
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Authenticated can lookup profiles for invites"
  on public.profiles for select
  to authenticated
  using (true);

-- projects RLS
alter table public.projects enable row level security;

create policy "Members can read projects"
  on public.projects for select
  to authenticated
  using (public.is_project_member(id));

create policy "Authenticated users can create projects"
  on public.projects for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update projects"
  on public.projects for update
  to authenticated
  using (public.is_project_owner(id))
  with check (public.is_project_owner(id));

create policy "Owners can delete projects"
  on public.projects for delete
  to authenticated
  using (public.is_project_owner(id));

-- project_members RLS
alter table public.project_members enable row level security;

create policy "Members can read project members"
  on public.project_members for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "Owners can add members"
  on public.project_members for insert
  to authenticated
  with check (
    public.is_project_owner(project_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1 from public.projects p
        where p.id = project_id and p.owner_id = auth.uid()
      )
    )
  );

create policy "Owners can remove members"
  on public.project_members for delete
  to authenticated
  using (public.is_project_owner(project_id));

-- tasks RLS
alter table public.tasks enable row level security;

create policy "Members can read tasks"
  on public.tasks for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "Members can create tasks"
  on public.tasks for insert
  to authenticated
  with check (public.is_project_member(project_id));

create policy "Members can update tasks"
  on public.tasks for update
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "Members can delete tasks"
  on public.tasks for delete
  to authenticated
  using (public.is_project_member(project_id));

-- tags RLS
alter table public.tags enable row level security;

create policy "Members can read tags"
  on public.tags for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "Members can manage tags"
  on public.tags for all
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- task_tags RLS
alter table public.task_tags enable row level security;

create policy "Members can read task_tags"
  on public.task_tags for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  );

create policy "Members can manage task_tags"
  on public.task_tags for all
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

-- task_links RLS
alter table public.task_links enable row level security;

create policy "Members can read task_links"
  on public.task_links for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = source_task_id and public.is_project_member(t.project_id)
    )
  );

create policy "Members can manage task_links"
  on public.task_links for all
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = source_task_id and public.is_project_member(t.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = source_task_id and public.is_project_member(t.project_id)
    )
  );
