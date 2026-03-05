-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_inputs enable row level security;
alter table public.pipeline_jobs enable row level security;
alter table public.assets enable row level security;
alter table public.scene_worlds enable row level security;

-- Helper: get current user's internal ID from Clerk JWT
create or replace function public.requesting_user_id()
returns uuid as $$
  select id from public.users where clerk_id = auth.jwt() ->> 'sub'
$$ language sql security definer stable;

-- USERS
create policy "Users read own" on public.users
  for select using (id = public.requesting_user_id());
create policy "Users update own" on public.users
  for update using (id = public.requesting_user_id());

-- PROJECTS
create policy "Projects select" on public.projects
  for select using (user_id = public.requesting_user_id());
create policy "Projects insert" on public.projects
  for insert with check (user_id = public.requesting_user_id());
create policy "Projects update" on public.projects
  for update using (user_id = public.requesting_user_id());
create policy "Projects delete" on public.projects
  for delete using (user_id = public.requesting_user_id());

-- SCENES (access derived from project ownership)
create policy "Scenes select" on public.scenes
  for select using (
    project_id in (select id from public.projects where user_id = public.requesting_user_id())
  );
create policy "Scenes insert" on public.scenes
  for insert with check (
    project_id in (select id from public.projects where user_id = public.requesting_user_id())
  );
create policy "Scenes update" on public.scenes
  for update using (
    project_id in (select id from public.projects where user_id = public.requesting_user_id())
  );
create policy "Scenes delete" on public.scenes
  for delete using (
    project_id in (select id from public.projects where user_id = public.requesting_user_id())
  );

-- SCENE_INPUTS (access derived from scene -> project ownership)
create policy "Scene inputs select" on public.scene_inputs
  for select using (
    scene_id in (
      select s.id from public.scenes s
      join public.projects p on s.project_id = p.id
      where p.user_id = public.requesting_user_id()
    )
  );
create policy "Scene inputs insert" on public.scene_inputs
  for insert with check (
    scene_id in (
      select s.id from public.scenes s
      join public.projects p on s.project_id = p.id
      where p.user_id = public.requesting_user_id()
    )
  );
create policy "Scene inputs delete" on public.scene_inputs
  for delete using (
    scene_id in (
      select s.id from public.scenes s
      join public.projects p on s.project_id = p.id
      where p.user_id = public.requesting_user_id()
    )
  );

-- PIPELINE_JOBS
create policy "Jobs select" on public.pipeline_jobs
  for select using (
    scene_id in (
      select s.id from public.scenes s
      join public.projects p on s.project_id = p.id
      where p.user_id = public.requesting_user_id()
    )
  );

-- ASSETS
create policy "Assets select" on public.assets
  for select using (
    scene_id in (
      select s.id from public.scenes s
      join public.projects p on s.project_id = p.id
      where p.user_id = public.requesting_user_id()
    )
  );

-- SCENE_WORLDS
create policy "Worlds select" on public.scene_worlds
  for select using (
    scene_id in (
      select s.id from public.scenes s
      join public.projects p on s.project_id = p.id
      where p.user_id = public.requesting_user_id()
    )
  );
