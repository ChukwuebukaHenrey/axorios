# AxoriOS — Architecture & Build Spec

2026-11-04 · Ebuka

## Summary

AxoriOS (said "axo-ree-os") is a voice-first AI agent that takes a non-technical seller from a business idea to a first paid order: brand, storefront, PayPal checkout, chat-channel selling and scheduled marketing. Demo promise: **idea to first paid order in under 30 minutes.**

- **Deadline:** submissions close 12–13 Nov 2026 (treat 12 Nov as hard). About 8 build days.
- **Hard requirements:** a working prototype, a public open-source repo, a public YouTube demo under 3 minutes, and meaningful use of at least one PayPal API in sandbox.
- **Build style:** one Next.js TypeScript app, split into modules with fixed interfaces so each can be built, tested and swapped alone.
- **Biggest constraint:** no Meta developer access yet. Every Meta feature sits behind an adapter and ships later without touching the agent.

## Incumbent research

Each incumbent owns one slice. Nobody combines conversational setup, chat-native selling, global payments and marketing for a seller with no store yet. That gap is the pitch.

| Product | What it does | How it's built / trade-off | What we take |
|---|---|---|---|
| Shopify Sidekick | Agent inside the Shopify admin | One LLM with tools. It never changes the store directly: it shows a preview the merchant approves. Shopify warns against early multi-agent designs and moves tool instructions into tool responses (summary). Needs an existing Shopify store. | Single agent, clear tools, preview-then-approve for anything public. Theme design intent stored as a file the agent reads (DESIGN.md), which maps to our brand kit. |
| Durable | AI site + brand + CRM in ~30 s | Form inputs, then templated generation. Fast, but limited customisation and aimed at service businesses, not product sellers. | Templates + generated content, not generated code. Speed as the headline. |
| Bumpa | Nigerian store + inbox for IG/FB/WhatsApp | Meta messaging integration. Their data showed about 40% of sales start on social channels. Manual setup; no AI building. | Unified inbox across channels; social-first selling is where the volume is. |
| Take App | Store link that sends orders to WhatsApp | Customer builds a cart on a web page, it arrives in WhatsApp as one clean message. Catalog sync needs Meta Business access and drops categories and variants (docs). 300k+ businesses. | The web storefront is the source of truth; chat is the delivery channel. Catalog sync is a later add-on. |
| Catlog | Store link + WhatsApp orders, Lagos | Launched without online payment because buyers wanted to talk first. Chatbot was on the roadmap. | Keep a human-feeling chat path next to checkout; let the agent answer, never force pay-only. |

As of 4 Nov 2026.

## Verified constraints

Five facts change the design; two of them correct earlier assumptions.

| Fact | Effect on design | Source |
|---|---|---|
| Nigerians can now receive PayPal payments by linking PayPal to a Paga wallet (since Jan 2026), with naira withdrawal and 25 currencies. | The Nigerian-seller pitch now works. Lead with a Lagos seller taking PayPal from local and diaspora buyers. | TechCabal, AllAfrica |
| PayPal Agent Toolkit plugs into the Vercel AI SDK; it covers orders, invoices, subscriptions and more, with a sandbox flag. Its examples use the older AI SDK model type. | Use it for agent-side payment tools. Version fit with the latest AI SDK is unproven: spike on day 1. | GitHub, PayPal docs |
| Gemini image models have no free API tier. Flash and Flash-Lite text models do. | Text agent runs free. Images need billing on (about $0.03–0.04 each) or a free fallback provider. | Pricing summary, Gemini rate limits |
| Twilio WhatsApp Sandbox needs no Meta business account. Testers join with a code; sessions expire after 3 days; outbound uses only preset templates; 1 message per 3 s. | Real WhatsApp for the demo without Meta. Customer messages first, agent replies inside the window. Rejoin before recording. | Twilio docs |
| Inngest free tier: sleeps up to 7 days, retried steps, works on serverless. | Scheduled posts and slow image jobs run here. Schedule within 7 days for the demo. | Inngest sleeps |

Two more facts from the second round of research:

| Fact | Effect on design | Source |
|---|---|---|
| PayPal REST supports about 25 currencies (USD, EUR, GBP, CAD, AUD, JPY, CHF and others). Naira, cedi, shilling and rand are not on the list. JPY, HUF and TWD take no decimals. | Owners price in any currency. Supported currencies are charged as-is; unsupported ones are converted to a settlement currency at a rate locked on the order. Decimal places come from the currency, not a constant. | PayPal currency codes |
| Shopify's Admin GraphQL API can create products, collections and pages with normal scopes. Writing theme files (`themeFilesUpsert`) needs `write_themes` plus an exemption from Shopify. Stores can't be created by API, so the seller connects one. | The agent fills a Shopify store's catalog and pages for sure. Re-styling the theme depends on a day-1 spike on a development store. | themeFilesUpsert docs |

Meta developer access is blocked on phone verification. Nothing in the critical path depends on it.

## System architecture

Sellers and customers enter through three routes; all of them call one agent runtime, which reaches vendors only through modules.



PayPal, Twilio and Telegram call back into the webhook routes, which hand events to the same modules. Meta is dashed: its adapters slot under `channels` and `publishers` when access clears, with no change above that row. The `platforms` module (Shopify sync, Admin GraphQL) sits in the same row and follows the same pattern.

## Modules and interfaces

Eleven modules, each owning one folder under `src/modules/`. Modules talk only through the exported interface in their `index.ts`; nothing imports another module's internals. Every outside vendor sits behind an interface, so Meta, Paystack or another image model is a new file, not a rewrite.

| Module | Owns | Public interface | Built now | Later |
|---|---|---|---|---|
| `brand` | Brand kit: name, logo, palette, fonts, tone, tagline, reference images | `createBrandKit(input)`, `updateBrandKit(id, patch)`, `extractStyleFromReference(imageUrl)` | Yes | — |
| `catalog` | Products, prices in the owner's currency, stock | `addProducts(storeId, items)`, `updateProduct()`, `listProducts()`, `reserveStock()` | Yes | Variants |
| `storefront` | Templates, the site's draft and published versions, public pages at `/s/[slug]` | `chooseTemplate(storeId, templateId)`, `editSection(storeId, sectionId, patch)`, `previewUrl(storeId)`, `publish(storeId)`, `revert(storeId, version)` | 3 templates | More templates, custom domains |
| `payments` | Checkout, capture, invoices, payment links, webhooks, currency conversion | `PaymentProvider`: `createCheckout(order)`, `capture(id)`, `createPaymentLink(order)`, `verifyWebhook(req)`; `quote(amount, from, to)` | PayPal | Paystack |
| `orders` | Order records, status, the exchange rate used | `createOrder()`, `markPaid(paymentRef)`, `listOrders(storeId)` | Yes | Delivery tracking |
| `platforms` | Pushing the store to outside commerce platforms | `CommercePlatform`: `connect(credentials)`, `syncCatalog(storeId)`, `syncBrand(storeId)`, `storefrontUrl()` | Shopify | WooCommerce, Jumia, Konga |
| `channels` | Two-way customer chat | `Channel`: `send(to, msg)`, `parseWebhook(req)`, `verify(req)` | Twilio WhatsApp, Telegram, web chat | Meta WhatsApp Cloud API, Instagram DM |
| `publishers` | Outbound posts to social accounts | `Publisher`: `publish(post)`, `capabilities()` | Telegram channel, downloadable post pack | Facebook Page, Instagram |
| `creative` | Images and captions in the brand's style | `ImageProvider`: `generate({prompt, referenceImages, size})` | Gemini image | Video, other models |
| `agent` | LLM runtime, tool registry, conversation state | `runSellerAgent(storeId, input)`, `runSalesAgent(storeId, channelMsg)` | Yes | Evals |
| `jobs` | Background and scheduled work | Inngest functions: `creative.generate`, `post.publish`, `platform.sync`, `order.followup` | Yes | — |

### Folder layout

```
src/
  app/
    (dashboard)/            seller screens
    s/[slug]/               public storefront
    api/
      agent/route.ts        seller chat stream
      voice/route.ts        audio upload
      webhooks/paypal/      payment events
      webhooks/twilio/      WhatsApp in
      webhooks/telegram/    Telegram in
      inngest/route.ts      job runner
  modules/
    brand/  catalog/  storefront/  payments/  orders/
    platforms/  channels/  publishers/  creative/  agent/  jobs/
  lib/                      db client, env, logger
```

Each vendor adapter lives inside its module, for example `channels/adapters/twilio-whatsapp.ts`. A registry picks the adapter from config, so turning on Meta later is one env flag plus one file.

## Tech stack

One TypeScript codebase on Next.js, Supabase for data, the Vercel AI SDK for the agent, and Inngest for background work. Everything runs on free tiers except Gemini, which needs billing for images and for usable text quotas.

| Layer | Choice | Why | Rejected |
|---|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Pages, API routes, webhooks and server rendering in one deploy. Server rendering gives WhatsApp link previews. | Vite React + Express: two deploys, CORS, no SSR |
| UI | Tailwind CSS + shadcn/ui | Accessible components you own as source; fast to theme from the brand kit with CSS variables | MUI: heavier, harder to re-skin per store |
| Forms and validation | Zod + React Hook Form | One schema validates agent tool inputs, API bodies and forms | — |
| Database | Supabase Postgres | Relational data (stores, products, orders), row-level security per seller, free tier | Firebase: weak for relational queries |
| Auth | Supabase Auth (email magic link) | No passwords to build; same client as the database | Clerk: one more vendor |
| File storage | Supabase Storage | Logos, product photos, generated creatives, public URLs | S3: more setup |
| Agent runtime | Vercel AI SDK (`ai`, `@ai-sdk/google`) | Tool calling, streaming to React, provider swap by changing one import | LangChain: abstraction cost, slower debugging |
| LLM | Gemini Flash-tier, model ID in env | Strong tool calling, native audio input, cheap. Free tier is 20–500 requests a day depending on model, too low for agent development, so billing goes on with a spend cap. | Claude API: better reasoning, higher cost; keep as a one-line swap |
| Voice | Browser `MediaRecorder` → Gemini audio input | Transcribe and understand in one call, including Pidgin | Separate speech-to-text vendor |
| Images | Gemini image model behind `ImageProvider` | Accepts reference images, which keeps the brand consistent | Midjourney: no official API |
| Payments | `@paypal/react-paypal-js` (buttons), PayPal Orders v2 REST (server), `@paypal/agent-toolkit` (agent tools) | Checkout on the store, server-side capture, agent creates invoices and links | — |
| WhatsApp | `twilio` Node SDK, Sandbox | Real WhatsApp without Meta access | Meta Cloud API: blocked for now |
| Telegram | Telegram Bot API via `fetch` (or `grammy`) | Instant, free, no verification | — |
| Background jobs | Inngest (`inngest` SDK) | Retries, long steps, scheduled sends on serverless | Vercel Cron: once a day on Hobby |
| Hosting | Vercel | Zero-config Next.js, public HTTPS for webhooks | — |
| Local webhooks | cloudflared tunnel (or ngrok) | PayPal, Twilio and Telegram can reach localhost | — |
| Errors and logs | Vercel logs + a `lib/logger.ts` wrapper | Enough for 8 days | Sentry: later |

### Version pinning

The Vercel AI SDK changes how tools are defined between major versions (v4 → v5 → v6). The PayPal Agent Toolkit's examples are written for an older major. If `npm install ai` pulls the newest version and the toolkit expects the old one, the PayPal tools fail at type-check or break at runtime mid-demo. Pinning means writing the exact version in `package.json` (`"ai": "4.x.x"`, no `^`) so a reinstall can never silently upgrade it. The day-1 spike tells us which version works. If none of them works cleanly, we skip the toolkit and write our own 4 tools (`create_order`, `capture_order`, `create_invoice`, `get_order`) that call PayPal's REST API directly. That's about half a day and removes the dependency.

### Why Supabase

The incumbents mostly predate Supabase. Shopify, for example, runs a Rails monolith on MySQL; the others don't publish their stacks. Supabase wins here on time, not because competitors use it.

| Option | Gives you | Cost for this build |
|---|---|---|
| **Supabase** | Postgres + auth + file storage + realtime + row-level security, one client, free tier | One vendor; SQL you already need for orders |
| Firebase | Auth, storage, realtime | NoSQL makes orders, stock and totals harder to query and keep consistent |
| Neon + Clerk + S3 | Same pieces from three vendors | Three accounts, three SDKs, more glue |
| Convex | Typed backend, realtime | New mental model to learn in 8 days |
| Prisma + any Postgres | Strong ORM | You still need auth, storage and realtime separately |

Postgres underneath means nothing is locked in: the data moves to any Postgres host later.

### Shopify and voice additions

- **Shopify:** `@shopify/admin-api-client` for Admin GraphQL (products, collections, pages, file uploads), with a custom-app access token from a free Shopify development store.
- **Voice:** see *Voice input* under UI/UX. No extra SDK; the audio goes straight to Gemini.

## Data model

Ten Postgres tables, all keyed to `store_id` so row-level security gives each seller only their own rows. The brand kit is one JSON column because the agent reads and writes it whole.

| Table | Key columns | Notes |
|---|---|---|
| `stores` | `id`, `owner_id`, `slug` (unique), `status` (draft / live), `brand_kit` jsonb, `currency` (ISO code), `settlement_currency`, `contact_channels` jsonb | `brand_kit` = name, tagline, tone, palette, fonts, logo_url, reference_image_urls |
| `site_versions` | `id`, `store_id`, `template_id`, `config` jsonb, `status` (draft / published / archived), `created_at`, `created_by` (agent / seller) | Every edit writes a new draft; publish copies a draft to published; revert re-publishes an older row |
| `products` | `id`, `store_id`, `name`, `description`, `price_minor` int, `currency`, `image_url`, `stock` int, `active` | Minor units per currency (kobo, cents; yen has none) |
| `orders` | `id`, `store_id`, `items` jsonb, `total_minor`, `currency`, `charge_total_minor`, `charge_currency`, `fx_rate`, `fx_source`, `status`, `channel`, `customer_ref`, `paypal_order_id` (unique) | Keeps both the owner's price and what PayPal charged, with the locked rate |
| `platform_connections` | `id`, `store_id`, `platform` (shopify), `shop_domain`, `access_token` (encrypted), `last_synced_at`, `external_ids` jsonb | Maps our product IDs to Shopify IDs so a re-sync updates instead of duplicating |
| `conversations` | `id`, `store_id`, `channel`, `customer_ref`, `last_message_at` | One per customer per channel |
| `messages` | `id`, `conversation_id`, `role` (customer / agent / seller), `body`, `created_at` | Kept separate so history pages cheaply |
| `posts` | `id`, `store_id`, `caption`, `media_url`, `targets` text[], `scheduled_at`, `status`, `publish_results` jsonb | `targets` = publisher names |
| `agent_sessions` | `id`, `store_id`, `messages` jsonb, `updated_at` | Seller-side chat history |
| `webhook_events` | `id`, `provider`, `event_id` (unique), `payload` jsonb, `processed_at` | Makes webhook handlers idempotent |

SQL migrations live in `supabase/migrations/` and are applied to the hosted project with `npx supabase db push` (no Docker or local database), so the repo can rebuild the schema from scratch.

### Currency handling

The owner picks any currency; the buyer always pays through PayPal, converted where needed.

1. Owner sets `stores.currency` (for example NGN) and a `settlement_currency` from PayPal's list (default USD).
2. Storefront shows prices in the owner's currency, with an optional "approx. in your currency" line from the buyer's locale (display only).
3. At checkout: if the owner's currency is PayPal-supported, charge it directly and PayPal converts on the buyer's side. If not, `payments.quote()` converts to the settlement currency at a cached daily rate, and the order stores `fx_rate`, `fx_source` and both totals.
4. The buyer sees both numbers before paying ("₦45,000 ≈ $29.40, charged in USD").
5. Totals are computed server-side in integer minor units; decimals per currency come from a lookup, never a constant 100.

FX rates come from a free daily-rates API cached for an hour; which provider (it must cover NGN, GHS, KES) is settled in the Phase 0 spike.

## Agent design

One agent runtime, two roles with separate tool sets. Following Shopify's lesson, no multi-agent orchestration: a single model loop with a small, sharp tool list per role.

### Seller agent (builder) — talks to the business owner

| Tool | Does | Needs seller approval |
|---|---|---|
| `create_brand_kit` | Drafts name, tagline, palette, fonts, tone from the conversation | No (shown as a card) |
| `apply_reference` | Reads an inspiration image or URL screenshot, extracts palette, fonts, layout feel, and picks the closest template | No |
| `generate_logo` | Queues a logo job through `creative` | No |
| `add_products` | Adds products from text, voice or photos | No |
| `choose_template` | Switches the draft site to another template, keeping content | No (draft only) |
| `edit_site` | Changes a section's text, image, order or visibility on the draft | No (draft only) |
| `publish_store` | Publishes the current draft to `/s/[slug]` | **Yes** |
| `set_currency` | Sets the store currency and settlement currency | No |
| `set_contact_channels` | Saves WhatsApp number, Telegram handle | No |
| `connect_shopify` | Stores the shop domain and token, tests the connection | **Yes** |
| `sync_to_shopify` | Pushes products, collections, pages and (if allowed) theme settings to Shopify | **Yes** |
| `generate_campaign` | Queues N on-brand images + captions | No |
| `schedule_posts` | Schedules approved posts to chosen publishers | **Yes** |
| `create_payment_link` | PayPal invoice or payment link for an off-site sale | **Yes** |
| `get_sales_summary` | Orders and revenue so far | No |

### Sales agent — talks to customers on WhatsApp, Telegram or web chat

| Tool | Does |
|---|---|
| `search_products` | Finds products and stock in this store only |
| `create_order` | Creates a pending order from the chat |
| `send_payment_link` | PayPal checkout link for that order |
| `check_order_status` | Paid / pending lookup |
| `handoff_to_seller` | Flags the conversation and notifies the seller |

### Rules the code enforces (not the prompt)

- Every tool call is scoped to the `store_id` from the session or the channel mapping; the model never passes it.
- Prices come from the database, never from the model. Totals are computed in code.
- Anything public or financial (publish, schedule, payment link from the seller side) returns a **preview**; the seller approves in the UI, then the action runs. Sidekick works the same way.
- Customer messages are untrusted input. The sales agent has no tools that change products, prices or the store.
- Brand kit JSON is injected into every creative prompt and every reply, which is what keeps tone and look consistent.
- Tool-specific instructions live in each tool's description and result, not in one giant system prompt.

### Language

The seller UI is in English for the hackathon. The agent is multilingual: it replies to sellers and customers in whatever language they write or speak (English, Pidgin, Yoruba, French, and so on), and generates store copy in the language the seller chooses. Every agent call carries `locale` (from the message) and `storeLanguage` (from the store), so replies and site text never get mixed up. UI strings sit in one `messages/en.json` file so adding languages later is translation work, not refactoring.

## Channels now, Meta later

The demo ships with WhatsApp through Twilio, Telegram, and web chat; Meta plugs into the same two interfaces once verification clears.

| Capability | Now (no Meta) | Later (Meta verified) | Code change to switch |
|---|---|---|---|
| Customer chat on WhatsApp | Twilio Sandbox adapter | Meta WhatsApp Cloud API adapter | New file in `channels/adapters/`, env flag |
| Click-to-chat on store | `wa.me/<number>` link | Same | None |
| Customer chat on Telegram | Telegram Bot adapter | Same | None |
| Customer chat on the store | Web chat widget → same sales agent | Same | None |
| Instagram / Facebook DMs | Not in demo | Messenger Platform adapter | New file, env flag |
| Social posting | Telegram channel publisher + downloadable post pack (image + caption + suggested time) | Facebook Page and Instagram publishers via Graph API | New files in `publishers/adapters/` |
| WhatsApp catalog | Not in demo; store link is the catalog | Commerce Manager catalog sync | New `catalog` sync job |
| Paid ads | Not in demo; agent drafts ad copy + creative | Marketing API, needs app review | New module |

### Shared message shape

Every adapter converts to and from one internal type, so the agent never sees vendor formats:

```
type InboundMessage = {
  channel: 'whatsapp' | 'telegram' | 'web' | 'instagram'
  storeId: string
  customerRef: string        // phone, chat id, or session id
  text?: string
  mediaUrls?: string[]
  receivedAt: string
}

interface Channel {
  name: InboundMessage['channel']
  verify(req: Request): Promise<boolean>
  parseWebhook(req: Request): Promise<InboundMessage[]>
  send(to: string, msg: { text: string; mediaUrl?: string }): Promise<void>
}

interface Publisher {
  name: string
  capabilities(): { images: boolean; schedule: boolean }
  publish(post: { caption: string; mediaUrl?: string }): Promise<{ url?: string }>
}
```

Routing: the Twilio Sandbox has one shared number, so the demo binds it to one demo store. To route several stores through it, the store's WhatsApp button pre-fills the first message with the store code (`wa.me/<number>?text=Hi%20mama-bread`), and the webhook maps the code to a `store_id`. With Meta, each seller gets their own number and the webhook maps the receiving number instead; the agent code doesn't change.

## Shopify

The agent fills and updates a Shopify store from the same brand kit and catalog that power the AxoriOS site. AxoriOS stays the source of truth; Shopify is a sync target behind the `CommercePlatform` interface.

| What the agent does on Shopify | API | Certainty |
|---|---|---|
| Create and update products, images, prices, stock | Admin GraphQL `productSet`, `stagedUploadsCreate` (`write_products`, `write_files`) | Works with normal scopes |
| Create collections (e.g. "Birthday cakes") | `collectionCreate` | Works with normal scopes |
| Create pages (About, Delivery, FAQ) from the brand kit | `pageCreate` (`write_online_store_pages`) | Works with normal scopes |
| Re-style the theme: colours, fonts, logo, homepage sections | `themeFilesUpsert` on `config/settings_data.json` and `templates/index.json` | Needs `write_themes` plus a Shopify exemption; day-1 spike tests a custom app on a dev store |
| Create the store itself | — | Not possible by API; seller creates the store and connects it |

**If the theme spike fails:** the agent still syncs catalog and pages, then shows the seller a one-click link to Shopify's theme editor with the palette and fonts pre-listed. The demo uses one Shopify development store (free through a Partner account); its storefront is password-protected, which is fine for the video.

Re-syncs are idempotent: `platform_connections.external_ids` maps each AxoriOS product to its Shopify ID, so a second sync updates rather than duplicates. Syncs run as an Inngest job (`platform.sync`) because large catalogs take longer than a request allows.

## UI/UX

The seller never fills in a form: the conversation is the interface, and every result appears as a card they can approve or edit. Design mobile-first, because the target seller runs the business from a phone.

### Screens

| Screen | Route | What's on it |
|---|---|---|
| Landing + sign-in | `/` | One promise, one button, magic-link login |
| Builder | `/build` | Chat with mic on the left; on the right a **live preview of the draft site** in an iframe, with a phone / desktop toggle, a template switcher, version history, and Publish. Approval cards inline in the chat. Stacked with a Chat / Preview tab on mobile. |
| Template gallery | `/build/templates` | The 3 templates rendered with the seller's own brand and products, plus "Upload inspiration" |
| Store dashboard | `/dashboard` | Orders (owner currency + charged currency), revenue, conversations, scheduled posts, Shopify sync status |
| Inbox | `/dashboard/inbox` | Every customer chat across channels; seller can take over |
| Campaigns | `/dashboard/campaigns` | Generated posts grid, approve / edit caption / reschedule, download pack |
| Public storefront | `/s/[slug]` | The published template: hero, products, cart, PayPal buttons, WhatsApp and Telegram buttons, chat bubble |
| Order confirmation | `/s/[slug]/order/[id]` | Paid status, items, both currency amounts, "chat with seller" link |

### Interaction rules

- **Preview, then approve.** Publish, schedule and payment actions render as cards with Approve / Edit. Nothing public happens on the model's word alone.
- **Voice first, text always.** A large mic button; the transcript appears so the seller can correct it.
- **Progress is visible.** Long jobs (logo, campaign) show a skeleton card that fills in when the job finishes, driven by polling or Supabase Realtime.
- **Storefront is fast****.** Server-rendered, client JS only for the cart, PayPal buttons and scroll motion; product images through `next/image`.
- **Theming from data.** The brand kit's palette and fonts become CSS variables on the storefront root, so one template looks different per seller.

### Preview and edit loop

1. The agent builds a **draft**; the preview pane shows it at `/s/[slug]?draft=<token>` (the token keeps drafts private).
2. The seller clicks any section in the preview; it highlights, and the next chat message edits that section ("make this headline warmer", "swap this photo").
3. Each change writes a new `site_versions` draft row, so every step can be undone from version history.
4. Publish copies the draft to live; the public URL updates, drafts stay editable.

### Templates

Three template **families** fix the structure; each family has **sub-templates** (presets); the seller's references drive the final look. Nothing is a hardcoded page: a site is a JSON config the agent edits, rendered by our own section components. Shopify themes work the same way (sections + settings).

```
type SiteConfig = {
  family: 'market' | 'studio' | 'kiosk'      // structure: which sections, in what order
  preset: string                             // sub-template, e.g. 'market/warm-bakery'
  tokens: DesignTokens                       // palette, fonts, radius, spacing, image style
  sections: Array<{
    id: string
    type: 'hero' | 'products' | 'story' | 'reviews' | 'faq' | 'contact' | 'footer'
    variant: string                          // visual variant of that section, e.g. hero 'split'
    content: Record<string, unknown>         // validated per section type with Zod
  }>
}
```

Three layers, each overriding the one before: **family** (structure) → **preset** (default section variants + token set) → **reference tokens** (pulled from the seller's inspiration images and requests). Each section type ships 2–3 visual variants (hero: full-bleed, split, carousel), so presets mix variants instead of duplicating pages.

| Family | Structure | Sub-templates (presets) | Fits |
|---|---|---|---|
| **Market** (default) | Hero, featured products, story, reviews, FAQ, contact, footer | Warm Bakery, Bold Grid, Photo-led | Food, gifts, general goods |
| **Studio** | Big imagery, editorial story, lookbook grid, minimal footer | Monochrome, Soft Pastel, Editorial Serif | Fashion, beauty, crafts |
| **Kiosk** | Compact menu list, sticky cart, chat button always visible | Menu List, Card Grid, Single Product | Quick orders, food menus, chat-led sellers |

Build order for 8 days solo: Market with all 3 presets first (it carries the demo), then one preset each for Studio and Kiosk. The rest are roadmap.

**External template platforms: not linked.** Free template sites cause three problems for an agent-built product:

- **Licences.** Many "free" templates allow personal use but forbid redistribution or use inside a product that generates sites for others; some require visible attribution. Shopify themes may only be used on Shopify.
- **Editability.** Their HTML isn't structured config, so the agent can't safely change one section; each import would need hand conversion.
- **Drift.** Upstream changes or takedowns break live stores.

Instead, sections are built from MIT-licensed component blocks (shadcn/ui and its blocks), which we can reuse and modify freely. External sites still help as **references**: the seller can paste a screenshot of any site they like, and `apply_reference` uses Gemini vision to extract palette, font style, spacing and layout feel, picks the closest family and preset, and applies the tokens. Structure comes from our templates; the look comes from the seller's references. Polish comes from on-brand generated hero images, `next/font` type pairs per preset, and light scroll motion with the `motion` library.

### Voice input

Handy is a desktop app (Tauri: Rust + React) that runs Whisper or Parakeet locally and pastes text into whatever text field has focus. It can't be embedded in a web app, but it needs no integration: a seller with Handy installed can dictate straight into the builder's chat box today.

For everyone else, especially phone users, the builder has its own mic:

- **Chosen: audio straight to the agent.** `MediaRecorder` records a short clip; the server sends the audio itself to Gemini in the same call that runs the agent. Gemini understands the speech and acts on it in one round trip, with no separate transcription step, so it's faster than speech-to-text followed by an LLM call. The response includes the transcript, shown so the seller can correct it.
- **Rejected for now: Whisper in the browser** (Handy's approach, via WebGPU). It works offline, but it downloads a model of tens to hundreds of megabytes and runs slowly on low-end Android phones, which are the target seller's device.

### Frontend libraries

Tailwind + shadcn/ui for components, `lucide-react` icons, `@ai-sdk/react` `useChat` for the streaming chat, Supabase Realtime for job status, `next/font` for brand fonts. No global state library: server components plus `useChat` state is enough.

## Build plan

Six phases, sliced vertically so each one ends with something demoable, riskiest integrations first. Phase 0 proves the three outside dependencies (PayPal + AI SDK, Twilio, Gemini images) before any feature is built on them. Every step runs through Claude Code against this spec.



Phases overlap by a day where the next slice can start while the last one is polished.

### Phase 0 — Setup and risk spikes (4–5 Nov)

Verified when: the deployed app loads, a sandbox PayPal order is created by the agent, a WhatsApp message gets an echo reply, and one on-brand image is generated from a reference.

| Step | Size | Acceptance | Verification | Blocked by |
|---|---|---|---|---|
| 0.1 Scaffold, GitHub repo, Supabase link + first migration, env schema (Zod), `next.config` image domains, MIT license | S | `npm run build` passes; tables exist in Supabase | `npm run build && npx supabase db push` | none |
| 0.2 Spike: AI SDK + Gemini + PayPal Agent Toolkit creates a sandbox order; pin the working versions | S | Order ID printed; exact versions in `package.json` | `npx tsx scripts/spike-paypal.ts` | 0.1 |
| 0.3 Spike: Twilio Sandbox inbound → 200 immediately → Inngest job → echo reply via API | S | Phone receives echo within 10 s | Send "hi" on WhatsApp | 0.7 |
| 0.4 Spike: Gemini image with brand reference image | XS | Image saved to Supabase Storage | `npx tsx scripts/spike-image.ts` | 0.1 |
| 0.5 Spike: Shopify dev store app; `productSet` creates a product; `themeFilesUpsert` changes a colour | S | Product in Shopify admin; theme write result recorded | `npx tsx scripts/spike-shopify.ts` | 0.1 |
| 0.6 Spike: FX rates provider covering NGN, GHS, KES; convert ₦45,000 to USD | XS | Rate returned and cached | `npx tsx scripts/spike-fx.ts` | 0.1 |
| 0.7 Deploy to Vercel production; Inngest app synced; fixed webhook URLs on the production domain registered with Twilio, Telegram and PayPal | S | `/api/health` returns 200 on the production URL; Inngest dashboard shows the app | `curl https://<prod>/api/health` | 0.1 |

### Phase 1 — Idea to live store (6–7 Nov)

Verified when: a seller describes a bakery in chat and a themed store with 3 products is live at `/s/[slug]`.

| Step | Size | Acceptance | Verification | Blocked by |
|---|---|---|---|---|
| 1.1 `brand` module + seller agent loop + builder chat UI with `create_brand_kit` | M | Brand card renders from chat; kit saved | `npm test -- brand` + manual chat | 0.2 |
| 1.2 `catalog` module + `add_products` tool | S | Products saved with per-currency minor units | `npm test -- catalog` | 1.1 |
| 1.3 **Market** family: `SiteConfig` schema, section components with 2–3 variants each, 3 presets, themed from brand kit | M | Colours/fonts change per store; link preview shows name and logo | Open `/s/demo`; paste link in WhatsApp | 1.2 |
| 1.4 Draft preview pane, `site_versions`, `edit_site`, click-to-select section | M | Edit in chat updates the preview; revert restores the last version | Manual: edit, revert, edit | 1.3 |
| 1.5 `publish_store` with approval card | S | Store stays draft until Approve | Manual: deny, then approve | 1.4 |

### Phase 2 — Paid order (7–8 Nov)

Verified when: a sandbox buyer pays on the store and the order shows as paid in the dashboard.

| Step | Size | Acceptance | Verification | Blocked by |
|---|---|---|---|---|
| 2.1 Cart + PayPal buttons + server create/capture (Orders v2) | M | Totals computed server-side; capture succeeds in sandbox | Sandbox buyer checkout | 1.3 |
| 2.2 PayPal webhook, signature check, idempotent `markPaid` | S | Same event twice = one paid order | Replay webhook from PayPal dashboard | 2.1 |
| 2.3 Currency: `set_currency`, `payments.quote()`, both totals shown, rate locked on the order | S | NGN store charges USD at the stored rate; GBP store charges GBP | `npm test -- payments` + two sandbox checkouts | 2.1, 0.6 |
| 2.4 Dashboard orders list | S | Paid order visible with both amounts and channel | Manual | 2.2 |

### Phase 3 — Chat selling (8–9 Nov)

Verified when: a customer asks for bread on WhatsApp, gets a PayPal link from the agent, pays, and the order is marked paid.

| Step | Size | Acceptance | Verification | Blocked by |
|---|---|---|---|---|
| 3.1 `channels` interface + Twilio adapter + sales agent with `search_products` | M | Agent answers from this store's catalog only | WhatsApp conversation | 0.3, 1.2 |
| 3.2 `create_order` + `send_payment_link` from chat | S | Link opens PayPal checkout for the right total | Pay via the link | 3.1, 2.2 |
| 3.3 Telegram adapter | S | Same conversation works on Telegram | Telegram conversation | 3.1 |
| 3.4 Inbox view with seller takeover | S | Messages from both channels listed | Manual | 3.1 |

### Phase 4 — Marketing (9–10 Nov)

Verified when: the agent generates 3 visibly consistent posts, the seller approves them, and one publishes to Telegram on schedule.

| Step | Size | Acceptance | Verification | Blocked by |
|---|---|---|---|---|
| 4.1 `creative` module + Inngest `creative.generate` job | M | 3 images + captions saved; brand kit in every prompt | Inngest dev server run | 0.4, 1.1 |
| 4.2 Posts approval UI + `post.publish` scheduled job + Telegram publisher + download pack | M | Post appears in Telegram channel at scheduled minute | Schedule 2 min ahead | 4.1, 3.3 |
| 4.3 **Studio** and **Kiosk** families (one preset each) + preset switcher + template gallery + `apply_reference` | M | Same store renders in all 3; an uploaded reference picks a template and palette | Manual with 2 reference images | 1.4 |
| 4.4 `platforms` module: Shopify connect + `sync_to_shopify` (products, collections, pages; theme if 0.5 passed) | M | Second sync updates, doesn't duplicate | Sync twice; count products in Shopify admin | 0.5, 1.2 |
| 4.5 Logo generation in brand flow | S | Logo on brand card and store header | Manual | 4.1 |

### Phase 5 — Voice and submission (10–12 Nov)

Verified when: the whole demo runs end to end from a voice note, and the submission is in.

| Step | Size | Acceptance | Verification | Blocked by |
|---|---|---|---|---|
| 5.1 Voice input (mic → audio straight to the agent call → transcript shown) | S | A Pidgin sentence is understood well enough to act on | Record 3 test phrases | 1.1 |
| 5.2 Seed demo store (Lagos cake shop), README, architecture image, setup steps | S | Fresh clone runs with `.env.example` | Clone into a new folder, run | all |
| 5.3 Judge access: demo seller account (email + password), README with sandbox buyer login and Twilio join code, daily Inngest keep-alive for Supabase through 15 Dec | S | A logged-out browser can sign in as the demo seller and complete a sandbox purchase | Run the README steps in a private window | 5.2 |
| 5.4 Rehearse and record the under-3-minute video, upload to YouTube | S | Video public, under 3:00 | Watch it logged out | 5.3 |
| 5.5 Submit on Devpost (by 11 Nov evening, 1-day buffer) | XS | Submission confirmed | Devpost status | 5.4 |

Cut order if time runs short: 4.5 logo, the Kiosk template, 3.4 inbox, Shopify theme re-styling, 3.3 Telegram, then 5.1 voice. Phases 1–3 plus one generated post and the Shopify catalog sync are the minimum demo.

## Architecture review: problems found and fixed

A full pass over the design turned up 12 problems; each fix is now part of the spec, the plan or CLAUDE.md. The three that would have broken the demo outright are the first three.

| # | Problem | What would break | Fix (now in the design) |
|---|---|---|---|
| 1 | Agent replies take longer than chat webhooks wait | Twilio and Telegram time out and retry, so customers get duplicate or no replies | Webhook routes verify, store the event, return 200 at once, and hand off to an Inngest `chat.reply` job that sends the answer through the API (step 0.3) |
| 2 | PayPal Orders v2 needs a capture after the buyer approves | A buyer who pays from a WhatsApp link and closes the tab leaves the order approved but never captured | Capture on the return page **and** on the `CHECKOUT.ORDER.APPROVED` webhook; `capture` is idempotent per order |
| 3 | Judging runs 1–15 Dec | Free Supabase projects pause after a week idle; Twilio Sandbox sessions expire after 3 days; magic links don't work for judges | Step 5.3: demo seller with email + password, README with sandbox buyer and Twilio join code, daily Inngest keep-alive query |
| 4 | Quick-tunnel URLs change on every restart | Webhooks silently stop after each restart | Deploy in Phase 0 (step 0.7) and register production URLs; the tunnel is only for local debugging |
| 5 | Vercel protects preview deployments with login | Webhooks to preview URLs get 401 | Webhooks always point at the production domain |
| 6 | Serverless time limits on long agent loops | Builder chat cuts off mid-answer | Stream responses, set `maxDuration` on the agent route, cap tool steps at 8, move images and Shopify sync to Inngest |
| 7 | PayPal sandbox receiving preferences | Payments in a currency the business account doesn't hold can sit as pending | Set the sandbox business account to accept and convert all currencies; tested in step 2.3 |
| 8 | Service-role key bypasses row-level security | One bug in a webhook could read or write another store's data | Service-role client is `server-only`, used only inside module functions that require a `storeId` |
| 9 | Injection through customer messages and reference images | A crafted message or image tells the agent to change prices | Sales agent has read-only tools; `apply_reference` output is parsed into the `DesignTokens` Zod schema, never passed as free text |
| 10 | Runaway tool loops | Gemini credits drain overnight | Step cap, per-store daily request cap, budget alert |
| 11 | Draft preview links | A shared draft URL exposes unpublished stores | Signed `?draft=` tokens with 24 h expiry, `noindex` on drafts |
| 12 | Scope versus time: about 35 steps, solo, 8 days | Polish steps eat the days the demo path needs | Daily 21:00 check against the timeline; if a phase is behind, apply the cut list that night. Demo path: 0.1–0.4, 0.7, 1.1–1.5, 2.1–2.3, 3.1–3.2, 4.1–4.2, 5.2–5.5 |

Not fixed, accepted for the hackathon: generated brand names and logos aren't checked against trademarks (the agent shows a reminder), and the shared Twilio Sandbox number shows Twilio's logo in WhatsApp.

## Decisions, open questions and scope

### Decision log

| Decision | Chosen | Why |
|---|---|---|
| App shape | One Next.js app, modular folders | One deploy; modules give the separation without microservice overhead |
| Agent pattern | Single agent, two roles, approval for public actions | Shopify's production lesson; fewer failure modes in 8 days |
| Meta | Behind `Channel` and `Publisher` interfaces; Twilio + Telegram now | Access is blocked; demo must not depend on it |
| Storefront | 3 designed templates (Market default, Studio, Kiosk) driven by JSON config; draft preview + version history | Attractive by default, safe for the agent to edit, easy to swap |
| Shopify | Sync target via `CommercePlatform`; catalog + pages certain, theme styling if the spike passes | Store creation and theme writes are restricted by Shopify |
| Currency | Owner picks any currency; PayPal-supported ones charged directly, others converted at a locked rate | App is global; PayPal covers about 25 currencies |
| Voice | Audio straight to Gemini in the agent call; Handy works alongside as a desktop option | One round trip; works on phones; nothing to embed |
| Money | Integer minor units per currency; totals server-side | No float errors; the model can't change prices |
| Webhooks | Stored once in `webhook_events`, handlers idempotent | Providers retry; no double orders |
| Demo story | Lagos cake shop priced in naira; UK buyer orders a birthday cake for family in Lagos, pays in USD through PayPal; local delivery | Shows conversion, cross-border PayPal and the Paga route in one flow |
| Automation tools | No n8n / Make | The agent and Inngest cover it; fewer moving parts |

### Open questions (answer before Phase 0 starts)

No open questions block the build. Two defaults are assumed; say if either is wrong:

1. Gemini Flash-tier runs the agent (Claude API stays a one-line swap).
2. Gemini billing is on with a $10 budget alert.

Resolved: solo build; currency (owner's choice, converted where PayPal doesn't support it); demo story (Lagos cake shop, diaspora buyer); English UI with a multilingual agent; template families with presets, no external template platforms.

### Assumptions (correct now or they stand)

1. Single developer using Claude Code, about 8–10 hours a day.
2. Demo runs on a live Vercel URL, not localhost.
3. One demo store is bound to the Twilio Sandbox number.
4. Seller UI in English; customer chat replies in the customer's language.
5. Meta features appear in the video only as a roadmap slide.

### Always / Never

- **Always:** PayPal sandbox in every payment path; brand kit in every creative prompt; seller approval before anything public or financial; store-scoped tools; `.env.example` kept current.
- **Never (this build):** Jumia or Konga integrations; creating Shopify stores by API; paid ad buying; video generation; Midjourney; n8n or Make; multi-agent orchestration; real money.

### Progress

| Phase | Status |
|---|---|
| 0 Setup and spikes | Not started |
| 1 Idea to live store | Not started |
| 2 Paid order | Not started |
| 3 Chat selling | Not started |
| 4 Marketing | Not started |
| 5 Voice and submission | Not started |
