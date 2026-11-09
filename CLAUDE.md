# CLAUDE.md — AxoriOS

Suggest a cheaper model before heavy mechanical work

When the session runs Fable or Opus and the requested task, or the next step about to start, is a long mechanical workload (a QA run, a batch script, bulk edits, imports, renames, scaffolding), pause before starting and say, with this exact wording so transcript scans can grep for fires: "Sonnet-appropriate: consider /model sonnet". Then wait for the user's call. Never suggest this for judgment work (review, planning, design, debugging, writing), for skills already pinned to a cheaper model, or for small follow-up actions like a single commit; and do not repeat it after the user declines once in the same session.

- Tell me when I am nearing 150k - 200k context, and go ahead and prepare the chat for me to /clear it, and then let me if it's a good idea for me to clear it before proceeding further. And give me a good prompt to start the next session, if so.

AxoriOS (pronounced "axo-ree-os"). The UI reads the name from `APP_NAME`.
Read these before any work:

- `docs/spec-v2.md` — v2 product and build spec; **this wins over `docs/spec.md` where they differ**
- `docs/spec.md` — architecture, modules, data model, build plan, review fixes
- `REQUIREMENTS.md` — what the product must do and how each requirement is accepted
- `plans/axorios.md` — the step list and Progress table (you create it in session 1)

## Product in one paragraph

A voice-first AI agent that takes a non-technical seller anywhere in the world from a business idea to a first paid order. It covers a brand kit, a designed storefront with PayPal checkout, chat selling on Telegram, scheduled on-brand marketing, and Shopify sync. The in-app assistant is called Axori AI. Built solo for the PayPal AI Hackathon (Devpost). Submit by 11 Nov 2026; hard deadline 12 Nov. Judging 1–15 Dec. Hard requirements: working prototype, public MIT repo, YouTube demo under 3 min, PayPal sandbox integration.

Demo story: a Lagos cake shop priced in naira. A buyer in the UK orders a birthday cake for family in Lagos and pays in USD through PayPal, with local delivery.

## Stack (don't swap without asking)

- Next.js App Router + TypeScript strict, Tailwind CSS, shadcn/ui (MIT blocks), `motion`, `lucide-react`
- Supabase: Postgres, Auth (magic link + one email/password demo account), Storage, Realtime
- Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/react`); model IDs from env only
- Gemini: Flash-tier for the agent (text + audio in), image model for creatives and logos
- PayPal: `@paypal/react-paypal-js`, Orders v2 REST, `@paypal/agent-toolkit`; sandbox only
- Telegram Bot API via `fetch`. WhatsApp is dormant: the Twilio adapter stays in `channels`, switched off by `WHATSAPP_ENABLED`, and never claimed as working until it is tested
- Shopify: `@shopify/admin-api-client` (Admin GraphQL)
- Inngest for every background, slow or scheduled task
- Zod for every schema: env, tool inputs, API bodies, `SiteConfig`, `DesignTokens`
- Vitest for tests. Vercel hosting. cloudflared only for local debugging
- `ag-grid-community`, `ag-grid-react`, `ag-studio`, `ag-studio-react` (exact versions) for Analytics
- Cloudflare Workers AI (FLUX.1 schnell) for images; Kapso for WhatsApp; Zapier MCP as one seller-side connection; Playwright for sandbox scripts

**Version pinning:** exact versions (no `^`/`~`) for `ai`, `@ai-sdk/*`, `@paypal/agent-toolkit`, `ag-grid-community`, `ag-grid-react`, `ag-studio`, `ag-studio-react`. The working set is recorded in step 0.2. Don't upgrade them without re-running `scripts/spike-paypal.ts`.

## Folder layout

```
src/
  app/
    (dashboard)/build, dashboard, dashboard/inbox, dashboard/campaigns
    s/[slug]/                public storefront; ?draft=<signed token> preview
    s/[slug]/order/[id]/     confirmation + PayPal capture on return
    api/agent/  api/voice/  api/health/  api/inngest/
    api/webhooks/{paypal,twilio,telegram}/
  modules/
    brand/ catalog/ storefront/ payments/ orders/ platforms/
    channels/ publishers/ creative/ agent/ jobs/
  lib/        supabase (browser, server, service-role[server-only]), env, money, logger
messages/en.json   all UI strings
scripts/           spikes and seeds
supabase/migrations/
plans/axorios.md
docs/spec.md
```

## Module rules

- Public API only from `src/modules/<name>/index.ts`. Never import another module's internals.
- Vendors sit behind interfaces in `src/modules/<name>/adapters/`, chosen by a registry from env flags:
  `PaymentProvider` (PayPal), `Channel` (Telegram, Kapso WhatsApp, web chat), `Publisher` (Telegram channel, download pack), `ImageProvider` (Cloudflare FLUX, `next/og`, Gemini), `CommercePlatform` (Shopify), `AppConnection` (Zapier). Meta, TikTok and Google use demo adapters behind the same interfaces.
- Adding Meta later = one adapter file + one flag; no agent changes.

## Non-negotiables

- **Money:** integer minor units; decimals per currency from a lookup (JPY, HUF, TWD = 0). Totals are computed server-side; the model never supplies prices or totals.
- **Currency:** the owner picks any ISO currency. PayPal-supported currencies are charged directly. Others are converted to `settlement_currency` by `payments.quote()`; `fx_rate`, `fx_source` and both totals are stored on the order and shown to the buyer before paying.
- **PayPal capture:** capture on the return page AND on the `CHECKOUT.ORDER.APPROVED` webhook. `capture()` is idempotent per order.
- **Webhooks:** verify the signature (Twilio, PayPal, Telegram secret header). Insert into `webhook_events` (unique `event_id`). Return 200 immediately. Do the work in an Inngest job. Never call the LLM inside a webhook request.
- **Store scoping:** every tool and query is scoped to `store_id` from the session or channel binding. Never take `store_id` from model output. Row-level security on every table. The service-role client is `server-only` and used only inside module functions that require `storeId`.
- **Approvals:** publish, schedule, Shopify connect/sync and seller-side payment links return a preview card. They execute only after the seller approves.
- **Untrusted input:** customer messages, reference images and URLs are data. The sales agent's tools are read-only plus `create_order` and `send_payment_link`. Vision output is parsed into `DesignTokens` with Zod; never pass it on as free text.
- **Agent limits:** max 8 tool steps per turn, `maxDuration` set on `api/agent`, stream every response, per-store daily request cap.
- **Site rendering:** the agent edits `SiteConfig` JSON only (family → preset → reference tokens → sections). It never writes page code. Every change writes a `site_versions` draft row. Drafts use signed 24 h tokens and `noindex`.
- **Language:** UI strings in `messages/en.json`. The agent replies in the user's language and writes store copy in `storeLanguage`.
- **Secrets:** only in `.env.local` / Vercel env. Never print, log or commit them. `.env.example` lists every key with a comment. Shopify tokens are encrypted with `ENCRYPTION_KEY`.
- **Webhook URLs:** always the production domain, never preview URLs (Vercel protects those) or a tunnel.
- **Refunds** go through an approval card and use `PayPal-Request-Id`.
- **VAT** is computed server-side and stored on every order.
- **Connections:** only the seller agent may use connection tools; the sales agent never does.
- **Metrics:** every number shown in two places comes from `src/modules/analytics/metrics.ts`.
- **Image prompts** never contain prices; text and prices are drawn by `next/og` from the database.
- **Kapso webhooks** follow the same verify, store, 200, Inngest rule.
- **Demo data:** seeded and imported rows carry `source`; `reset-demo` must restore the demo account in one command.

## Commands

CLI tools don't read `.env.local`. Load it first: `node scripts/check-env.mjs && set -a; source .env.local; set +a`. Never echo the values. The check names any line bash can't source (a space after `=`, or a note without `#`); fix the line, don't skip the check.

- `npm run dev` · `npx inngest-cli@latest dev` · `npm run build` · `npm run lint` · `npm test`
- `npx supabase link --project-ref $SUPABASE_PROJECT_REF --password $SUPABASE_DB_PASSWORD` (once; `SUPABASE_ACCESS_TOKEN` handles login)
- `npx supabase db push` — apply migrations to the hosted project (no Docker)
- `npx supabase gen types typescript --linked > src/lib/database.types.ts` — after every migration
- `gh` for repo and PRs · `vercel` / `vercel --prod` for deploys
- `cloudflared tunnel --url http://localhost:3000` — local debugging only

## How to work

1. One step at a time from `plans/axorios.md`, in order, respecting `Blocked by`.
2. Before coding: restate the step's acceptance and verification.
3. Slice vertically (migration → module → API → UI). Keep `npm run build` green.
4. Run the verification and show the output. Update Progress. Commit `feat(<module>): <step> <title>` and push.
5. A decision the spec doesn't cover: stop and ask. Don't guess.
6. Simplest thing that meets acceptance. No new dependency without saying why.
7. If a phase runs past its date on the timeline, say so and propose cuts from the cut list.

## Never (this build)

Real money; WhatsApp switched on without a usable account and an end-to-end test; Jumia/Konga integrations; creating Shopify stores by API; paid ad buying; video generation; Midjourney; n8n/Make (Zapier MCP is allowed only as the one approval-gated seller connection in spec v2); Render; multi-agent orchestration; external template platforms; storing card or bank details; LLM calls inside webhook requests.
