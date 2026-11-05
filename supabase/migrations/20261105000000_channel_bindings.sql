-- Which store a customer's chat belongs to. One row per chat, on any channel: arriving from another store's link moves it.
create table public.channel_bindings (
  channel text not null check (channel in ('web', 'whatsapp', 'telegram', 'instagram')),
  customer_ref text not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  bound_at timestamptz not null default now(),
  primary key (channel, customer_ref)
);
create index channel_bindings_store_id_idx on public.channel_bindings (store_id);

alter table public.channel_bindings enable row level security;

create policy channel_bindings_owner_read on public.channel_bindings for select to authenticated
  using (public.owns_store(store_id));
