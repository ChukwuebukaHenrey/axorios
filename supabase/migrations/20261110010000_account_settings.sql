-- 6.12: one row per seller account for Settings.
-- tool_permissions: { tool: 'always' | 'approve' | 'blocked' }. The agent registry reads it on every turn;
-- it can only make a tool stricter (approvals.decideApproval ignores a looser value).
create table public.account_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  tool_permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.account_settings enable row level security;
create policy account_settings_owner_all on public.account_settings for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create index activity_log_owner_action_idx on public.activity_log (owner_id, action, at desc);
