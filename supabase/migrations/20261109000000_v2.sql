-- Spec v2 (docs/spec-v2.md, "Data model additions"): seller workspace, Money, refunds, analytics, demo data.
-- Money is integer minor units. Every store row has store_id + RLS through owns_store(); account rows use owner_id.
-- `source` marks where a row came from: app (live use), import, seed, test. reset-demo deletes import and seed only.

-- ───────────────────────────── existing tables ─────────────────────────────

alter table public.stores
  add column business_profile jsonb not null default '{}'::jsonb,
  add column country char(2) check (country ~ '^[A-Z]{2}$'),
  add column vat_registered boolean not null default false,
  add column vat_rate_bp integer not null default 0 check (vat_rate_bp between 0 and 10000),
  add column prices_include_tax boolean not null default true,
  add column is_demo boolean not null default false,
  add column template_id text,
  add column template_version integer;

alter table public.products
  add column inventory_mode text not null default 'tracked'
    check (inventory_mode in ('tracked', 'made_to_order', 'unlimited')),
  add column low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  add column daily_capacity integer check (daily_capacity >= 0),
  add column category text,
  add column source text not null default 'app' check (source in ('app', 'import', 'seed'));

-- contacts first: orders and conversations point at it.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text,
  email text,
  phone text,
  telegram_username text,
  country char(2) check (country ~ '^[A-Z]{2}$'),
  source text not null check (source in ('checkout', 'chat', 'signup', 'import', 'seed')),
  first_seen_at timestamptz not null default now(),
  merged_into uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index contacts_store_id_idx on public.contacts (store_id);
create index contacts_store_email_idx on public.contacts (store_id, lower(email)) where email is not null;
create index contacts_store_phone_idx on public.contacts (store_id, phone) where phone is not null;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('broadcast', 'new_product', 'promo_ending', 'restock')),
  segment uuid[] not null default '{}', -- label ids; empty = everyone with consent
  channels text[] not null default '{}',
  message text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  source text not null default 'app' check (source in ('app', 'seed')),
  created_at timestamptz not null default now()
);
create index campaigns_store_id_idx on public.campaigns (store_id);

create table public.tracked_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{4,24}$'),
  target text not null,
  post_id uuid references public.posts (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  channel text,
  source text not null default 'app' check (source in ('app', 'seed')),
  created_at timestamptz not null default now()
);
create index tracked_links_store_id_idx on public.tracked_links (store_id);

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'approved', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'));
alter table public.orders drop constraint orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel in ('web', 'whatsapp', 'telegram', 'instagram', 'facebook', 'tiktok', 'google', 'shopify'));
alter table public.orders
  add column contact_id uuid references public.contacts (id) on delete set null,
  add column tax_minor bigint not null default 0 check (tax_minor >= 0),          -- store currency
  add column tax_rate_bp integer not null default 0,
  add column tax_inclusive boolean not null default true,
  add column delivery_country char(2) check (delivery_country ~ '^[A-Z]{2}$'),
  add column buyer_country char(2) check (buyer_country ~ '^[A-Z]{2}$'),          -- where the payer is, not where it's delivered
  add column paypal_fee_minor bigint check (paypal_fee_minor >= 0),               -- charge currency, from seller_receivable_breakdown
  add column paypal_net_minor bigint,                                             -- charge currency
  add column refunded_minor bigint not null default 0 check (refunded_minor >= 0),        -- store currency at the sale rate
  add column refunded_charge_minor bigint not null default 0 check (refunded_charge_minor >= 0), -- captured currency
  add column fulfilled_at timestamptz,
  add column campaign_id uuid references public.campaigns (id) on delete set null,
  add column link_id uuid references public.tracked_links (id) on delete set null,
  add column source text not null default 'app' check (source in ('app', 'import', 'seed', 'test'));
create index orders_store_paid_at_idx on public.orders (store_id, paid_at) where paid_at is not null;
create index orders_paypal_capture_id_idx on public.orders (paypal_capture_id) where paypal_capture_id is not null;

alter table public.posts
  add column content_type text not null default 'image' check (content_type in ('image', 'carousel', 'text', 'video')),
  add column caption_length integer,
  add column product_ids uuid[] not null default '{}',
  add column link_id uuid references public.tracked_links (id) on delete set null,
  add column channel text,
  add column source text not null default 'app' check (source in ('app', 'seed'));

alter table public.conversations drop constraint conversations_channel_check;
alter table public.conversations add constraint conversations_channel_check
  check (channel in ('web', 'whatsapp', 'telegram', 'instagram', 'messenger'));
alter table public.conversations
  add column contact_id uuid references public.contacts (id) on delete set null,
  add column whatsapp_window_ends_at timestamptz,
  add column handled_by text not null default 'ai' check (handled_by in ('ai', 'seller')),
  add column source text not null default 'app' check (source in ('app', 'seed'));

alter table public.channel_bindings drop constraint channel_bindings_channel_check;
alter table public.channel_bindings add constraint channel_bindings_channel_check
  check (channel in ('web', 'whatsapp', 'telegram', 'instagram', 'messenger'));

alter table public.webhook_events drop constraint webhook_events_provider_check;
alter table public.webhook_events add constraint webhook_events_provider_check
  check (provider in ('paypal', 'twilio', 'telegram', 'kapso'));

-- Connections (spec: extend platform_connections rather than add a table).
alter table public.platform_connections drop constraint platform_connections_platform_check;
alter table public.platform_connections add constraint platform_connections_platform_check
  check (platform in ('shopify', 'zapier', 'telegram', 'whatsapp', 'meta', 'tiktok', 'google', 'paypal', 'paga', 'custom_mcp'));
alter table public.platform_connections alter column store_id drop not null;
alter table public.platform_connections alter column shop_domain drop not null;
alter table public.platform_connections alter column access_token drop not null;
alter table public.platform_connections
  add column owner_id uuid references auth.users (id) on delete cascade,
  add column scope text not null default 'store' check (scope in ('store', 'account')),
  add column permissions jsonb not null default '{}'::jsonb, -- { tool: 'always' | 'approve' | 'blocked' }
  add column status text not null default 'connected' check (status in ('connected', 'needs_reconnect', 'disconnected', 'demo')),
  add column last_used_at timestamptz;
update public.platform_connections pc set owner_id = s.owner_id from public.stores s where s.id = pc.store_id;
drop policy platform_connections_owner_read on public.platform_connections;
create policy platform_connections_owner_read on public.platform_connections for select to authenticated
  using (owner_id = (select auth.uid()) or public.owns_store(store_id));

-- ───────────────────────────── new tables ─────────────────────────────

create table public.contact_consents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null,
  marketing boolean not null default false,
  source text not null,
  consented_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index contact_consents_contact_idx on public.contact_consents (contact_id);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  colour text not null default '#85D6A6',
  system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

create table public.contact_labels (
  store_id uuid not null references public.stores (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (contact_id, label_id)
);
create index contact_labels_label_idx on public.contact_labels (label_id);

create table public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null,
  status text not null check (status in ('queued', 'sent', 'skipped', 'failed')),
  skipped_reason text,
  sent_at timestamptz
);
create index campaign_sends_campaign_idx on public.campaign_sends (campaign_id);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  code text not null,
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null check (value > 0), -- percent points or minor units
  product_ids uuid[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'app' check (source in ('app', 'seed')),
  unique (store_id, code)
);

create table public.link_clicks (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  link_id uuid not null references public.tracked_links (id) on delete cascade,
  at timestamptz not null default now(),
  country char(2),
  device text check (device in ('mobile', 'desktop', 'tablet', 'other')) -- no IP stored
);
create index link_clicks_link_idx on public.link_clicks (link_id, at);
create index link_clicks_store_at_idx on public.link_clicks (store_id, at);

create table public.store_visits (
  store_id uuid not null references public.stores (id) on delete cascade,
  day date not null,
  path text not null default '/',
  visits integer not null default 0,
  unique_visitors integer not null default 0,
  primary key (store_id, day, path)
);

create table public.post_metrics (
  store_id uuid not null references public.stores (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  channel text not null,
  day date not null,
  reach integer not null default 0,
  impressions integer not null default 0,
  engagements integer not null default 0,
  clicks integer not null default 0,
  source text not null default 'platform' check (source in ('platform', 'seed')),
  primary key (post_id, channel, day)
);
create index post_metrics_store_day_idx on public.post_metrics (store_id, day);

create table public.refunds (
  id uuid primary key default gen_random_uuid(), -- also the PayPal-Request-Id
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  paypal_refund_id text unique,
  amount_minor bigint not null check (amount_minor > 0),     -- captured currency
  currency char(3) not null,
  store_amount_minor bigint not null check (store_amount_minor >= 0), -- store currency at the original rate
  vat_reversed_minor bigint not null default 0,              -- store currency
  fee_returned_minor bigint,                                 -- captured currency, from PayPal's response
  status text not null default 'requested' check (status in ('requested', 'pending', 'completed', 'failed')),
  reason text,
  requested_by text not null default 'seller' check (requested_by in ('seller', 'axori_ai', 'system')),
  restock boolean not null default false,
  source text not null default 'app' check (source in ('app', 'import', 'seed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index refunds_order_idx on public.refunds (order_id);
create index refunds_store_created_idx on public.refunds (store_id, created_at);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  day date not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  category text not null,
  note text,
  receipt_media_id uuid,
  source text not null default 'chat' check (source in ('chat', 'receipt', 'app', 'seed')),
  created_at timestamptz not null default now()
);
create index expenses_store_day_idx on public.expenses (store_id, day);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  day date not null,
  usd_minor bigint not null check (usd_minor > 0),
  ngn_minor bigint not null check (ngn_minor > 0),
  rate numeric(20, 10) not null, -- NGN per USD received
  provider text not null default 'paga' check (provider in ('paga')),
  reference text,
  source text not null default 'app' check (source in ('app', 'seed')),
  created_at timestamptz not null default now()
);
create index withdrawals_owner_day_idx on public.withdrawals (owner_id, day);

create table public.fx_rates (
  base char(3) not null,
  quote char(3) not null,
  day date not null,
  rate numeric(20, 10) not null, -- units of quote per 1 base
  source text not null default 'open.er-api.com',
  primary key (base, quote, day)
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  url text not null,
  kind text not null default 'image' check (kind in ('image', 'video', 'document')),
  tags text[] not null default '{}',
  product_ids uuid[] not null default '{}',
  source text not null default 'upload' check (source in ('upload', 'generated', 'seed')),
  prompt_key text, -- generated images: reuse instead of regenerating
  created_at timestamptz not null default now()
);
create index media_owner_idx on public.media (owner_id, created_at desc);
create unique index media_owner_prompt_key_idx on public.media (owner_id, prompt_key) where prompt_key is not null;
alter table public.expenses add constraint expenses_receipt_media_fk
  foreign key (receipt_media_id) references public.media (id) on delete set null;

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  period text not null,
  finding text not null,
  numbers jsonb not null default '{}'::jsonb,
  suggested_action text,
  status text not null default 'new' check (status in ('new', 'seen', 'acted', 'dismissed')),
  source text not null default 'app' check (source in ('app', 'seed')),
  created_at timestamptz not null default now()
);
create index insights_store_idx on public.insights (store_id, created_at desc);

create table public.activity_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  actor text not null check (actor in ('seller', 'axori_ai', 'system')),
  action text not null,
  target text,
  approval_id text,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index activity_log_owner_at_idx on public.activity_log (owner_id, at desc);

create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade, -- null = account thread
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_threads_owner_updated_idx on public.ai_threads (owner_id, updated_at desc);
create trigger ai_threads_set_updated_at before update on public.ai_threads
  for each row execute function public.set_updated_at();

-- AG Studio relations need line items as rows. security_invoker keeps orders' RLS.
create view public.order_items with (security_invoker = true) as
select
  o.id as order_id,
  o.store_id,
  (line ->> 'productId')::uuid as product_id,
  line ->> 'name' as name,
  (line ->> 'quantity')::integer as quantity,
  (line ->> 'unitMinor')::bigint as unit_minor,
  (line ->> 'lineMinor')::bigint as line_minor,
  o.currency,
  o.paid_at,
  o.status,
  o.source
from public.orders o
cross join lateral jsonb_array_elements(o.items) as line;

-- ───────────────────────────── RLS ─────────────────────────────

alter table public.contacts enable row level security;
alter table public.contact_consents enable row level security;
alter table public.labels enable row level security;
alter table public.contact_labels enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_sends enable row level security;
alter table public.promotions enable row level security;
alter table public.tracked_links enable row level security;
alter table public.link_clicks enable row level security;
alter table public.store_visits enable row level security;
alter table public.post_metrics enable row level security;
alter table public.refunds enable row level security;
alter table public.expenses enable row level security;
alter table public.withdrawals enable row level security;
alter table public.fx_rates enable row level security;
alter table public.media enable row level security;
alter table public.insights enable row level security;
alter table public.activity_log enable row level security;
alter table public.ai_threads enable row level security;

create policy contacts_owner_all on public.contacts for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy contact_consents_owner_all on public.contact_consents for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy labels_owner_all on public.labels for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy contact_labels_owner_all on public.contact_labels for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy campaigns_owner_all on public.campaigns for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy campaign_sends_owner_read on public.campaign_sends for select to authenticated
  using (public.owns_store(store_id));
create policy promotions_owner_all on public.promotions for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy tracked_links_owner_read on public.tracked_links for select to authenticated
  using (public.owns_store(store_id));
create policy link_clicks_owner_read on public.link_clicks for select to authenticated
  using (public.owns_store(store_id));
create policy store_visits_owner_read on public.store_visits for select to authenticated
  using (public.owns_store(store_id));
create policy post_metrics_owner_read on public.post_metrics for select to authenticated
  using (public.owns_store(store_id));
create policy refunds_owner_read on public.refunds for select to authenticated
  using (public.owns_store(store_id));
create policy expenses_owner_read on public.expenses for select to authenticated
  using (public.owns_store(store_id));
create policy withdrawals_owner_read on public.withdrawals for select to authenticated
  using (owner_id = (select auth.uid()));
create policy fx_rates_read on public.fx_rates for select to anon, authenticated using (true);
create policy media_owner_all on public.media for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy insights_owner_all on public.insights for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy activity_log_owner_read on public.activity_log for select to authenticated
  using (owner_id = (select auth.uid()));
create policy ai_threads_owner_all on public.ai_threads for all to authenticated
  using (owner_id = (select auth.uid()) and (store_id is null or public.owns_store(store_id)))
  with check (owner_id = (select auth.uid()) and (store_id is null or public.owns_store(store_id)));

-- The 7 orders made while testing Phases 2-5 stay as evidence but are hidden from every tab (spec v2, demo account step 6).
update public.orders o set source = 'test'
from public.stores s
where s.id = o.store_id and s.slug = 'demo' and o.created_at < '2026-11-09';
