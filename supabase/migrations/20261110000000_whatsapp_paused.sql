-- 6.11: set when a WhatsApp send fails for Kapso credits, cleared by the next send that works.
-- The Inbox shows "WhatsApp paused: add Kapso credits" while it is set.
alter table public.stores add column whatsapp_paused_at timestamptz;
