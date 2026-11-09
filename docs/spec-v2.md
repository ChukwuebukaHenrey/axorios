# AxoriOS v2 — Product & Build Spec

Nov 9, 2026 · @Ebuka

## How to use this doc

This spec takes the working AxoriOS build to v2: a full seller workspace with 6 months of demo data, AG Studio analytics, a Money tab, refunds, Kapso WhatsApp, free image generation and a Zapier connection. Submit by **11 Nov 2026**; the hard deadline is **12 Nov**.

**For Claude Code:** read `CLAUDE.md`, this doc (saved as `docs/spec-v2.md`), `docs/spec.md` and `plans/axorios.md`. Where this doc and `docs/spec.md` disagree, this doc wins. Add the steps in the Build plan section to `plans/axorios.md` and follow "How to work" as before.

**Already built (Phases 0 to 5.3, per `plans/axorios.md`):**

- PayPal sandbox checkout, capture on return and webhook, idempotent; NGN store charging USD at a stored rate; a GBP store charging GBP directly
- Telegram selling bot (chat to paid order) and Telegram channel publishing with approval cards
- Shopify sync (products, collection, pages, theme-editor link), one-way, no duplicates
- Voice input with transcript, brand kit, catalog, storefront with presets, draft preview and publish
- Inbox with seller takeover; campaigns with `next/og` images; demo seller account

**Not built yet:** the new sidebar and Axori AI panel, Home tiles, Store overview, Customers, Money, refunds, Analytics (AG Studio), Design, Settings and Connections, the 6-month seed, Kapso, Cloudflare FLUX, Zapier.

**Target date note:** `plans/axorios.md` says submission is 9 Nov. That is superseded: submit on 11 Nov and keep 12 Nov as buffer.

## Decisions

Every row below is settled; build to it without asking again.

| Area | Decision |
| --- | --- |
| Assistant name | **Axori AI**. Sidebar item, panel and page all use this name. |
| Navigation | 10 sidebar items (see Information architecture). Connections move into Settings. |
| Finance | Its own tab, named **Money**. Analytics reads the same metric definitions. |
| Demo account | Looks like a store open for 6 months. All data seeded, including marketing on platforms not yet connected. |
| Settlement currency | Buyers pay in **USD** for NGN stores. A second demo store is priced in **GBP** and charges GBP directly. |
| Seller payouts | Money stays in the seller's PayPal. Naira withdrawals go through **Paga**; AxoriOS links out and records them. AxoriOS never holds funds. |
| VAT | Demo store is **VAT-registered** at 7.5%, prices tax-inclusive. Tax fields on every order. Delivery limited to the seller's country. |
| Refunds | Built now, via PayPal Payments v2, behind an approval card. |
| Analytics | **AG Studio** on the seller's Analytics tab, unlicensed (watermark is fine for the hackathon), built from the AG Grid team's boilerplate pattern. |
| WhatsApp | **Kapso** adapter now (Twilio is paywalled). Meta Cloud API adapter later. |
| Meta, TikTok, Google | **Demo adapters** behind the real interfaces, fed by seed data, until developer accounts exist. |
| Images | **Cloudflare Workers AI, FLUX.1 \[schnell\]** for pictures; prices and text drawn on top with `next/og`. Gemini images only if billing is turned on. |
| Zapier | Allowed as **one connection** under Settings, seller agent only, writes approval-gated. Inngest stays the job runner. |
| Render | Not used. Vercel and Inngest cover hosting and jobs. |
| Video generation | No AI video model in this build. Optional motion posts (animated vertical videos built from images) as step 6.16, first to cut. |
| Zapier proposal doc | Gate 1 (AG Studio) is in. Gate 2 (AI reports) is optional. Gate 3 (Zapier demo) is replaced by the Connections design here. |

## Information architecture

The workspace has a global top bar, a grouped sidebar of 10 items, and Settings at the bottom. Every page knows which store is selected; pages marked **account** span all stores.

```
Top bar:  Store switcher · Search (Ctrl/⌘+K) · Axori AI (Ctrl/⌘+J) · Approvals badge · Notifications · Avatar

Home
Axori AI            (account + store threads)
BUSINESS
  Store
  Orders
  Customers
  Inbox
GROW
  Marketing
  Money
  Analytics
WORKSPACE
  Design            (account)
Settings            (account) · avatar menu: account, log out
```

**Mobile:** bottom bar with Home, Orders, Inbox, Marketing, More. A floating Axori AI button: tap to type, hold to talk.

### Top bar

- **Store switcher** is global. Switching changes every store-scoped page. Includes "New business".
- **Approvals badge** counts approval cards waiting. Clicking opens a list; each item also shows on its own page.
- **Search** covers orders, products, customers and posts. Its first result is always "Ask Axori AI".

### Home (glance only)

Home shows a few numbers that point to bigger pages. No to-do lists, no cards to act on. At most one quiet line: "2 things waiting for you".

| Tile | Content | Links to |
| --- | --- | --- |
| Sales | One number with a 7d / 30d / 3m / 6m toggle, sparkline, change vs previous period | Money |
| Orders to fulfil | Count of paid, unfulfilled orders | Orders |
| Store visits | Visits and share that bought | Store |
| Unread conversations | Count | Inbox |
| Low stock | Count of tracked products under threshold | Store, Products |
| Last post | Clicks and orders from the latest post | Marketing |

- **Sales** = paid orders minus refunds, in store currency, using the FX rate recorded at sale. Labelled "Sales". Fees and net live in Money.
- When the store is younger than the period, show "since you opened".

### Store

The real store, live. Sections: **Overview**, **Products & inventory**, **Promotions**, **Details**. Version history stays inside the storefront editor.

- **Overview:** storefront preview, visits, conversion, top products by revenue and trend, "Edit storefront".
- **Products & inventory:** each product has an inventory mode: `tracked` (count + low-stock threshold), `made_to_order` (daily capacity), or `unlimited`. Edit any product with Axori AI in place; edits land as a draft and publish through approval.
- **Revenue ranking:** rank by actual revenue and trend. Forecasts appear only with at least 30 orders over 4 weeks, labelled with confidence. Axori AI advice must quote the numbers behind it.
- **Import:** CSV or photos are dropped into Axori AI. It maps columns only; values pass Zod validation unchanged, missing prices stay blank and flagged. A preview table card shows problems before approval. Large imports run as an Inngest job and report failed rows.
- **Shopify:** AxoriOS is the source of truth. Each product shows "in sync" or "out of sync". Sync stays one-way.
- **Visits:** counted first-party, without cookies or personal data, so no consent banner is needed.
- **Details:** name, slug, currency, language, audience, niche, delivery zones, policies, VAT setting. This is the context Axori AI uses.

### Orders

List with payment and fulfilment status. Order detail shows both currencies, FX rate and source, PayPal capture ID, VAT, delivery, and the conversation it came from. **Refund** button (see Money).

### Customers

Contacts, labels and consent. No messages here; the profile links to the Inbox thread.

- **Sources:** a contact is created from checkout, from a chat, or from a sign-up form. Consent is stored per channel with source and timestamp. Order updates are allowed; marketing needs opt-in.
- **System labels** are computed and can't be deleted: `customer` (1+ paid order), `lead` (no paid order).
- **User labels:** create, rename, colour, delete. Labels show on Inbox threads and can filter campaigns. Deleting a label used by a scheduled campaign is blocked with a warning naming the campaigns.
- **Duplicates:** suggest merges by matching phone or email; manual merge.
- **Profile:** details, labels, consent per channel, orders, campaigns responded to. Main action "Message in Inbox"; external WhatsApp or email links are secondary and labelled.
- **Privacy:** export and delete a contact.

### Inbox

One thread view across Telegram, WhatsApp (Kapso), and later Instagram and Messenger.

- Every inbound message arrives through a channel adapter and is normalised to `InboundMessage` with its channel and business account. Threads show the channel icon.
- Sorted by latest activity. Filters: channel, label, unread, needs you, AI handling. A per-customer view merges channels.
- Replies leave through the same adapter and the same business number or bot.
- **WhatsApp 24-hour window:** show a countdown. After it expires, the composer switches to the template picker.
- **Handover:** shows who is replying. Axori AI pauses when the seller types and resumes on hand-back.
- Setup says plainly that messages to the seller's personal WhatsApp never reach AxoriOS.

### Marketing

Sections: **Create**, **Calendar**, **Campaigns**, **Performance**.

- **Create:** describe a post to Axori AI. It pulls matching media from the library, drafts image and caption, and returns an approval card.
- **Campaigns:** reminders and broadcasts triggered by events (new product, promo ends in 24 h, restock) or by hand, to segments built from labels.
- **Performance:** per post and campaign: clicks, orders, revenue and new contacts through tracked links, for every channel. Reach and engagement where the platform provides it (demo adapters provide seeded values). Breakdowns by content type, length, product, time and channel. Attributes are saved when the post is created.
- **Insights** feed in here and on Analytics: plain-language findings with an action card ("Ube Coconut grew 40% since August. Schedule a weekend promo?").

### Money

See the Money section for rules. Sections: **Overview** (PayPal balance, money in, money out, what's left), **Money in**, **Money out**, **Expenses**, **Withdrawals**, **VAT**, **Statements**.

### Analytics

The cross-tab workspace in AG Studio: sales, marketing, customers and money together. See the Analytics section.

### Design (account)

Brand kits (one per store), templates and the media library (shared across the account).

- Templates are `SiteConfig` presets, never code. They have versions; each store stays on its version. Changing a template asks "Apply to 2 stores?" through approval.
- Media uploaded in Axori AI lands here, auto-tagged by product and type; the seller can fix tags, delete, and see where an image is used.

### Settings (account)

**Your account:** Profile · Sign-in & security (magic link, password, two-factor later, active devices, log out, log out everywhere) · Preferences (app language, Axori AI reply language, voice input, theme, time zone) · Notifications (what, where, quiet hours) · Axori AI (what it remembers, approval strictness: can be stricter, never looser) · Data & privacy (export, chat retention, delete account).

**Your business:** Stores (create, archive, delete) · **Connections** (see Integrations) · Payments & payouts (PayPal account, settlement currency, Paga link) · Customer messages (order and reminder wording, WhatsApp templates, opt-out wording) · Policies (refund, privacy, terms) · Activity log (every agent action and approval, who and when) · Plan & usage (daily AI cap, images, messages) · Team & roles (placeholder).

**Log out** is also in the avatar menu.

## Axori AI

One assistant with one thread store, shown two ways: a side panel over any page, and a full page for longer work and ideation. It replaces the current `/build` page as the entry point; the storefront editor opens from Store.

### Threads and scope

- Threads are listed by topic. Each belongs to a **store** or to the **account**.
- **Account threads** are for ideas before a store exists. Their only store action is `create_store`, through an approval card. No store tools run without a `store_id` from the session.
- **Store threads** get the seller tools for that store.
- **Context chips** at the top of the panel show what Axori AI can see, for example "Eko Sweet Bakes · Red Velvet Cake · orders, last 30 days". Opening the panel from a page attaches that page's object automatically. The seller can remove a chip.
- Files and images dropped into the chat are stored in the media library (Design), tagged, and attached as context.

### Opening it

- **Ctrl/⌘+J** opens the panel over the current page; Esc closes it. Ctrl/⌘+K stays search, with "Ask Axori AI" as its first result.
- **Expand** opens the full page on the same thread.
- **Mobile:** floating button; tap to type, hold to talk. Voice uses the existing `api/voice` path.
- Shortcuts don't fire while the focus is in a text field, except Esc.

### Approval cards

An approval card is a UI block in the thread that shows exactly what will happen, with **Approve**, **Edit** and **Cancel**. Nothing runs until Approve. After approval the card shows status ("Scheduled ✓ · Undo until 09:58"). The agent never says an action happened unless the card shows it.

Cards are required for: publish, schedule, send to customers (campaigns, reminders), Shopify connect and sync, payment links, refunds, imports, template changes applied to stores, connection writes (Zapier), and expenses logged by chat.

| Card | Shows |
| --- | --- |
| Post | Channel and account, image, caption, time (Lagos), tracked link ID |
| Campaign or reminder | Segment, count per channel, skipped contacts and why (opted out, outside WhatsApp window), message preview |
| Shopify sync | Products to create, update, delete |
| Payment link | Items, store-currency total, USD charge, rate |
| Refund | Full or partial, captured USD amount, store-currency equivalent at the original rate, VAT reversed |
| Import | Preview table of mapped rows, flagged rows, counts |
| Zapier action | App, action, destination, fields sent |

**Regression to fix first:** a screenshot from 8 Nov shows the agent replying "I have scheduled that post to go out in two minutes" in plain text. Check that every tool in the list above returns a card via AI SDK `toolApproval` and runs only on approval. Add a test per tool that the action has not happened before approval.

### Unclear requests

When a request could mean two things ("chips or rope"), Axori AI answers with 2 to 4 tappable choices, for example "New store for chips and rope" and "Add products to Eko Sweet Bakes", instead of a paragraph of questions.

### Limits (unchanged)

Max 8 tool steps per turn, streaming, `maxDuration` on `api/agent`, per-store daily cap. Slow work (image generation, imports, insights) moves into Inngest jobs so `api/agent` stays under the 60 s Vercel limit.

## Data model additions

One migration (`20261109000000_v2.sql`) extends the existing 11 tables and adds 19 tables and 1 view. Every new table has `store_id` (or `owner_id` for account-level rows), RLS, and integer minor units for money. Regenerate types after it.

### Changes to existing tables

| Table | Change |
| --- | --- |
| `stores` | Add `business_profile jsonb` (idea, niche, audience, location, delivery zones, policies; Zod schema), `vat_registered boolean`, `vat_rate_bp int` (basis points, 750 = 7.5%), `prices_include_tax boolean default true`, `is_demo boolean`, `template_id`, `template_version` |
| `products` | Add `inventory_mode text check in ('tracked','made_to_order','unlimited')`, `low_stock_threshold int`, `daily_capacity int`, `category text`, `source text default 'app'` |
| `orders` | Add `contact_id`, `tax_minor`, `tax_rate_bp`, `tax_inclusive`, `delivery_country char(2)`, `paypal_fee_minor`, `paypal_net_minor` (from `seller_receivable_breakdown` at capture), `refunded_minor default 0`, `fulfilled_at`, `campaign_id`, `link_id`, `source text default 'app'` (`app`, `import`, `seed`). Status adds `refunded`, `partially_refunded`. Channel adds `facebook`, `tiktok`, `google`, `shopify` |
| `posts` | Add `content_type` (image, carousel, text), `caption_length`, `product_ids uuid[]`, `campaign_id`, `link_id`, `channel` per target |
| `conversations` | Add `contact_id`, `whatsapp_window_ends_at`, `handled_by` (`ai`, `seller`) |

### New tables

| Table | Purpose and key columns |
| --- | --- |
| `order_items` (view) | Flattens `orders.items` jsonb into rows: order, product, quantity, unit price, line total. Needed for AG Studio relations. |
| `contacts` | name, email, phone, telegram username, country, `source` (`checkout`, `chat`, `signup`, `import`), first seen, merged\_into |
| `contact_consents` | contact, channel, `marketing boolean`, source, timestamp, withdrawn\_at |
| `labels` | store, name, colour, `system boolean` |
| `contact_labels` | contact, label |
| `campaigns` | store, name, kind (`broadcast`, `new_product`, `promo_ending`, `restock`), segment (label ids), channels, status, scheduled\_at |
| `campaign_sends` | campaign, contact, channel, status, skipped\_reason, sent\_at |
| `promotions` | store, code, kind (`percent`, `fixed`), value, product ids, starts\_at, ends\_at |
| `tracked_links` | store, short code, target, post or campaign or message id |
| `link_clicks` | link, at, country, device class (no IP stored) |
| `store_visits` | store, day, path, visits, unique visitors (aggregated, cookieless) |
| `post_metrics` | post, channel, day, reach, impressions, engagements, clicks, `source` (`platform`, `seed`) |
| `refunds` | order, PayPal refund id, amount\_minor and currency (captured currency), store-currency equivalent, VAT reversed, status, reason, requested\_by |
| `expenses` | store, day, amount\_minor, currency, category, note, receipt media id, `source` (`chat`, `receipt`, `seed`) |
| `withdrawals` | store owner, day, usd\_minor, ngn\_minor, rate, provider (`paga`), reference, `source` |
| `fx_rates` | currency pair, day, rate, source (daily history; seeded for 6 months) |
| `media` | owner, store (optional), url, kind, tags, product ids, `source` (`upload`, `generated`) |
| `insights` | store, period, finding, numbers jsonb, suggested action, status |
| `connections` | Extend the existing \`platform\_connections\` rather than adding a table: add owner, store (optional), provider, scope, permissions jsonb (`always`, `approve`, `blocked` per tool), status, last\_used\_at, encrypted token |
| `activity_log` | owner, store, actor (`seller`, `axori_ai`, `system`), action, target, approval id, at |
| `ai_threads` | owner, store (nullable for account threads), title, updated\_at; messages stay in `agent_sessions` or move here |

### Shared metric definitions

One module, `src/modules/analytics/metrics.ts`, defines every number shown in two places: **Sales** (paid orders minus refunds, store currency, rate at sale), **Net** (Sales minus PayPal fees), **Orders**, **AOV**, **Conversion** (orders / visits), **Repeat rate**, **Post conversion** (orders with that `link_id`). Home, Store, Marketing, Money and Analytics all import from it. A test asserts Home's Sales equals Money's Sales for the same period.

## Integrations and adapters

Every outside service stays behind an interface in `src/modules/<name>/adapters/`, picked by the registry from env flags. Swapping a demo adapter for a real one is one file and one flag; the agent never changes.

| Interface | Adapter | State | Flag and keys |
| --- | --- | --- | --- |
| `PaymentProvider` | PayPal Orders v2 + Payments v2 refunds | Live (sandbox); refunds new | existing `PAYPAL_*` |
| `Channel` | Telegram bot | Live | existing |
| `Channel` | **Kapso WhatsApp** | New | `WHATSAPP_PROVIDER=kapso`, `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET` |
| `Channel` | Twilio WhatsApp | Off (paywalled) | `WHATSAPP_PROVIDER=twilio` |
| `Channel` | Meta (Instagram, Messenger) | Demo adapter | `META_PROVIDER=demo` |
| `Publisher` | Telegram channel, download pack | Live | existing |
| `Publisher` | Meta (Facebook, Instagram), TikTok, Google Business Profile | Demo adapters | `META_PROVIDER=demo`, `TIKTOK_PROVIDER=demo`, `GOOGLE_PROVIDER=demo` |
| `ImageProvider` | **Cloudflare Workers AI, FLUX.1 \[schnell\]** | New, default | `IMAGE_PROVIDER=cloudflare`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN`, `CLOUDFLARE_IMAGE_MODEL` |
| `ImageProvider` | `next/og` templates | Live, fallback | none |
| `ImageProvider` | Gemini image | Off until billing | `IMAGE_PROVIDER=gemini` |
| `CommercePlatform` | Shopify | Live | existing |
| `AppConnection` (new) | **Zapier MCP** | New | `ZAPIER_ENABLED`, `ZAPIER_MCP_URL`, `ZAPIER_MCP_TOKEN` |
| Analytics UI | **AG Studio** | New | `AG_STUDIO_ENABLED`, optional `AG_STUDIO` licence key (unset = watermark) |

### Kapso WhatsApp

- Sandbox number, no Meta account needed. A tester joins by sending a 6-character code from their phone; codes expire 15 minutes after the session is created.
- Inbound messages arrive by Kapso webhook to `api/webhooks/kapso`; replies go out through Kapso's API. Text and interactive messages work in the sandbox.
- Sandbox limits: one recipient (the session's number), no templates, no broadcasts. Campaigns and reminders over WhatsApp stay seeded.
- Sandbox replies use Kapso project credits at Meta's service rate. If a send fails for credits, log it, show "WhatsApp paused: add Kapso credits" in Inbox, and don't retry in a loop.
- **Webhook security:** check Kapso's docs for a signature header first. If there isn't one, require a secret path token (`/api/webhooks/kapso/<KAPSO_WEBHOOK_SECRET>`) and reject everything else with 403. Same rule as the others: insert into `webhook_events`, return 200, work in Inngest, no LLM call inside the request.

### Cloudflare FLUX images

- REST: `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell` with `Authorization: Bearer <token>` and `{ prompt, steps: 4 }`. The response's `result.image` is base64. Tested by Ebuka on 9 Nov.
- Free allowance: 10,000 Neurons a day, about 170 images at 1024×1024, reset 00:00 UTC. On 429 or quota errors, fall back to `next/og` alone.
- The model draws the picture only. Captions, prices and the store name are drawn on top with the existing `next/og` renderer from database values. The prompt never contains a price.
- Save outputs to Supabase Storage and the `media` table with `source = 'generated'`.

### Demo adapters (Meta, TikTok, Google)

- Implement the same `Publisher` and `Channel` interfaces. Publishing marks the post published and returns a fake permalink under the store's own domain (`/s/<slug>/p/<post-id>`), never a real platform URL.
- Metrics come from `post_metrics` rows with `source = 'seed'`. A nightly Inngest job adds small daily increments for posts under 14 days old so charts move.
- Settings shows them as connected for the demo store.

### Zapier connection

- Lives in Settings, Connections. One Zapier MCP server owned by Ebuka for the demo. Per-merchant Zapier linking is roadmap.
- **Only the seller agent** can call it. The sales agent, which reads customer messages, never gets connection tools; enforce in the tool registry, with a test.
- Allowlisted actions only. Demo action: "Export orders to Google Sheets". Every write goes through an approval card, is logged in `activity_log`, and uses an idempotency key `(store, order, action, destination)`.
- Zapier MCP counts 2 tasks per tool call and the free plan has no webhook triggers, so actions run on demand, never automatically after each order.
- A Zapier outage or quota error shows a clear error and never touches the order or payment.

### Connections page (Settings)

Modelled on Claude's connectors, ChatGPT's apps and Shopify's apps page.

- **Directory** grouped as Sales channels, Messaging, Social, Payments, Files & apps. Custom MCP sits under **Advanced**, off by default, with a plain warning.
- Each connection shows status, scope (this store or all stores), last used, activity, and the personal data it can access.
- **Permissions per tool:** `Always allow`, `Needs approval`, `Blocked`. Defaults: read = Always allow, write = Needs approval, delete = Blocked. Sellers can make these stricter.
- Flag permissions unused for 30 days.
- Disconnect explains the effect first ("3 scheduled Telegram posts will be paused").
- Health: expired token or failed sync shows **Reconnect**, never a silent failure.
- Connect buttons also appear where they're needed: Inbox empty state (WhatsApp), Store (Shopify), Marketing (social).

## Analytics (AG Studio)

Analytics is an AG Studio workspace over the seller's own data, built by following the AG Grid team's [PayPal hackathon boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate). It targets the "Best Use of AG Grid" sponsor prize ($5,000 / $2,000 / 3 × $1,000).

### Copy the pattern, not the files

The boilerplate has no LICENSE file, so it is all rights reserved. Read it for the pattern and write our own code in our MIT repo.

- **Packages, pinned exactly:** `ag-grid-community` 36.2.0, `ag-grid-react` 36.2.0, `ag-studio` 3.0.0, `ag-studio-react` 3.0.0. The boilerplate runs on Next 16.3.6 and React 19.2.8, matching our stack.
- **Server page** (`src/app/(dashboard)/dashboard/analytics/page.tsx`): `await connection()`, load the session's store, fetch rows through module functions that require `storeId`, return plain objects. The browser never sends a store ID.
- **Client component:** `AgStudioProvider` with `licenseKey={process.env.AG_STUDIO}` passed from the server; unset means the watermark, which is fine for the hackathon. Gate rendering with `useSyncExternalStore` so Studio only mounts in the browser, as the boilerplate does.
- **`studio/data.ts`:** tables, many-to-one relations, a shared calendar, and calculated measures, built with the boilerplate's `fields`, `manyToOne`, `onCalendar` and `ratio` helper pattern.
- **Saved reports:** localStorage per browser for now, as in the boilerplate.
- **No AI assistant in v1.** The boilerplate's OpenAI proxy has no auth and no rate limit. A Gemini adapter behind session auth and the daily cap is optional (Gate 2) if time allows.
- **Theme:** AxoriOS tokens, not PayPal's.
- Behind `AG_STUDIO_ENABLED`. Off returns the basic dashboard. Checkout never depends on it.

### Tables in Studio

| Table | Source | Relates to |
| --- | --- | --- |
| Orders | `orders` (paid, refunded, partially refunded) | contacts, campaigns, links, calendar |
| Order items | `order_items` view | orders, products |
| Products | `products` |  |
| Customers | `contacts` + labels |  |
| Refunds | `refunds` | orders, calendar |
| Expenses | `expenses` | calendar |
| Posts | `posts` + `post_metrics` | campaigns, calendar |
| Campaigns | `campaigns` + `campaign_sends` |  |
| Clicks | `link_clicks` via `tracked_links` | posts, campaigns, calendar |
| Visits | `store_visits` | calendar |
| PayPal transactions | PayPal Transaction Search API (see below) | orders by capture ID |

**Measures:** Sales, Net, Orders, AOV, Conversion, Repeat rate, Refund rate, VAT collected, Post conversion. Use the shared definitions module; Studio's expressions must give the same numbers, checked by a test.

### Default report (opens on first visit)

1. **Sales over time** with 7d, 30d, 3m, 6m filters
2. **Top products** by revenue and units, with trend
3. **Sales by channel** (web, Telegram, WhatsApp, Facebook, Instagram, TikTok, Google)
4. **Marketing funnel:** reach, clicks, orders, revenue per channel
5. **Customers:** new vs repeat, by label
6. **Cross-currency reconciliation grid:** one row per order with store-currency total, USD charged, FX rate and source, PayPal capture ID, PayPal fee and net, VAT, refund, status. This is the view other teams can't show; give it prominence.
7. **PayPal transactions grid:** live rows from PayPal's Transaction Search, matched to orders by capture ID, with mismatches flagged

### PayPal Transaction Search

- `GET /v1/reporting/transactions` with `fields=all`, at most 31 days per request, no fractional seconds. New activity can take up to 3 hours to appear.
- Requires the **Transaction search** feature enabled on the sandbox REST app.
- Only the sandbox-scripted orders exist in PayPal. Imported and seeded orders show "Imported, not in PayPal" in the match column, never as mismatches.
- When the API is slow or off, fall back to the capture data stored on our orders.

## Money: payments, FX, VAT, refunds, withdrawals

Money shows what came in, what went out and what's left, in store currency, with exact PayPal fees. AxoriOS never holds funds: buyers pay into the seller's PayPal, and naira withdrawals go through Paga.

### Money tab sections

| Section | Content |
| --- | --- |
| Overview | PayPal balance (whole account, USD), money in, money out, what's left for the period |
| Money in | Paid orders: gross, PayPal fee, net, VAT, by day and channel |
| Money out | PayPal fees, refunds, FX difference, expenses, AxoriOS plan fees |
| Expenses | Logged by chat ("I spent ₦20,000 on flour") or receipt photo, through an approval card; categories editable |
| Withdrawals | PayPal to Paga history: USD out, ₦ in, rate received. "Withdraw to naira via Paga" links out |
| VAT | VAT collected per month, credit notes from refunds, VAT owed |
| Statements | Monthly CSV and PDF for an accountant |

- **Profit** is labelled "estimated from expenses you logged".
- **PayPal balance** comes from `GET /v1/reporting/balances` (the boilerplate uses it) and is labelled "whole PayPal account"; per-store figures come from our orders.

### FX

- Three rates are stored and compared: the **quote** shown to the buyer (`orders.fx_rate`), PayPal's **settlement**, and the **withdrawal** rate from Paga. Money shows the gain or loss between quote and withdrawal as "FX difference".
- Sales are reported at the rate at sale. Revaluing the USD balance at today's rate is labelled as such, never counted as profit.
- Daily rates go into `fx_rates` (from open.er-api.com for live, seeded for history).

### Payouts to naira (Paga)

Since January 2026, PayPal works in Nigeria through Paga. A seller links her PayPal business profile to a Paga account, receives from 200+ countries, and withdraws in naira at market rates. Merchant-level Paga gateway integration isn't open yet, so AxoriOS links out and records withdrawals. Sources: [TechCabal](https://techcabal.com/2026/01/27/paypal-returns-to-nigeria-after-two-decades-this-time-through-paga/), [Paga](https://www.mypaga.com/home/pagapaypal).

### VAT

- Tax follows where goods are delivered, not where the buyer pays from. A UK buyer paying for a cake delivered in Lagos is a Nigerian sale.
- Nigerian VAT is 7.5%. Businesses with turnover of ₦100m or less and fixed assets of ₦250m or less are exempt from registering and charging, from 1 Jan 2026 ([Forvis Mazars](https://www.forvismazars.com/ng/en/services/tax/nigeria-s-tax-reform-in-focus/2025-nta-vat-key-business-changes)).
- Store setting: not registered (default, threshold explained, "check with a tax adviser") or registered with rate and inclusive or exclusive prices.
- Computed server-side at order creation and stored on the order: `tax_minor`, `tax_rate_bp`, `tax_inclusive`, `delivery_country`. Inclusive: tax = total × rate / (1 + rate), rounded to the minor unit.
- Every receipt shows a VAT line, including "VAT: ₦0 (seller not VAT-registered)".
- Delivery is limited to the seller's country until a Taxes & duties module exists. The GBP demo store delivers within the UK only.
- **Demo store:** registered, 7.5%, inclusive; seeded turnover is above the threshold.

### Refunds

1. Orders, Refund opens an approval card: full or partial, in the **captured currency and amount**, with the store-currency equivalent at the original rate and the VAT to reverse.
2. Before showing Approve, check the PayPal balance. If it's too low (the seller already withdrew to Paga), the card says "Add $X to PayPal before refunding" instead of failing.
3. On approval: `POST /v2/payments/captures/{capture_id}/refund` with `PayPal-Request-Id` = refund row ID, so a retry can't refund twice. Partial refunds send `amount`.
4. `PAYMENT.CAPTURE.REFUNDED` webhook confirms: verify signature, insert into `webhook_events`, return 200, update in Inngest.
5. Update `orders.refunded_minor` and status, write the `refunds` row and a VAT credit note, optionally restock.
6. Record the fee outcome from PayPal's refund response; don't assume the fee comes back.
7. Disable the button after PayPal's refund window, with the reason shown. The window is believed to be 180 days from capture; confirm in PayPal's docs while building.

**Tests:** a second approval of the same refund sends nothing; a partial refund larger than what's left is refused; another store's order can't be refunded.

## Demo account and seed data

The demo seller opens to a business that has run for 6 months (9 May to 9 Nov 2026), with every tab full and every number agreeing. History comes in through our own import flow; the most recent orders are real PayPal sandbox payments made by script.

### Stores

| Store | Currency | Charges | Delivery | History |
| --- | --- | --- | --- | --- |
| Eko Sweet Bakes (`demo`) | NGN | USD at the stored rate | Lagos only | 6 months, about 1,600 orders |
| Eko Sweet Kitchen UK | GBP | GBP directly | UK only | 3 months, about 150 orders of cake kits |

Keep existing product IDs: the Shopify sync and past orders point at them (`scripts/seed-demo-store.mts`).

### Scenario (what the data must show)

- **Turnover:** about ₦10m a month rising to ₦14m, above the VAT threshold; VAT 7.5% inclusive on every order.
- **Products:** Red Velvet Celebration Cake is the steady best-seller. Ube Coconut Cake launches 3 Aug and grows about 40% month on month. Chin Chin Gift Jar declines and goes inactive on 7 Nov (as in the live store). One tracked product (cupcake boxes) runs out in early September and loses sales for 5 days.
- **Seasonality:** Children's Day (27 May), Father's Day (21 Jun), Independence Day (1 Oct), and a pre-Christmas build-up from November. Fridays and Saturdays are the busiest days.
- **Promos:** "INDEPENDENCE10" (25 Sep to 1 Oct) triples orders and pays for itself. "BACK2SCHOOL" (8 to 15 Sep) barely moves sales.
- **Channels:** web first; Telegram from June; WhatsApp grows after August; Instagram and Facebook bring the most reach; TikTok brings reach but low conversion; Google Business Profile brings few but high-value orders.
- **Customers:** about 900 contacts, 60% of revenue from repeat buyers, a lead list that converts after a campaign. User labels: "Corporate", "Birthday regular", "Abuja", "Wholesale".
- **Buyers abroad:** about 15% of orders paid from the UK, US, Canada and Germany for delivery in Lagos.
- **Refunds:** about 4% of orders, a third of them partial.
- **Expenses:** flour, sugar, butter, packaging, riders, gas, staff, ads (demo), monthly.
- **Withdrawals:** 2 to 3 PayPal to Paga withdrawals a month at a rate slightly worse than the quote.
- **FX:** daily NGN/USD rates as a random walk ending at the live rate (about 1,346 on 5 Nov), saved in `fx_rates` with `source = 'seed'`.
- **Marketing:** about 120 posts across Telegram, Facebook, Instagram, TikTok and Google; 10 campaigns (broadcast, new product, promo ending, restock); tracked links on every post; reach, engagement and clicks per day; conversions through `link_id`.
- **Visits:** daily store visits with a conversion rate of about 2 to 4%.
- **Insights:** 6 to 8 findings the data actually supports, for example "Ube Coconut grew 40% since August", "INDEPENDENCE10 drove 3× orders", "TikTok reach is high but converts at 0.3%".

### How it's built

1. **`scripts/seed-v2.mts`** generates everything from a fixed seed (`SEED=20261109`, a seeded PRNG such as mulberry32), so every run produces the same account.
2. Orders, products and contacts are written as CSV to `data/demo/` and loaded through the **import module** that the UI uses, with `source = 'import'`. Marketing, metrics, visits, expenses, withdrawals and insights are inserted directly with `source = 'seed'`.
3. **`scripts/sandbox-orders.mts`** makes 20 to 30 real sandbox payments with Playwright, logging in as sandbox personal buyers from the UK, US, Canada and Germany (`SANDBOX_BUYERS` in `.env.local`, JSON). It mixes web and Telegram payment links, lets the normal return-page capture and webhook run, then performs 3 refunds (1 partial) through the refund flow. Reuse `scripts/sandbox-pay.ts` where it fits.
4. **Images:** generate about 40 post images with FLUX once, store them in `media`, and reuse them across older posts. Skip images that already exist, so a rerun costs nothing. Stay under the daily allowance of about 170.
5. **`scripts/reset-demo.mts`** deletes the demo stores' `import` and `seed` rows and reruns steps 1, 2 and 4. It keeps product IDs, Shopify mappings and real sandbox orders. Run it before recording and before judging opens on 1 Dec.
6. The 7 existing test orders (notes such as "E2E…" and "Locale check") get `source = 'test'` and are hidden from every tab. Their evidence stays in Progress.

### Checks after seeding

- Home's Sales equals Money's Sales and Analytics' Sales for 7d, 30d, 3m and 6m.
- Every order's VAT, fee and net add up; the reconciliation grid shows no mismatches for real sandbox orders.
- Every post with clicks has a matching `tracked_links` row; orders with a `link_id` are dated after the click.
- Each story above is visible on a chart without explanation.

## Build plan (Phase 6)

Sixteen steps over 9 and 10 Nov, then record and submit on 11 Nov. Add them to `plans/axorios.md` with a Progress row each. Commit each as `feat(<module>): 6.x <title>`. If 10 Nov ends with steps open, cut from the bottom of the cut list.

| Step | Title | Acceptance | Verification | Blocked by | Day |
| --- | --- | --- | --- | --- | --- |
| 6.0 | Docs and config | `CLAUDE.md` changes applied; `docs/spec-v2.md` saved; new env keys in `.env.example` and Vercel; stray lines in `.env.local` commented | `npm run build` green; `vercel env ls` shows the keys (names only) | none | 9 Nov |
| 6.1 | Approval regression | Every tool in the approval list returns a card and runs only on approval | One test per tool: nothing happened before approval | 6.0 | 9 Nov |
| 6.2 | v2 migration | Tables and columns from Data model; RLS on every new table; `order_items` view; metrics module | `db push`; types regenerated; RLS test: seller A can't read seller B's new rows | 6.0 | 9 Nov |
| 6.3 | Shell and Axori AI | New top bar and sidebar; Axori AI panel with Ctrl/⌘+J, full page, threads (account and store), context chips; mobile bottom bar and floating button | Driven in headless browser at 1280 px and 390 px; shortcut opens with the page's chip | 6.2 | 9 Nov |
| 6.4 | Seed and import | `seed-v2`, import module, `reset-demo`; both stores populated; test orders hidden | Checks after seeding all pass; rerun gives identical counts | 6.2 | 9 Nov |
| 6.5 | Cloudflare FLUX adapter | `ImageProvider` adapter, `next/og` overlay for text and prices, fallback on quota | `scripts/spike-image.mts` saves an image with database price drawn on it; forced 429 falls back | 6.0 | 9 Nov |
| 6.6 | Analytics (AG Studio) | Tables, relations, measures, default report with reconciliation and PayPal transactions grids; flag off falls back | Studio Sales equals metrics module for 4 periods; another store's rows never load; checkout passes with flag off | 6.4 | 10 Nov |
| 6.7 | Money and refunds | Money tab sections; refund flow with card, balance check, idempotency, webhook, VAT credit note | Real sandbox full and partial refund; repeat approval sends nothing; webhook replay changes nothing | 6.4 | 10 Nov |
| 6.8 | Home and Store overview | Home tiles; Store Overview, inventory modes, revenue ranking, visits | Tiles equal Money and Analytics for each period; low-stock count matches | 6.4 | 10 Nov |
| 6.9 | Customers and labels | Contacts, consents, system and user labels, merge, label delete guard; labels on Inbox threads | Deleting a label used by a scheduled campaign is blocked; contact from checkout gets consent rows | 6.4 | 10 Nov |
| 6.10 | Marketing performance | Performance view with per-post metrics and breakdowns; campaigns list; demo adapters for Meta, TikTok, Google | Post conversion equals orders with that `link_id`; demo publish returns an internal permalink | 6.4, 6.5 | 10 Nov |
| 6.11 | Kapso WhatsApp | Adapter, webhook with secret, Inbox replies, 24 h window countdown | Real phone round trip on the Kapso sandbox; forged webhook 403 | 6.0 | 10 Nov |
| 6.12 | Settings and Connections | Account and business settings; Connections directory, permissions, disconnect effects; activity log | Log out works from both places; a Blocked tool can't run | 6.3 | 10 Nov |
| 6.13 | Zapier connection | One allowlisted action (export orders to Google Sheets) through an approval card | Row appears in the sheet; rejected card writes nothing; sales agent has no Zapier tool (test) | 6.12 | 10 Nov |
| 6.14 | Design tab | Brand kits, templates with versions, media library with tags | Uploading in Axori AI lands in the library with tags | 6.3 | 10 Nov |
| 6.15 | Sandbox orders and final reset | Run `sandbox-orders` (20 to 30 real payments, 3 refunds); run `reset-demo`; full click-through | Reconciliation grid matches PayPal for real orders; every tab opens with data | 6.6, 6.7 | 10 Nov night |
| 5.4 | Video | Ebuka records his own video, under 3 minutes | Watched once end to end | 6.15 | 11 Nov |
| 5.5 | Submit | Devpost entry, repo public, testing notes private | Submission confirmation | 5.4 | 11 Nov |

### Cut list (cut from the bottom first)

1. 6.14 Design tab: keep only the media library
2. 6.13 Zapier: show the Connections page without a live action
3. 6.12 Settings: keep log out, profile and Connections; stub the rest
4. 6.11 Kapso: WhatsApp stays on the demo adapter
5. AG Studio Gate 2 (AI reports) is already out unless everything else is done

Never cut: 6.1, 6.2, 6.4, 6.6, 6.7, 6.15. They carry the demo and the AG Grid prize.

### Optional 6.16: motion posts

Only after every never-cut step passes; first to cut. A motion post is a 6 to 10 second vertical video (1080×1920) built from a FLUX image or product photo with slow zoom and pan, the product name, the database price and a call to action. No AI video model.

- Rendered **in the browser** with a canvas and `MediaRecorder`, so it costs nothing and avoids Vercel's 60 s limit. Prefer MP4 where the browser supports it; otherwise WebM.
- Saved to `media` with `kind = 'video'`; published through the same approval card; Telegram accepts it, other platforms go through demo adapters or the download pack.
- Acceptance: a motion post for Red Velvet shows the database price and plays on a phone. Verification: price in the video matches the product row; a changed price produces a new video.
- Applying this step also changes CLAUDE.md's Never list from "video generation" to "AI video generation (motion posts from images are allowed)".

## CLAUDE.md and env changes

Claude Code applies these in step 6.0, in one commit.

### CLAUDE.md edits

- **Read list:** add `docs/spec-v2.md` first, with "this wins over `docs/spec.md` where they differ".
- **Product paragraph:** add "The in-app assistant is called Axori AI." Replace the submit line with "Submit by 11 Nov 2026; hard deadline 12 Nov."
- **Stack:** add `ag-grid-community`, `ag-grid-react`, `ag-studio`, `ag-studio-react` (exact versions); Cloudflare Workers AI (FLUX.1 schnell) for images; Kapso for WhatsApp; Zapier MCP as one seller-side connection; Playwright for sandbox scripts.
- **Version pinning:** add the four AG packages to the exact-version list.
- **Module rules:** add `AppConnection` (Zapier) and demo adapters for Meta, TikTok and Google to the adapter list.
- **Non-negotiables, add:**
  - Refunds go through an approval card and use `PayPal-Request-Id`.
  - VAT is computed server-side and stored on every order.
  - Only the seller agent may use connection tools; the sales agent never does.
  - Every number shown in two places comes from `src/modules/analytics/metrics.ts`.
  - Image prompts never contain prices; text and prices are drawn by `next/og` from the database.
  - Kapso webhooks follow the same verify, store, 200, Inngest rule.
- **Demo data rule:** seeded and imported rows carry `source`; `reset-demo` must restore the demo account in one command.
- **Never list:** remove nothing else. Change "n8n/Make" to "n8n/Make (Zapier MCP is allowed only as the one approval-gated seller connection in spec v2)". Add "Render".

### New env keys

| Key | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN`, `CLOUDFLARE_IMAGE_MODEL` | Image generation (already in Ebuka's `.env.local`) |
| `IMAGE_PROVIDER` | `cloudflare`, `og`, or `gemini` |
| `WHATSAPP_PROVIDER`, `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET` | Kapso WhatsApp |
| `META_PROVIDER`, `TIKTOK_PROVIDER`, `GOOGLE_PROVIDER` | `demo` until real accounts |
| `AG_STUDIO_ENABLED`, `AG_STUDIO` | Analytics flag; licence key optional |
| `ZAPIER_ENABLED`, `ZAPIER_MCP_URL`, `ZAPIER_MCP_TOKEN` | Zapier connection |
| `SANDBOX_BUYERS` | JSON list of sandbox buyer logins for `sandbox-orders` |
| `SEED` | Fixed seed for `seed-v2` (default 20261109) |

Add each to `.env.example` with a comment, and to Vercel production. Never print values.

## Roadmap after the hackathon

None of this is built now; the v2 design leaves a place for each so nothing moves later.

| Area | Next | Depends on |
| --- | --- | --- |
| Social | Real Meta (Facebook, Instagram, Messenger, WhatsApp Cloud API), TikTok, Google Business Profile adapters replacing demo ones; real reach and engagement | Developer accounts and app reviews |
| Commerce platforms | WooCommerce and other `CommercePlatform` adapters; two-way Shopify sync with orders | Conflict rules: AxoriOS stays source of truth |
| Payments | Buyers pay in their own currency; Paga merchant gateway integration when it opens | PayPal currency rules, Paga API |
| Taxes | Taxes & duties module for shipping abroad (UK VAT on imports, duties) | Tax provider decision |
| Connections | Per-merchant Zapier linking; custom MCP for sellers; Google Drive import | Multi-tenant auth checks |
| Insights | Weekly insights job with action cards for every store; forecasts with confidence | 4+ weeks of data per store |
| Analytics | AG Studio AI reports through a Gemini adapter; saved reports in the database; licence decision | AG Studio commercial licence |
| Images | FLUX.2 \[klein\] for restyling the seller's own product photos | Workers AI usage |
| Team | Staff accounts and roles | Settings slot already reserved |
| Refunds | Disputes (PayPal Disputes API) |  |

**AI video** comes later through a new `VideoProvider` adapter. Free hosted tiers are small, watermarked and often non-commercial; open models like Wan 2.2 (Apache 2.0) need a rented GPU. Pick a provider when there's budget.

## Tasks for Ebuka

These need a person and accounts; Claude Code can't do them.

- [ ] Export this doc as Markdown to `docs/spec-v2.md` in the repo (or paste it to Claude Code)
- [ ] Comment out the stray plain-text lines in `.env.local` (about lines 45 to 47)
- [ ] Kapso: sign up, create a sandbox session with your phone, send one test reply, and put the API key and phone number ID in `.env.local`
- [ ] Zapier: create the MCP server at mcp.zapier.com, enable "Google Sheets: create row", connect a test sheet, and put the MCP URL and token in `.env.local`
- [ ] PayPal: create sandbox personal buyers in the UK, US, Canada and Germany; add their logins to `SANDBOX_BUYERS`
- [ ] PayPal: enable **Transaction search** on the sandbox REST app
- [ ] Optional: turn on Gemini billing with a $10 alert, if you want Gemini images as well
- [ ] Optional: get a Meta developer account; the demo adapter is replaced when it arrives
- [ ] 11 Nov: record the video (under 3 minutes) and submit; put logins in Devpost's private testing notes
