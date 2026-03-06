-- Add share_token column to scenes for public sharing
alter table public.scenes add column if not exists share_token text unique;

create index if not exists idx_scenes_share_token
  on public.scenes(share_token) where share_token is not null;

-- Allow public read access for shared scenes (by share_token)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scenes' AND policyname = 'Public can view shared scenes'
  ) THEN
    CREATE POLICY "Public can view shared scenes" ON public.scenes
      FOR SELECT USING (share_token IS NOT NULL);
  END IF;
END
$$;
