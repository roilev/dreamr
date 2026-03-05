-- Enable Realtime for tables that clients subscribe to
alter publication supabase_realtime add table public.pipeline_jobs;
alter publication supabase_realtime add table public.scenes;
alter publication supabase_realtime add table public.scene_worlds;
