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
| Shopify: tokens from the client-credentials grant last 24 h, so the encrypted token and its expiry are stored and renewed on use. Theme writes are refused by Shopify, so the seller gets a theme-editor link with the colours and fonts (F7.3's alternative). Prices convert to the shop's currency at the current rate, and syncing again refreshes them. Pages come only from store content, with no invented delivery or policy page. Products aren't published to a sales channel: the acceptance is the admin, and the dev storefront is password-protected | Applied in 4.4 |

## Progress
| Step | Status | Notes |
|---|---|---|
| 0.1 | Done | Migrations apply via `--db-url` on the eu-central-1 session pooler (aws-1); direct host is IPv6-only and the access token lacks `projects_read`, so `supabase link` isn't used. Types come from the Management API `types/typescript` endpoint. |
| 0.2 | Done | Order 7KS098545V1134712 created by a Gemini tool call; price injection ignored. Pinned `ai` 7.0.163, `@ai-sdk/google` 4.0.112, `@ai-sdk/react` 4.0.167. Toolkit not used: see decisions. |
| 0.3 | Done | Telegram adapter and webhook on production; `setWebhook` registered with the secret, `allowed_updates` message only. No or wrong secret 403, valid 200 in about 1 s, malformed 200 with no work. Real chat on 5 Nov (updates 425183568-572): the user confirms replies arrived on the phone; all 5 updates processed, no webhook errors. |
| 0.4 | Done (revised) | 64 KB on-brand PNG from `next/og` saved to Supabase Storage with no AI model. Gemini images return 429 until billing is on. |
| 0.5 | Done | `scripts/spike-shopify.mts` on 5 Nov: client-credentials grant OK (24 h token). Scopes: write_products, write_files, write_online_store_pages, write_themes, write_inventory, read_locations, write_publications, write_app_proxy. `productSet` created draft product `axorios-spike-cake` (found by handle, so repeats update it). Theme read works. `themeFilesUpsert` refused with ACCESS_DENIED: "needs write_themes and an exemption from Shopify", so 4.4 uses the spec's fallback (theme-editor link with the values listed). |
| 0.6 | Done | open.er-api.com: NGN, GHS and KES returned; 45,000 NGN = 33.43 USD; 1 h cache verified. |
| 0.7 | Done | Deployed; `/api/health` 200. Inngest app `axorios` synced. PayPal and Telegram webhooks on the production domain. |
| 1.1 | Done | `npm test -- brand` 4/4; `scripts/e2e-brand.mts` passes: kit saved, single-field edit, Pidgin reply, signed-out 401. Password sign-in tested through the API. Screens not yet checked by eye. Magic link untested: needs the Supabase Auth site URL and redirect set to the production domain. |
| 1.2 | Done | `npm test -- catalog` 13/13. `scripts/e2e-catalog.mts` passes through the real agent: 45,000 NGN saved as 4500000, store currency set to NGN, a repeat changes the price with no duplicate, no price means no product, RLS hides draft products. |
| 1.3 | In progress | `npm test -- storefront` 15/15. `scripts/e2e-storefront.mts` passes: two stores differ in colours, fonts, currency and products with no leak; a draft store returns 404; link preview tags and a 40 KB PNG. Checked by eye at 390 px and 1280 px. Left: paste the link in Telegram (user). |
| 1.4 | Done | `npm test -- storefront` 27/27. `scripts/e2e-site-edit.mts` passes through the real agent: edit, undo, edit, a clicked section is what "this" means, forged token 404. Click-to-select, the Undo button and the phone toggle driven in headless Edge and checked by eye. Tested on `gemini-3.5-flash-lite` because of the quota. |
| 1.5 | Done | Driven in headless Edge: asking shows a card and the store stays draft and 404; "Not yet" keeps it private; Publish makes it live and 200, with the link on the card; a later draft edit leaves the live store unchanged. Re-verified 5 Nov on 02b99c5: tests 48/48, lint, `tsc` and build pass; GitHub shows the Vercel check as success. Bold Grid tile initials checked by eye at 1280 px and 390 px. |
| 1.5a | Done | Same store renders in all 3 Market presets from the switcher (no model needed) and `choose_template`. Colours, fonts, text and hidden sections are kept. Checked by eye. |
| 2.1 | Done | Real sandbox purchase on production `/s/demo` on 5 Nov (`scripts/e2e-paid-order.mts`): order 3920970b charged 33.44 USD, capture id stored, buyer returned to the order page. Earlier checks: a client-sent price is ignored, another store's product, a draft store and over-stock are refused. |
| 2.2 | Done | PayPal delivered CHECKOUT.ORDER.APPROVED to production and PayPal's resend API accepted a replay (HTTP 202): one event row, one order, paid time unchanged, stock moved once (100 to 99). Limit: Vercel logs don't expose the request, so arrival of the resend itself wasn't observed. Unsigned and forged webhooks return 403. |
| 2.3 | Done | `npm test -- payments` 9/9. Both paid in sandbox on production: 45,000 NGN charged 33.44 USD at the stored rate with both totals kept; a throwaway GBP store charged 51.00 GBP with no rate. |
| 2.4 | Done | The real paid order is on `/dashboard` for the demo seller with both amounts and delivery details. Fixed on the way: the lookup opened the seller's oldest store, a draft, so it now prefers the live one. |
| 3.1 | Done | Real phone conversation on 5 Nov, in Pidgin, from `t.me/EbukahTgBot?start=demo`: 4 customer messages, 4 agent replies, confirmed by the user. `scripts/e2e-telegram.mts` passes on production through the real webhook, job and `gemini-3.5-flash-lite`: an unbound chat and a draft store's link bind nothing, the link binds, answers come from this store's catalog with database prices, a store ID in a message reaches nothing and changes nothing, another store's link moves the one binding, a paused conversation gets no reply, `/s/demo` links to the bot with its slug. |
| 3.2 | Built, phone check left | `scripts/e2e-telegram.mts --order` passes on production with a real sandbox payment: no order until delivery details are given, one order on channel telegram with the database total, 33.44 USD charged, the reply shows both totals, the rate and this order's PayPal link, paying it marks the order paid and moves stock once. Another chat asking for that order's link, and an unknown order ID, get no link. Real phone chat on 5 Nov: order 913eade6 made for 60,000 NGN, charging 44.58 USD, and the link was sent. That order is still pending: paying the link from the phone is what's left. |
| 4.1 | Done | `npm test -- creative` 9/9. `scripts/e2e-campaign.mts` passes on production through the real agent and Inngest in 26 s: 3 drafts in one campaign, different captions, public PNGs, suggested times. Told to say "100 naira", the caption kept only database prices. Checked by eye: 3 layouts, one palette and type. That check found ₦ drawing as an empty box in DM Sans, fixed with a Noto Sans fallback. |
| 4.2 | Built, channel check left | `scripts/e2e-publish.mts` on production as the demo seller: asking to schedule returns an approval card and the post stays draft; deny leaves it unscheduled; approve schedules it; the job woke at the exact second; a cancelled post's job finished without posting; the pack opens in Windows' tar with image, caption and suggested time; signed-out download 401. Failed only at the last step: Telegram 403 "bot is not a member of the channel chat", recorded on the post with no pointless retries. Add the bot as channel admin, then rerun the script. |
| 4.4 | Done | `npm test -- platforms` 8/8. `scripts/e2e-shopify.mts` passes on production through the real agent, cards and Inngest job. Another seller gets `shop_not_available`; deny saves nothing; the token is stored encrypted. Sync: 3 products with stable handles, ₦60,000 became $44.58 in the USD shop, stock matches, a collection and 2 pages, the theme-editor link and colours. Second sync: same products and pages, shop total stayed 21, and a price changed to $1.00 in Shopify went back to $44.58. A rerun with saved IDs wiped also made no duplicates. The demo store stays connected for the video. Draft `axorios-spike-cake` from 0.5 is still in the admin. |
| 5.1 | Built, real voice left | `npm test -- voice` 8/8. `scripts/e2e-voice.mts` passes on production with 3 clips from Windows' synthetic voice: English made a brand kit, and "the price na 45,000 naira" in Pidgin saved 4500000 NGN, each in 6-10 s (one question took 37 s). The transcript shows every time, forced by code, because the model skipped it once when left to choose. No audio in the saved chat; an oversized clip gets 413. The mic was driven in headless Edge with a WAV as the microphone: `MediaRecorder` webm, transcript on screen word for word, kit saved. Not yet heard: a real person's voice on a real phone. The robot voice's "Wetin I fit do" came back as "We dey fit do". |
| 5.2 | In progress | README, setup steps and `docs/architecture.svg` written. `scripts/seed-demo-store.mts` now keeps product IDs, because the Shopify sync and past orders point at them. Every value in `.env.local` was searched for in all tracked files and git history: only public names matched (model IDs, the channel, the bot's username). Not yet verified: the fresh clone with `npm test` and serving. The system stopped the first run for low memory, and the second wasn't started because only 0.6-1.1 GB was free (Chrome 1.6 GB, VS Code 0.8 GB). Vercel installing and building each pushed commit from git is partial evidence. Formally blocked by "all Core". |
| 5.3 | Done | Run from a new Edge profile on production on 5 Nov: `/dashboard` redirects to sign-in, the demo seller signs in through the real form, and Orders, Marketing and the builder open. `scripts/e2e-paid-order.mts`: real sandbox purchase, 4500000 NGN charged 33.44 USD, stock 99 to 98, a replay changes nothing. README links return 200. Daily `keep-alive` ran on production. Logins go in Devpost's testing notes at 5.5. Flash-lite's daily cap is still unknown: see Waiting on the user. |
| 5.4, 5.5 | Not started | The user records and submits. |

## Waiting on the user
- Pay the PayPal link from your Telegram chat (order 913eade6, $44.58) as the sandbox buyer. Finishes 3.2 and Phase 3.
- Voice check on your phone, about 1 minute: on `/build`, press the mic and say something in Pidgin. So far only a synthetic voice has been tested.
- Stray plain-text lines in `.env.local` (about lines 45-47) break the Supabase CLI. Comment them out with `#` when convenient.
- Judge traffic during 1-15 Dec: Flash-lite's free-tier daily cap is not measured yet. Check it before 5.3.
- Product and hero photos: none yet (no image billing, no upload path), so stores show brand-coloured tiles, and Photo-led looks flat. Decide before recording 5.4.
- Paste `https://axorios.vercel.app/s/demo` in Telegram to finish 1.3.
- Make `@EbukahTgBot` an admin of the `@AxoriOS` channel with permission to post, then run `npx tsx --env-file=.env.local scripts/e2e-publish.mts`. Blocks finishing 4.2: Telegram says the bot isn't a member. That run leaves one real post in the channel.
- Submission date: 9 Nov is assumed and not yet confirmed.
- Free memory for the 5.2 fresh-clone test: close Chrome and VS Code tabs until about 3 GB is free, then ask for it.
- Flash-lite's daily cap: Google's page says limits "can be viewed in Google AI Studio", so read the real figure there for this project. Third-party figures disagree: 500 or 1,500 requests a day, 10 or 30 a minute. A seller turn uses 2 or more requests, and the count resets at midnight Pacific. Decide before 1 Dec whether the free tier is enough for judges.
- Paste the demo seller and sandbox buyer logins into Devpost's testing notes at 5.5. Check that the field is private.
- Magic-link sign-in (F1.1) is still untested: it needs the Supabase Auth site URL and redirect set to the production domain.
- Decision: confirm `DEMO_STORE_SLUG`, which limits the Telegram channel and Shopify dev store to the demo store (see decisions). Judges signing up with their own account get the download pack and no Shopify.
- `REQUIREMENTS.md` section 5 still says ₦45,000 is about $29.40. The live figure is about $33.44. Use the live one in the video.

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
