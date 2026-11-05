-- A shop can belong to one AxoriOS store only, so two sellers can never overwrite each other's catalog.
create unique index platform_connections_one_store_per_shop_idx on public.platform_connections (platform, shop_domain);

-- The access token expires, and the seller's dashboard shows how the last sync went.
alter table public.platform_connections
  add column token_expires_at timestamptz,
  add column last_sync_result jsonb;
