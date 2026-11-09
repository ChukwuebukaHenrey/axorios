-- 6.13: one row per order sent through an app connection (Zapier → Google Sheets).
-- The unique key is the idempotency key from spec v2: (store, order, action, destination).
-- A second approval finds the 'sent' row and sends nothing. Written only by the service role
-- inside module functions that take storeId; the owner can read their own rows.
create table public.connection_exports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  connection text not null check (connection in ('zapier')),
  action text not null,
  destination text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  approval_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, order_id, action, destination)
);

alter table public.connection_exports enable row level security;
create policy connection_exports_owner_read on public.connection_exports for select to authenticated
  using (public.owns_store(store_id));

create index connection_exports_store_idx on public.connection_exports (store_id, action, destination, status);
