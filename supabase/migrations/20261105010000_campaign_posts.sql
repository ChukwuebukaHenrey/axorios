-- Groups posts generated together, and keeps the time the agent suggests for each one for the download pack.
alter table public.posts
  add column campaign_id uuid,
  add column suggested_at timestamptz;

create index posts_store_id_campaign_id_idx on public.posts (store_id, campaign_id);
