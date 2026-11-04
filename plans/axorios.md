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

## Phase 0: Setup and risk spikes
Verified when: the deployed app loads, a sandbox PayPal order is created by the agent, a WhatsApp message gets an echo reply, and one on-brand image is generated from a reference.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 0.1 Scaffold, GitHub repo, Supabase link + first migration, env schema (Zod), `next.config` image domains, MIT license | S | Core | `npm run build` passes; tables exist in Supabase | `npm run build && npx supabase db push` | none |
| 0.2 Spike: AI SDK + Gemini + PayPal Agent Toolkit creates a sandbox order; pin the working versions | S | Core | Order ID printed; exact versions in `package.json` | `npx tsx scripts/spike-paypal.ts` | 0.1 |
| 0.3 Spike: Twilio Sandbox inbound, 200 immediately, Inngest job, echo reply via API | S | Core | Phone receives echo within 10 s | Send "hi" on WhatsApp | 0.7 |
| 0.4 Spike: Gemini image with brand reference image | XS | Core | Image saved to Supabase Storage | `npx tsx scripts/spike-image.ts` | 0.1 |
| 0.5 Spike: Shopify dev store app; `productSet` creates a product; `themeFilesUpsert` changes a colour | S | Core | Product in Shopify admin; theme write result recorded | `npx tsx scripts/spike-shopify.ts` | 0.1 |
| 0.6 Spike: FX rates provider covering NGN, GHS, KES; convert 45,000 NGN to USD | XS | Core | Rate returned and cached | `npx tsx scripts/spike-fx.ts` | 0.1 |
| 0.7 Deploy to Vercel production; Inngest app synced; fixed webhook URLs on the production domain registered with Twilio, Telegram and PayPal | S | Core | `/api/health` returns 200 on the production URL; Inngest dashboard shows the app | `curl https://<prod>/api/health` | 0.1 |

## Phase 1: Idea to live store
Verified when: a seller describes a bakery in chat and a themed store with 3 products is live at `/s/[slug]`.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 1.1 `brand` module + seller agent loop + builder chat UI with `create_brand_kit` | M | Core | Brand card renders from chat; kit saved | `npm test -- brand` + manual chat | 0.2 |
| 1.2 `catalog` module + `add_products` tool | S | Core | Products saved with per-currency minor units | `npm test -- catalog` | 1.1 |
| 1.3 Market family: `SiteConfig` schema, section components with 2-3 variants each, 3 presets, themed from brand kit | M | Core | Colours and fonts change per store; link preview shows name and logo | Open `/s/demo`; paste link in WhatsApp | 1.2 |
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
Verified when: a customer asks for a cake on WhatsApp, gets a PayPal link from the agent, pays, and the order is marked paid.

| Step | Size | Scope | Acceptance | Verification | Blocked by |
|---|---|---|---|---|---|
| 3.1 `channels` interface + Twilio adapter + sales agent with `search_products` | M | Core | Agent answers from this store's catalog only | WhatsApp conversation | 0.3, 1.2 |
| 3.2 `create_order` + `send_payment_link` from chat | S | Core | Link opens PayPal checkout for the right total | Pay via the link | 3.1, 2.2 |
| 3.3 Telegram chat adapter | S | Cut | Same conversation works on Telegram | Telegram conversation | 3.1 |
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
| 5.3 Judge access: demo seller account (email + password), README with sandbox buyer login and Twilio join code, daily Inngest keep-alive for Supabase through 15 Dec | S | Core | A logged-out browser can sign in as the demo seller and complete a sandbox purchase | Run the README steps in a private window | 5.2 |
| 5.4 Rehearse and record the under-3-minute video, upload to YouTube | S | Core | Video public, under 3:00 | Watch it logged out | 5.3 |
| 5.5 Submit on Devpost | XS | Core | Submission confirmed | Devpost status | 5.4 |

## Restore order, if time remains
3.4 inbox, 3.3 Telegram chat, 4.3 `apply_reference`, 4.5 logo, 4.3 Studio, 4.3 Kiosk. Anything still cut at submission goes in the README as roadmap.

## Decisions log
| Decision | Status |
|---|---|
| Schema additions beyond the spec: `stores.store_language`, `stores.agent_requests_today/date`, `conversations.agent_paused`, `orders.delivery_note`, `orders.paypal_capture_id`, `orders.paid_at`, `messages.store_id` | Applied in 0.1 |
| `webhook_events` unique on `(provider, event_id)` | Applied in 0.1 |
| Next.js 16 `cacheComponents` and `partialPrefetching` turned off: nearly every route is dynamic and they add Suspense constraints | Applied in 0.1 |
| Keys used as provided; Twilio and Telegram tokens not rotated | User decision, 4 Nov |
| Gemini on free tier; image access unproven until 0.4 | Open; see 0.4 |

## Progress
| Step | Status | Notes |
|---|---|---|
| 0.1 | Done | Migrations apply via `--db-url` on the eu-central-1 session pooler (aws-1); direct host is IPv6-only and the access token lacks `projects_read`, so `supabase link` isn't used. Types come from the Management API `types/typescript` endpoint. |
| 0.2 | Not started | |
| 0.3 | Not started | |
| 0.4 | Not started | |
| 0.5 | Not started | |
| 0.6 | Not started | |
| 0.7 | Not started | |
| Phases 1-5 | Not started | |
