-- Add share_token column to scenes for public sharing
alter table public.scenes add column if not exists share_token text unique;

create index if not exists idx_scenes_share_token
  on public.scenes(share_token) where share_token is not null;

-- Allow public read access for shared scenes (by share_token)
create policy "Public can view shared scenes" on public.scenes
  for select using (share_token is not null);
