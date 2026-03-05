create extension if not exists "uuid-ossp";

-- ══════════════════════════════════════════════════
-- USERS (synced from Clerk via webhook)
-- ══════════════════════════════════════════════════
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  clerk_id text unique not null,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_users_clerk_id on public.users(clerk_id);

-- ══════════════════════════════════════════════════
-- PROJECTS (top-level containers)
-- ══════════════════════════════════════════════════
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_projects_user_id on public.projects(user_id);

-- ══════════════════════════════════════════════════
-- SCENES (individual world-building sessions)
-- ══════════════════════════════════════════════════
create type scene_status as enum (
  'draft',
  'generating',
  'completed',
  'failed',
  'archived'
);

create type pipeline_step as enum (
  'image_360',
  'video',
  'upscale',
  'depth',
  'world'
);

create table public.scenes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null default 'Untitled Scene',
  status scene_status default 'draft',
  current_step pipeline_step,
  prompt text,
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_scenes_project_id on public.scenes(project_id);

-- ══════════════════════════════════════════════════
-- SCENE INPUTS (user-provided images with positions)
-- ══════════════════════════════════════════════════
create type input_type as enum ('image', 'text');

create table public.scene_inputs (
  id uuid primary key default uuid_generate_v4(),
  scene_id uuid references public.scenes(id) on delete cascade not null,
  type input_type not null,
  content text,
  storage_path text,
  position_x float default 0,
  position_y float default 0,
  position_z float default 0,
  sort_order int default 0,
  created_at timestamptz default now()
);

create index idx_scene_inputs_scene_id on public.scene_inputs(scene_id);

-- ══════════════════════════════════════════════════
-- PIPELINE JOBS (tracks each pipeline step execution)
-- ══════════════════════════════════════════════════
create type job_status as enum (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

create table public.pipeline_jobs (
  id uuid primary key default uuid_generate_v4(),
  scene_id uuid references public.scenes(id) on delete cascade not null,
  step pipeline_step not null,
  status job_status default 'pending',
  provider text,
  provider_request_id text,
  model_id text,
  input_metadata jsonb,
  output_metadata jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_pipeline_jobs_scene_id on public.pipeline_jobs(scene_id);
create index idx_pipeline_jobs_status on public.pipeline_jobs(status);

-- ══════════════════════════════════════════════════
-- ASSETS (all generated files)
-- ══════════════════════════════════════════════════
create type asset_type as enum (
  'equirect_image',
  'video',
  'upscaled_video',
  'depth_map',
  'splat_100k',
  'splat_500k',
  'splat_full',
  'collider_mesh',
  'panorama',
  'thumbnail',
  'selected_frame'
);

create table public.assets (
  id uuid primary key default uuid_generate_v4(),
  scene_id uuid references public.scenes(id) on delete cascade not null,
  job_id uuid references public.pipeline_jobs(id) on delete set null,
  type asset_type not null,
  storage_path text not null,
  public_url text,
  file_size_bytes bigint,
  width int,
  height int,
  duration_seconds float,
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_assets_scene_id on public.assets(scene_id);
create index idx_assets_type on public.assets(type);

-- ══════════════════════════════════════════════════
-- SCENE WORLDS (Marble world references)
-- ══════════════════════════════════════════════════
create table public.scene_worlds (
  id uuid primary key default uuid_generate_v4(),
  scene_id uuid references public.scenes(id) on delete cascade not null,
  marble_world_id text,
  marble_operation_id text,
  source_frame_asset_id uuid references public.assets(id),
  splat_100k_asset_id uuid references public.assets(id),
  splat_500k_asset_id uuid references public.assets(id),
  splat_full_asset_id uuid references public.assets(id),
  collider_asset_id uuid references public.assets(id),
  panorama_asset_id uuid references public.assets(id),
  status job_status default 'pending',
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index idx_scene_worlds_scene_id on public.scene_worlds(scene_id);

-- ══════════════════════════════════════════════════
-- Updated_at trigger
-- ══════════════════════════════════════════════════
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users
  for each row execute function update_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function update_updated_at();
create trigger scenes_updated_at before update on public.scenes
  for each row execute function update_updated_at();
