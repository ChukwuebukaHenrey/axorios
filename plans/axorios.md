# AxoriOS build plan

Source: `docs/spec.md` (Build plan; Decisions, open questions and scope). Working target: **submit 9 Nov 2026**. Official dates: submit by 11 Nov, hard stop 12 Nov. Days 10-12 Nov are buffer.

Scope marks: **Core** is on the 9 Nov path. **Cut** is out unless time remains; restore in the order listed under "Restore order".

## Timeline
| Day | Work |
|---|---|
| 4-5 Nov | Phase 0 |
| 6 Nov | Phase 1 |
| 7 Nov | Phase 2, then 3.1-3.2 |
| 8 Nov | 4.1-4.2, 4.4, 5.1, 2.4 |
| 9 Nov | 5.2-5.5 |

Daily 21:00 check against this timeline. If a phase is behind, apply the cuts that night.

## Corrections to the spec's demo path
- 0.6 is Core: 2.3 is blocked by it.
- 4.2 needs only the Telegram publisher, not the 3.3 chat adapter.
- 4.3 is split: the Market preset switcher is Core, in step 1.5a. Studio, Kiosk, gallery and `apply_reference` are Cut.
- 5.1, 0.5, 4.4 and 2.4 are Core because the demo script in `REQUIREMENTS.md` section 5 shows them.
- WhatsApp is dormant behind `WHATSAPP_ENABLED`, and this overrides every WhatsApp and Twilio mention in the spec. Telegram is the chat channel for 0.3, 3.1 and 3.2, and for the demo.

## Phase 0: Setup and risk spikes
Verified when: the deployed app loads, a sandbox PayPal order is created by the agent, a Telegram message gets an echo reply, and one on-brand image is generated from a reference.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 0.1 Scaffold, GitHub repo, Supabase link + first migration, env schema (Zod), `next.config` image domains, MIT license | S | Core | `npm run build` passes; tables exist in Supabase | `npm run build && npx supabase db push` | none |
| 0.2 Spike: AI SDK + Gemini + PayPal Agent Toolkit creates a sandbox order; pin the working versions | S | Core | Order ID printed; exact versions in `package.json` | `npx tsx scripts/spike-paypal.ts` | 0.1 |
| 0.3 Spike: Telegram bot inbound with secret header check, 200 immediately, Inngest job, echo reply via API | S | Core | Telegram receives echo within 10 s | Send "hi" to the bot | 0.7 |
| 0.4 Spike: Gemini image with brand reference image | XS | Core | Image saved to Supabase Storage | `npx tsx scripts/spike-image.ts` | 0.1 |
| 0.5 Spike: Shopify dev store app; `productSet` creates a product; `themeFilesUpsert` changes a colour | S | Core | Product in Shopify admin; theme write result recorded | `npx tsx scripts/spike-shopify.ts` | 0.1 |
| 0.6 Spike: FX rates provider covering NGN, GHS, KES; convert 45,000 NGN to USD | XS | Core | Rate returned and cached | `npx tsx scripts/spike-fx.ts` | 0.1 |
| 0.7 Deploy to Vercel production; Inngest app synced; fixed webhook URLs on the production domain registered with Telegram and PayPal | S | Core | `/api/health` returns 200 on the production URL; Inngest dashboard shows the app | `curl https://<prod>/api/health` | 0.1 |

## Phase 1: Idea to live store
Verified when: a seller describes a bakery in chat and a themed store with 3 products is live at `/s/[slug]`.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 1.1 `brand` module + seller agent loop + builder chat UI with `create_brand_kit` | M | Core | Brand card renders from chat; kit saved | `npm test -- brand` + manual chat | 0.2 |
| 1.2 `catalog` module + `add_products` tool | S | Core | Products saved with per-currency minor units | `npm test -- catalog` | 1.1 |
| 1.3 Market family: `SiteConfig` schema, section components with 2-3 variants each, 3 presets, themed from brand kit | M | Core | Colours and fonts change per store; link preview shows name and logo | Open `/s/demo`; paste link in Telegram | 1.2 |
| 1.4 Draft preview pane, `site_versions`, `edit_site`, click-to-select section | M | Core | Edit in chat updates the preview; revert restores the last version | Manual: edit, revert, edit | 1.3 |
| 1.5 `publish_store` with approval card | S | Core | Store stays draft until Approve | Manual: deny, then approve | 1.4 |
| 1.5a Market preset switcher + `choose_template` (split from 4.3) | XS | Core | Same store renders in all 3 Market presets | Manual | 1.4 |

## Phase 2: Paid order
Verified when: a sandbox buyer pays on the store and the order shows as paid in the dashboard.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 2.1 Cart + PayPal buttons + server create/capture (Orders v2) | M | Core | Totals computed server-side; capture succeeds in sandbox | Sandbox buyer checkout | 1.3 |
| 2.2 PayPal webhook, signature check, idempotent `markPaid` | S | Core | Same event twice = one paid order | Replay webhook from PayPal dashboard | 2.1 |
| 2.3 Currency: `set_currency`, `payments.quote()`, both totals shown, rate locked on the order | S | Core | NGN store charges USD at the stored rate; GBP store charges GBP | `npm test -- payments` + two sandbox checkouts | 2.1, 0.6 |
| 2.4 Dashboard orders list | S | Core | Paid order visible with both amounts and channel | Manual | 2.2 |

## Phase 3: Chat selling
Verified when: a customer asks for a cake on Telegram, gets a PayPal link from the agent, pays, and the order is marked paid.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 3.1 Sales agent with `search_products` on the Telegram adapter; a `t.me/<bot>?start=<slug>` link binds the chat to a store | M | Core | Agent answers from this store's catalog only | Telegram conversation | 0.3, 1.2 |
| 3.2 `create_order` + `send_payment_link` from chat | S | Core | Link opens PayPal checkout for the right total | Pay via the link | 3.1, 2.2 |
| 3.3 Web chat bubble on the store | S | Cut | Same conversation works in the bubble | Web chat conversation | 3.1 |
| 3.4 Inbox view with seller takeover | S | Cut | Messages from both channels listed | Manual | 3.1 |

## Phase 4: Marketing
Verified when: the agent generates 3 visibly consistent posts, the seller approves them, and one publishes to Telegram on schedule.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 4.1 `creative` module + Inngest `creative.generate` job | M | Core | 3 images + captions saved; brand kit in every prompt | Inngest run | 0.4, 1.1 |
| 4.2 Posts approval UI + `post.publish` scheduled job + Telegram publisher + download pack | M | Core | Post appears in Telegram channel at scheduled minute | Schedule 2 min ahead | 4.1 |
| 4.3 Studio and Kiosk families (one preset each) + template gallery + `apply_reference` | M | Cut | Same store renders in all 3; an uploaded reference picks a template and palette | Manual with 2 reference images | 1.4 |
| 4.4 `platforms` module: Shopify connect + `sync_to_shopify` (products, collections, pages; theme if 0.5 passed) | M | Core | Second sync updates, doesn't duplicate | Sync twice; count products in Shopify admin | 0.5, 1.2 |
| 4.5 Logo generation in brand flow | S | Cut | Logo on brand card and store header | Manual | 4.1 |

## Phase 5: Voice and submission
Verified when: the whole demo runs end to end from a voice note, and the submission is in.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 5.1 Voice input (mic, audio straight to the agent call, transcript shown) | S | Core | A Pidgin sentence is understood well enough to act on | Record 3 test phrases | 1.1 |
| 5.2 Seed demo store (Lagos cake shop), README, architecture image, setup steps | S | Core | Fresh clone runs with `.env.example` | Clone into a new folder, run | all Core |
| 5.3 Judge access: demo seller account (email + password), README with sandbox buyer login and the Telegram bot link, daily Inngest keep-alive for Supabase through 15 Dec | S | Core | A logged-out browser can sign in as the demo seller and complete a sandbox purchase | Run the README steps in a private window | 5.2 |
| 5.4 Rehearse and record the under-3-minute video, upload to YouTube | S | Core | Video public, under 3:00 | Watch it logged out | 5.3 |
| 5.5 Submit on Devpost | XS | Core | Submission confirmed | Devpost status | 5.4 |

## Restore order, if time remains
3.4 inbox, 3.3 web chat, 4.3 `apply_reference`, 4.5 logo, 4.3 Studio, 4.3 Kiosk. Anything still cut at submission goes in the README as roadmap.

## Decisions log
| Decision | Status |
|---|---|
| Schema additions beyond the spec: `stores.store_language`, `stores.agent_requests_today/date`, `conversations.agent_paused`, `orders.delivery_note`, `orders.paypal_capture_id`, `orders.paid_at`, `messages.store_id` | Applied in 0.1 |
| `webhook_events` unique on `(provider, event_id)` | Applied in 0.1 |
| Next.js 16 `cacheComponents` and `partialPrefetching` turned off: nearly every route is dynamic and they add Suspense constraints | Applied in 0.1 |
| `@paypal/agent-toolkit` dropped, using the spec's fallback: 1.11.0 bundles `ai` 4.3.19 against our v7 and its order schema takes item prices from the model, which breaks the money rule. Own tools call Orders v2 REST | Applied in 0.2 |
| No Gemini billing for now (user decision, 5 Nov). `ImageProvider` stays an adapter: a `next/og` template adapter renders on-brand graphics; a Gemini adapter is switched on by env flag when billing or another provider is available | Applied in 0.4 |
| Store fonts load through a Google Fonts `<link>`, not `next/font` as the spec says: the kit holds any font name, and `next/font` needs them at build time | Applied in 1.3 |
| Hero `carousel` variant replaced by `centered`: no multi-image content yet, and it needs no client JS. Default story, reviews and FAQ are empty and render nothing, so no store shows invented testimonials | Applied in 1.3 |
| With no logo (4.5 is Cut, no image billing), the link preview shows a monogram tile in the brand's colours; a `logoUrl` replaces it automatically | Applied in 1.3 |
| Publish uses the SDK's `toolApproval`, with no `experimental_toolApprovalSecret`. The history is client-held, but the only client is the signed-in seller approving their own store, and the model can't forge an approval. Revisit for seller-side payment links | Applied in 1.5 |
| Publish refuses a store with no products. Until first publish the link follows the current name; once live it never changes | Applied in 1.5 |
| Undo archives the latest draft, so repeating walks further back. One Undo button stands in for the spec's version history list. Photo swapping isn't in `edit_site` yet: there's no upload path | Applied in 1.4 |
| Checkout: `POST /api/checkout` takes product IDs and quantities only, and creates the order row and PayPal order before the buttons show, so the buyer sees locked totals first. Capture lives on the return page, which buttons and payment links share. Order page access is by unguessable order ID, scoped to the store. A paid order lowers stock once. Delivery details are asked on the store, with PayPal shipping off, because the buyer is often not the recipient. Uses the stable `PayPalButtons` API of `@paypal/react-paypal-js`, loaded only at the payment step | Applied in 2.1 |
| Keys used as provided; Twilio and Telegram tokens not rotated | User decision, 4 Nov |
| WhatsApp is dormant, not removed (user decision, 5 Nov; a new dev account may become available): `WHATSAPP_ENABLED` defaults to false, TWILIO_* keys are optional, the webhook returns 404 while off. To switch on: set the flag and keys, register the webhook, test end to end | Applied 5 Nov |
| WhatsApp dropped from the build: the user's phone numbers are restricted on Meta services and the Twilio account can't be used, so Kapso and any other Meta-linked provider are out. Telegram replaces it. WhatsApp isn't a hackathon requirement. `twilio-whatsapp.ts` and its webhook route stay unused and never tested end to end, so the README and video must not claim WhatsApp works; list it as roadmap | User constraint, 5 Nov |
| One Telegram bot serves all stores: the store button opens `t.me/<bot>?start=<slug>` and the `/start` payload binds that chat to the store. Store comes from the binding, never from the model. New table `channel_bindings`, one row per `(channel, customer_ref)`, so a dormant channel can use it by setting `ParsedInbound.start`. `TELEGRAM_BOT_USERNAME` added; `contact.telegram` is no longer rendered | Applied in 3.1 |
| The sales agent runs with `generateText` inside the Inngest job, not streaming, because Telegram takes whole messages. Telegram 400 and 403 aren't retried. Chat replies run one at a time per chat, and a failed job sends a short apology | Applied in 3.1 |
| Chat payment block (items, both totals, rate, link) is written by code and appended to the agent's reply; the model never sees the URL or amounts. Its labels are English-only for now, while the agent's own words follow the customer's language. A payment link goes only to the chat that placed the order | Applied in 3.2 |
| `INNGEST_EVENT_KEY` rotated after its value reached a session transcript. New key accepted a test event and is on Vercel | Done 5 Nov |
| A store has one price currency: the first products set `stores.currency`, and a second currency is refused so carts total without converting. `add_products` matches on name, so repeating a product changes it. Stock defaults to 100 when the owner states none, because made-to-order sellers don't count stock | Applied in 1.2 |
| Gemini on free tier: `gemini-3.5-flash` answers text; `gemini-2.5-flash-image`, `gemini-3.1-flash-image` and `gemini-3.1-flash-lite-image` all return 429 quota errors (4 Nov) | Blocks 0.4, 4.1, 4.5 until billing is on |
| Agent text model: `gemini-3.5-flash-lite` is primary. Groq stays a backup through `TEXT_MODEL_PROVIDER`, with no automatic fallback. Fresh-seller test on 5 Nov: Flash-lite took 4-5 s a turn and replied in Pidgin; Groq `openai/gpt-oss-120b` took 17-38 s after the first turn (8,000 tokens a minute), answered Pidgin in English and once changed the tagline unasked. Pinned `@ai-sdk/groq` 4.0.77, same provider packages as `@ai-sdk/google`. Groq chat models also take no audio, which 5.1 needs | Applied in production 5 Nov |
| FX provider: open.er-api.com, no key, cached 1 h, and a stale rate is used if it fails. 45,000 NGN is about $33.44, not the $29.40 in the spec and demo script, so the video script must use the live figure. The charge is computed from the rate rounded to the column's 10 decimals, so the stored rate reproduces it. A store with products can't change price currency without new prices | Applied in 2.3 |
| A seller's lookup prefers their live store, then their oldest. There is no store switcher | Applied 5 Nov |
| Campaign images: `IMAGE_PROVIDER=template` (`next/og`), three layouts over one palette and type pair. Campaign copy is one model call. The model never writes a price or link: code adds the database price and store link to the caption and image. A Gemini adapter is one file plus one enum value when billing is on; none is written, because it couldn't be tested | Applied in 4.1 |
| `src/lib/inngest.ts` holds the client and event names, so a module can queue work without importing the jobs that import it. `jobs/client.ts` re-exports it | Applied in 4.1 |
| One Telegram channel and one Shopify dev store are shared infrastructure, and anyone can sign up. So only the store named by `DEMO_STORE_SLUG` (default `demo`) may post to the channel or connect to the shop. Other stores get the download pack, and connect returns `shop_not_available`. Real per-seller channels and Shopify OAuth are roadmap. Spec doesn't cover this: decided while the user was away, please confirm | Applied in 4.2 and 4.4 |
| Scheduling has two approval paths: the agent's `schedule_posts` card, and the Marketing page's button. Pressing the button is the approval. A reschedule queues a new job; the old one wakes, sees a different time and does nothing. Schedules are limited to 7 days ahead (Inngest's sleep limit) | Applied in 4.2 |
| The download pack is a hand-written zip with no compression (`node:zlib` `crc32`), with no new dependency: PNGs are already compressed | Applied in 4.2 |
| Judge logins go in Devpost's testing notes, never the public repo (user left this to me, 5 Nov). This overrides "README with sandbox buyer login" in 5.3 | Applied in 5.3 |
| The video records steps 1-2 on a fresh seller account and steps 3-6 on `/s/demo`, because only the demo store can reach the channel and Shopify | Applied in 5.4 plan |
| Voice uses `/api/agent`, with no separate `/api/voice`: the audio goes in the agent call as the spec chooses. A `show_transcript` tool carries the words to the screen. Audio reaches the model once and is never saved: later turns use the transcript. Only inline audio up to 2,000,000 characters is accepted, so a client can't make the provider fetch a URL | Applied in 5.1 |
| PayPal's Arabic checkout came from the old sandbox buyer's own account: neither the API `locale` field nor the URL's `locale.x` changed it. The user made a new US sandbox buyer, and its login is in `.env.local` and goes in Devpost's testing notes at 5.5 | Done 6 Nov |
| UI pass using the user's ZenFlo Figma references and assets (`Images/`): new tokens (dark #101310/#191D18/#222720/#30372D surfaces, #F5F7F1/#F6F3EC light, #E3FF48 lime + #85D6A6 mint + #2F9E5B success accents) replace the old purple/orange pair in `globals.css`; the supplied logo PNG replaces the old hand-drawn mark; `/` gets a light ZenFlo-style hero; a new `(dashboard)/layout.tsx` + `nav-links.tsx` gives Build/Orders/Marketing a shared dark sidebar (mobile: top bar), replacing 3 duplicated light headers. The bundled `Images/design-for-ai-main` plugin's full research→plan→mock→build ceremony (dealer, dual-blind review subagents) was read and rejected as too heavy for an already-fully-specified, time-boxed rebrand. Scope cut: no About/Pricing marketing nav and no 11-item dashboard nav were built, since only `/`, `/build`, `/dashboard` and `/dashboard/campaigns` exist. The builder chat's own panel (brand/products/publish/schedule/shopify/campaign cards, `preview-pane.tsx`) was deliberately left on its light/white styling (a dark-shell-plus-light-working-canvas split, not an oversight). The buyer-facing storefront (`/s/[slug]`) is untouched on purpose: it's themed per-seller from the brand kit, never from this palette | Applied 6 Nov |
| Shopify: tokens from the client-credentials grant last 24 h, so the encrypted token and its expiry are stored and renewed on use. Theme writes are refused by Shopify, so the seller gets a theme-editor link with the colours and fonts (F7.3's alternative). Prices convert to the shop's currency at the current rate, and syncing again refreshes them. Pages come only from store content, with no invented delivery or policy page. Products aren't published to a sales channel: the acceptance is the admin, and the dev storefront is password-protected | Applied in 4.4 |
| Redesign v2 (7 Nov, `docs/redesign-v2-brief.md`): industry templates replace the 3 Market presets. Part 1 adds the first one, `bakery`, as a 4th preset: wavy colour bands, sticker art, pill buttons, centred-logo header with menu and bag, a richer footer, and its own order page. It draws from the same 5-colour brand palette (plus a pale tint of the secondary colour), so any bakery gets the layout in its own colours; the stickers are template art in `public/images/stores/bakery/`, cut out of the user's generated images. Pacifico is a fixed accent font for section titles, not part of the brand kit. Market presets keep the old sections until the Tailoring and Cooking templates land and they are removed. Demo store: new palette and logo, `bakery` template, Chin Chin Gift Jar inactive (no photo); the seed no longer resets stock on existing products | Part 1 applied 7 Nov |
| Campaign images can use Cloudflare Workers AI Flux (`IMAGE_PROVIDER=cloudflare-flux`, 9 Nov): the model paints the background only, from colour words (hex codes made it paint swatch strips) and "no text"; `next/og` typesets headline, brand and the database price on top, then `sharp` (pinned 0.35.5, Next's own copy) saves it as JPEG q85 (~95 KB vs 2.4 MB PNG). A 429 or spent allocation (codes 3036/3040) falls back to the template, which stays PNG. Storage paths and the download pack name files by type. Keys are in Vercel Production; `IMAGE_PROVIDER` there is still `template` | Applied 9 Nov, not committed |

## Progress
| Step | Status | Notes |
|---|---|---|
| 0.1 | Done | Migrations apply via `--db-url` on the eu-central-1 session pooler (aws-1); direct host is IPv6-only and the access token lacks `projects_read`, so `supabase link` isn't used. Types come from the Management API `types/typescript` endpoint. |
| 0.2 | Done | Order 7KS098545V1134712 created by a Gemini tool call; price injection ignored. Pinned `ai` 7.0.163, `@ai-sdk/google` 4.0.112, `@ai-sdk/react` 4.0.167. Toolkit not used: see decisions. |
| 0.3 | Done | Telegram adapter and webhook on production; `setWebhook` registered with the secret, `allowed_updates` message only. No or wrong secret 403, valid 200 in about 1 s, malformed 200 with no work. Real chat on 5 Nov (updates 425183568-572): the user confirms replies arrived on the phone; all 5 updates processed, no webhook errors. |
| 0.4 | Done (revised) | 64 KB on-brand PNG from `next/og` saved to Supabase Storage with no AI model. Gemini images return 429 until billing is on. 9 Nov: `scripts/spike-image.mts` runs the cloudflare-flux adapter: live Flux background + typeset ₦45,000 → 94 KB JPEG uploaded and read back publicly; a stubbed 429 falls back to the template PNG. |
| 0.5 | Done | `scripts/spike-shopify.mts` on 5 Nov: client-credentials grant OK (24 h token). Scopes: write_products, write_files, write_online_store_pages, write_themes, write_inventory, read_locations, write_publications, write_app_proxy. `productSet` created draft product `axorios-spike-cake` (found by handle, so repeats update it). Theme read works. `themeFilesUpsert` refused with ACCESS_DENIED: "needs write_themes and an exemption from Shopify", so 4.4 uses the spec's fallback (theme-editor link with the values listed). |
| 0.6 | Done | open.er-api.com: NGN, GHS and KES returned; 45,000 NGN = 33.43 USD; 1 h cache verified. |
| 0.7 | Done | Deployed; `/api/health` 200. Inngest app `axorios` synced. PayPal and Telegram webhooks on the production domain. |
| 1.1 | Done | `npm test -- brand` 4/4; `scripts/e2e-brand.mts` passes: kit saved, single-field edit, Pidgin reply, signed-out 401. Password sign-in tested through the API. Screens not yet checked by eye. Magic link untested: needs the Supabase Auth site URL and redirect set to the production domain. |
| 1.2 | Done | `npm test -- catalog` 13/13. `scripts/e2e-catalog.mts` passes through the real agent: 45,000 NGN saved as 4500000, store currency set to NGN, a repeat changes the price with no duplicate, no price means no product, RLS hides draft products. |
| 1.3 | Done (user-reported) | `npm test -- storefront` 15/15. `scripts/e2e-storefront.mts` passes: two stores differ in colours, fonts, currency and products with no leak; a draft store returns 404; link preview tags and a 40 KB PNG. Checked by eye at 390 px and 1280 px. The user reported pasting the link in Telegram on 6 Nov, without detail on what the preview showed. |
| 1.4 | Done | `npm test -- storefront` 27/27. `scripts/e2e-site-edit.mts` passes through the real agent: edit, undo, edit, a clicked section is what "this" means, forged token 404. Click-to-select, the Undo button and the phone toggle driven in headless Edge and checked by eye. Tested on `gemini-3.5-flash-lite` because of the quota. |
| 1.5 | Done | Driven in headless Edge: asking shows a card and the store stays draft and 404; "Not yet" keeps it private; Publish makes it live and 200, with the link on the card; a later draft edit leaves the live store unchanged. Re-verified 5 Nov on 02b99c5: tests 48/48, lint, `tsc` and build pass; GitHub shows the Vercel check as success. Bold Grid tile initials checked by eye at 1280 px and 390 px. |
| 1.5a | Done | Same store renders in all 3 Market presets from the switcher (no model needed) and `choose_template`. Colours, fonts, text and hidden sections are kept. Checked by eye. |
| 2.1 | Done | Real sandbox purchase on production `/s/demo` on 5 Nov (`scripts/e2e-paid-order.mts`): order 3920970b charged 33.44 USD, capture id stored, buyer returned to the order page. Earlier checks: a client-sent price is ignored, another store's product, a draft store and over-stock are refused. Re-run 6 Nov with the new US sandbox buyer: PayPal's pay page is English, left to right, no Arabic, amounts as `$33.39`, checked by eye on a screenshot. Order 338d4a09 paid with a capture ID, stock 98 to 97. This order is on the demo dashboard with the note "Locale check". |
| 2.2 | Done | PayPal delivered CHECKOUT.ORDER.APPROVED to production and PayPal's resend API accepted a replay (HTTP 202): one event row, one order, paid time unchanged, stock moved once (100 to 99). Limit: Vercel logs don't expose the request, so arrival of the resend itself wasn't observed. Unsigned and forged webhooks return 403. |
| 2.3 | Done | `npm test -- payments` 9/9. Both paid in sandbox on production: 45,000 NGN charged 33.44 USD at the stored rate with both totals kept; a throwaway GBP store charged 51.00 GBP with no rate. |
| 2.4 | Done | The real paid order is on `/dashboard` for the demo seller with both amounts and delivery details. Fixed on the way: the lookup opened the seller's oldest store, a draft, so it now prefers the live one. |
| 3.1 | Done | Real phone conversation on 5 Nov, in Pidgin, from `t.me/EbukahTgBot?start=demo`: 4 customer messages, 4 agent replies, confirmed by the user. `scripts/e2e-telegram.mts` passes on production through the real webhook, job and `gemini-3.5-flash-lite`: an unbound chat and a draft store's link bind nothing, the link binds, answers come from this store's catalog with database prices, a store ID in a message reaches nothing and changes nothing, another store's link moves the one binding, a paused conversation gets no reply, `/s/demo` links to the bot with its slug. |
| 3.2 | Done | `scripts/e2e-telegram.mts --order` passes on production with a real sandbox payment: no order until delivery details are given, one order on channel telegram with the database total, 33.44 USD charged, the reply shows both totals, the rate and this order's PayPal link, paying it marks the order paid and moves stock once. Another chat asking for that order's link, and an unknown order ID, get no link. Real phone chat on 5 Nov: order 913eade6 made for 60,000 NGN, charging 44.58 USD, and the link was sent. The user paid that link on 5 Nov: PayPal shows the order COMPLETED, and the database shows it paid at 22:06 UTC with capture 5MC90758YP467573A. Phase 3 verified. The earlier hang after login wasn't explained or seen again. |
| 3.4 | Done | Built in the v1 UI pass (6-7 Nov), restored from Cut: `/dashboard/inbox` lists the chats, the seller can take over (`agent_paused`) and hand back, and seller replies go out through the real channel (`src/modules/channels/inbox.ts`; channel registry moved to `channels/registry.ts`). WhatsApp replies stay blocked while `WHATSAPP_ENABLED=false`. Checked by eye in headless Edge; no automated test yet. |
| 4.1 | Done | `npm test -- creative` 9/9. `scripts/e2e-campaign.mts` passes on production through the real agent and Inngest in 26 s: 3 drafts in one campaign, different captions, public PNGs, suggested times. Told to say "100 naira", the caption kept only database prices. Checked by eye: 3 layouts, one palette and type. That check found ₦ drawing as an empty box in DM Sans, fixed with a Noto Sans fallback. |
| 4.2 | Done | `scripts/e2e-publish.mts` on production as the demo seller on 5 Nov, after the bot became channel admin: asking to schedule returns an approval card and the post stays draft; deny leaves it unscheduled; approve schedules it; the pack opens with image, caption and suggested time; signed-out download 401. Real post published 1.6 s after its scheduled time, and Telegram returned `https://t.me/AxoriOS/7`. The script then stopped with `fetch failed` because this network can't reach `t.me`, so its last two checks didn't run: reading the post back, and the cancelled post staying a draft. The cancelled post's job completed, and an earlier run showed it posting nothing. The user reported the remaining checks done on 5 Nov ("all done"), without detail. |
| 4.4 | Done | `npm test -- platforms` 8/8. `scripts/e2e-shopify.mts` passes on production through the real agent, cards and Inngest job. Another seller gets `shop_not_available`; deny saves nothing; the token is stored encrypted. Sync: 3 products with stable handles, ₦60,000 became $44.58 in the USD shop, stock matches, a collection and 2 pages, the theme-editor link and colours. Second sync: same products and pages, shop total stayed 21, and a price changed to $1.00 in Shopify went back to $44.58. A rerun with saved IDs wiped also made no duplicates. The demo store stays connected for the video. Draft `axorios-spike-cake` from 0.5 is still in the admin. |
| 5.1 | Done (user-reported) | The user reported the real-voice check done on 5 Nov ("all done"), without detail; nothing here can confirm it, because audio isn't saved. `npm test -- voice` 8/8. `scripts/e2e-voice.mts` passes on production with 3 clips from Windows' synthetic voice: English made a brand kit, and "the price na 45,000 naira" in Pidgin saved 4500000 NGN, each in 6-10 s (one question took 37 s). The transcript shows every time, forced by code, because the model skipped it once when left to choose. No audio in the saved chat; an oversized clip gets 413. The mic was driven in headless Edge with a WAV as the microphone: `MediaRecorder` webm, transcript on screen word for word, kit saved. Not yet heard: a real person's voice on a real phone. The robot voice's "Wetin I fit do" came back as "We dey fit do". |
| 5.2 | Done | README, setup steps and `docs/architecture.svg` written. `scripts/seed-demo-store.mts` keeps product IDs, because the Shopify sync and past orders point at them. Every value in `.env.local` was searched for in all tracked files and git history: only public names matched (model IDs, the channel, the bot's username). Verified 6 Nov: `git clone` into a new folder, `npm install` (434 packages), `npm run build` clean, `npm test` 97/97, `npm start -p 3101` served `/api/health` 200 and `/` 200 on localhost. Memory was tight throughout (0.6-1.9 GB free even with Chrome and VS Code closed); installs and builds ran in the background rather than foreground to avoid the earlier low-memory stop. Test folder removed after. |
| 5.3 | Done | Run from a new Edge profile on production on 5 Nov: `/dashboard` redirects to sign-in, the demo seller signs in through the real form, and Orders, Marketing and the builder open. `scripts/e2e-paid-order.mts`: real sandbox purchase, 4500000 NGN charged 33.44 USD, stock 99 to 98, a replay changes nothing. README links return 200. Daily `keep-alive` ran on production. Logins go in Devpost's testing notes at 5.5. Flash-lite's daily cap is still unknown: see Waiting on the user. |
| 5.4, 5.5 | Not started | The user records and submits. Per the user on 6 Nov, the video is made only after everything, including a UI pass with the user's assets and references, is fixed. Submission date 9 Nov is confirmed. |

## Waiting on the user
- This network couldn't reach `axorios.vercel.app` or `t.me` on 5 Nov (see working notes). On 6 Nov `curl` reached production and PayPal sandbox directly; `t.me` wasn't rechecked. Check whether `/s/demo` opens in your browser here before recording 5.4.
- UI pass (6 Nov): tokens, logo, dashboard shell done — see decisions log. `/` is now the full marketing homepage (hero on the supplied meadow photo, "How it works" and "Why AxoriOS" sections below the fold); sign-in moved to its own `/sign-in` route, since entering the site should show the home, not a login form. Root cause of the "continually reloads" report: very likely this session's own repeated dev-server restarts on the same port colliding with an already-open browser tab, not a code bug — confirmed no unsolicited reloads on a clean server with one tab. Separately, a genuine Windows `netsh portproxy` rule was self-forwarding `127.0.0.1:3000` to itself (found via `netstat`/`netsh interface portproxy show all`); the rule is deleted, but the OS still shows the old socket as listening until a reboot or an `iphlpsvc` restart, so use `npx next dev -p 3100` for now. Open `/build`, `/dashboard` and `/dashboard/campaigns` yourself before recording 5.4 — not re-checked visually this round. Every demo product still has no photo (`image_url` empty).
- Shopify state on 6 Nov (read from the live shop): the connection works and the 3 cakes, the collection and 2 pages are in the admin. Not done: the cakes are on no sales channel (0 publications) and the storefront is password-protected, so there's no public Shopify page. The last sync was 5 Nov 20:05 UTC and sync runs only when the seller approves it, so the shop is stale: stock 100/99/100 against 98/97/98, Red Velvet $33.44 against a live $33.39. The shop also holds Shopify's sample snowboards and the draft spike cake, and its main theme is `test-data`. Sync is one-way: orders don't travel in either direction. Decisions needed: publish to the Online Store, and delete the sample products.
- Test data on the demo dashboard before 5.4: 7 orders, including 2 pending and notes like "E2E 2026-...", "Locale check", "me". Decision needed: delete or keep. Some are evidence quoted in Progress.
- Stray plain-text lines in `.env.local` (about lines 45-47) break the Supabase CLI. Comment them out with `#` when convenient.
- Judge traffic during 1-15 Dec: Flash-lite's free-tier daily cap is not measured yet. Check it before 5.3.
- Product and hero photos: the demo store has them since 6 Nov (Red Velvet, Ube Coconut, hero cake). Other stores still show brand-coloured tiles until the seller adds photos (no upload path yet).
- Shopify is now further out of date: Chin Chin Gift Jar went inactive on 7 Nov and the demo store's stock reads 100/100. Re-sync before publishing to the Online Store (redesign v2, item 4).
- Gemini was slow on 5 Nov: campaign copy hit the 60 s function limit at 21:48 UTC, took 44 s on Inngest's retry, and a later run took 15 s for the whole job. Copy retried without help, but `/api/agent` shares the 60 s limit. Allow for this when recording 5.4.
- 5.2's fresh-clone test ran successfully on 6 Nov despite memory staying at 0.6-1.9 GB free even with Chrome and VS Code closed (this machine's baseline usage is high relative to its 7.9 GB total). Running `npm install`/`build`/`test` in the background rather than foreground avoided the earlier low-memory stop; keep doing that for any future heavy command here.
- Flash-lite's daily cap: Google's page says limits "can be viewed in Google AI Studio", so read the real figure there for this project. Third-party figures disagree: 500 or 1,500 requests a day, 10 or 30 a minute. A seller turn uses 2 or more requests, and the count resets at midnight Pacific. Decide before 1 Dec whether the free tier is enough for judges.
- Paste the demo seller and sandbox buyer logins into Devpost's testing notes at 5.5. Check that the field is private.
- Magic-link sign-in (F1.1) is still untested: it needs the Supabase Auth site URL and redirect set to the production domain.
- Decision: confirm `DEMO_STORE_SLUG`, which limits the Telegram channel and Shopify dev store to the demo store (see decisions). Judges signing up with their own account get the download pack and no Shopify.
- `REQUIREMENTS.md` section 5 still says ₦45,000 is about $29.40. The live figure moves with the rate: $33.44 on 5 Nov, $33.39 on 6 Nov. Use what the screen shows on the day, and don't script a fixed number.

## Working notes
- Windows shell. `gh` is at `/c/Program Files/GitHub CLI/gh.exe`, not on PATH. Use `npx vercel@latest`; the CLI is logged in. The Vercel connector works since team access was approved on 5 Nov. `api.vercel.com` timed out from this machine for a while that day, so the CLI can fail with `fetch failed`. Send secrets through the CLI, piped from `.env.local`, never as connector arguments.
- Load env without printing: `set -a; source .env.local; set +a`. Never echo values. `NEXT_PUBLIC_*` values that look like keys need `--type config` on `vercel env add`.
- Vercel env is production only. New values need a redeploy. CLI-only Supabase keys stay off Vercel.
- Stray plain-text lines in `.env.local` (about lines 45-47) now stop the Supabase CLI parsing it, and sourcing it runs them as commands. Read values with `node --env-file=.env.local`, and run `db push` from a temp folder holding only a copy of `supabase/migrations`, using `npx supabase@latest`.
- Migrations: `npx supabase db push --yes --db-url "postgresql://postgres.$SUPABASE_PROJECT_REF:<url-encoded password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"`. Don't use `supabase link`: the token lacks `projects_read` and the direct host is IPv6-only.
- Types: GET `https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/types/typescript?included_schemas=public` with the access token, then write the `types` field to `src/lib/database.types.ts`. `gen types --db-url` needs Docker.
- The Supabase connector can't see this project. Use the CLI and REST.
- Scripts are `.mts` for top-level await: `npx tsx --env-file=.env.local scripts/<name>.mts`.
- Read before using, because these differ from older docs: `node_modules/ai/docs` (AI SDK 7: `isStepCount`, `inputSchema`, `toUIMessageStream` with `onEnd`, `toolApproval` for approval cards), `node_modules/next/dist/docs` (Next 16: `proxy.ts`), Inngest 4 (`triggers` inside the options object).
- Gemini: `gemini-3.5-flash-lite` for text. `gemini-3.8-flash` and `gemini-flash-latest` returned 503 on 4 Nov. `gemini-2.5-flash` is closed to new users.
- npm is slow on this machine, sometimes 10 minutes: run installs in the background.
- To test on another model without touching `.env.local`: `GEMINI_TEXT_MODEL=gemini-3.5-flash-lite npx next dev -p 3002`. Process env wins over the file.
- UI checks need no new dependency: start headless Edge with `--remote-debugging-port`, set the `sb-<ref>-auth-token` cookie over CDP, and drive the page with `Runtime.evaluate`. Node has a global `WebSocket`.
- `next dev` here can miss file edits and serve a stale compile, showing "X is not a function" for code that `tsc` accepts. Restart it. Stopping the background task can leave `next` running, so stop whatever listens on the port too.
- Before an e2e run, check what serves the port. A stale `next start` on 3000 silently runs old code, and `next dev` then moves to 3001.
- The slug is claimed once from the first brand name, so a later rename keeps the old slug. Revisit at 1.5 publish.
- UI palette from the brand board: #2B0B3F, #F97316, #FBBF24, #1F1F1F, #F8FAFC. Font: DM Sans.
- Demo seller exists, with credentials in `.env.local`. Re-seed with `scripts/seed-demo-user.mts`. Its store holds test data from the e2e run.
- The cart was driven in headless Edge at 390 px on 5 Nov and checked by eye: add, quantity, required delivery details, the USD charge before paying, PayPal's button, and a reload keeps the cart. No console errors.
- `/s/demo` comes from `scripts/seed-demo-store.mts`. The demo seller also owns an older draft test store; `/build` and `/dashboard` open the live store first.
- `scripts/e2e-telegram.mts` leaves no store data, but its `webhook_events` rows stay behind because they have no store; they use `update_id` from 800000000 and made-up chats from 7000000000.
- `scripts/sandbox-pay.ts` pays a PayPal approval link as the sandbox buyer in headless Edge; import it from e2e scripts. Vercel runtime logs (connector and CLI) returned nothing for webhook paths on 5 Nov, so use database rows and Inngest events as evidence.
- `scripts/e2e-brand.mts` step 1 needs a seller with no brand kit. Against the demo seller's used test store it fails on any model. Run it with `DEMO_SELLER_EMAIL` and `DEMO_SELLER_PASSWORD` set to a throwaway user; process env wins over `--env-file`.
- Groq limits refill continuously, so there is no fixed reset time: 1,000 requests a day is one back every 86.4 s, and 8,000 tokens a minute is about 133 back per second. The `x-ratelimit-reset-*` headers give the wait.
- A Windows portproxy rule (`iphlpsvc`) listens on 127.0.0.1:3000 and forwards to itself, so port 3000 always looks busy. Test servers here used 3100 and 3101.
- Headless Edge screenshots: `--window-size` below 500 px clips rather than narrows. For phone width, load the page in a 390 px iframe.
- To test the mic with no mic: start Edge with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<file.wav>%noloop`. Windows' `System.Speech` makes the WAV. Node scripts outside the repo can't import its packages, so use `createRequire` on the repo's `package.json`.
- `tar` on PATH is Git's, which can't read zips; use `C:\Windows\System32\tar.exe`. Shopify's product search lags behind writes, so check by exact ID. `GET /api/inngest` returns 401 on production; `PUT` answers `modified: true` once new functions are live, and the connector's function count includes one extra for each `onFailure`.
- `.env.local`'s `NEXT_PUBLIC_APP_URL` is localhost, so scripts aiming at production must hard-code `https://axorios.vercel.app`.
- On 5 Nov this network couldn't connect to the IPs DNS gives for `axorios.vercel.app` (216.198.79.3, 64.29.17.3) or to `t.me`, while Vercel's connector got 200 from production. Vercel's `76.76.21.21` connects. For scripts, pin it per process with a `dns.lookup` override loaded through `NODE_OPTIONS=--require`; `fetch failed` at an e2e script's first step usually means this. Connector `web_fetch_vercel_url` checks production from outside.
- Build from `C:\Users\ADMIN\AxoriOS`, the folder's real casing. A shell in `...\Axorios` makes `next build` load React twice and fail prerendering `/_global-error` with "Cannot read properties of null (reading 'useContext')" (seen 7 Nov). Lint and tests pass either way.
