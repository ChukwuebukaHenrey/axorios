-- AxoriOS initial schema. Every store-owned table carries store_id and has row-level security on.
-- Writes from webhooks and jobs go through the service-role client inside module functions.

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  status text not null default 'draft' check (status in ('draft', 'live')),
  brand_kit jsonb not null default '{}'::jsonb,
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  settlement_currency char(3) not null default 'USD' check (settlement_currency ~ '^[A-Z]{3}$'),
  store_language text not null default 'en',
  contact_channels jsonb not null default '{}'::jsonb,
  agent_requests_today integer not null default 0,
  agent_requests_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_owner_id_idx on public.stores (owner_id);

create table public.site_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  template_id text not null,
  config jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by text not null check (created_by in ('agent', 'seller')),
  created_at timestamptz not null default now()
);
create index site_versions_store_id_created_at_idx on public.site_versions (store_id, created_at desc);
create unique index site_versions_one_published_idx on public.site_versions (store_id) where status = 'published';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  description text not null default '',
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_store_id_idx on public.products (store_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  items jsonb not null,
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null,
  charge_total_minor bigint not null check (charge_total_minor >= 0),
  charge_currency char(3) not null,
  fx_rate numeric(20, 10),
  fx_source text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'failed', 'cancelled')),
  channel text not null default 'web' check (channel in ('web', 'whatsapp', 'telegram', 'instagram')),
  customer_ref text,
  delivery_note text,
  paypal_order_id text unique,
  paypal_capture_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_store_id_created_at_idx on public.orders (store_id, created_at desc);

create table public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  platform text not null check (platform in ('shopify')),
  shop_domain text not null,
  access_token text not null, -- encrypted with ENCRYPTION_KEY
  last_synced_at timestamptz,
  external_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (store_id, platform)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  channel text not null check (channel in ('web', 'whatsapp', 'telegram', 'instagram')),
  customer_ref text not null,
  agent_paused boolean not null default false, -- seller takeover stops agent replies
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (store_id, channel, customer_ref)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('customer', 'agent', 'seller')),
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);
create index messages_store_id_idx on public.messages (store_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  caption text not null default '',
  media_url text,
  targets text[] not null default '{}',
  scheduled_at timestamptz,
  status text not null default 'generating'
    check (status in ('generating', 'draft', 'approved', 'scheduled', 'published', 'failed')),
  publish_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index posts_store_id_idx on public.posts (store_id);

create table public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index agent_sessions_store_id_idx on public.agent_sessions (store_id);

-- Not store-scoped: written only by webhook routes through the service-role client.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paypal', 'twilio', 'telegram')),
  event_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- updated_at maintenance
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger stores_set_updated_at before update on public.stores
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger agent_sessions_set_updated_at before update on public.agent_sessions
  for each row execute function public.set_updated_at();

-- Ownership helper. Security definer so policies on child tables don't recurse through stores' RLS.
create function public.owns_store(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.stores s where s.id = target and s.owner_id = (select auth.uid()));
$$;
revoke execute on function public.owns_store(uuid) from public;
grant execute on function public.owns_store(uuid) to authenticated;

-- Row-level security on every table.
alter table public.stores enable row level security;
alter table public.site_versions enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.platform_connections enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.posts enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.webhook_events enable row level security; -- no policies: service role only

create policy stores_owner_all on public.stores for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy stores_public_read_live on public.stores for select to anon, authenticated
  using (status = 'live');

create policy site_versions_owner_all on public.site_versions for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy site_versions_public_read_published on public.site_versions for select to anon, authenticated
  using (status = 'published');

create policy products_owner_all on public.products for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy products_public_read_live on public.products for select to anon, authenticated
  using (active and exists (select 1 from public.stores s where s.id = store_id and s.status = 'live'));

create policy orders_owner_read on public.orders for select to authenticated
  using (public.owns_store(store_id));

create policy platform_connections_owner_read on public.platform_connections for select to authenticated
  using (public.owns_store(store_id));

create policy conversations_owner_all on public.conversations for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

create policy messages_owner_all on public.messages for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

create policy posts_owner_all on public.posts for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

create policy agent_sessions_owner_all on public.agent_sessions for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- Public bucket for logos, product photos and generated creatives. Uploads go through the server.
insert into storage.buckets (id, name, public) values ('store-assets', 'store-assets', true)
  on conflict (id) do nothing;
