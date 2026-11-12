# AxoriOS

Say it "axo-ree-os". A voice-first AI agent that takes a non-technical seller anywhere in the world from a business idea to a first paid order.

A seller describes their business by voice or text, in any language. Axori AI, the in-app assistant, builds a brand kit and a designed store, takes payment through PayPal, sells to customers in Telegram chats, makes on-brand posts and schedules them, copies the catalog to Shopify, and tracks the money afterwards: fees, refunds, VAT and currency differences.

Built for the PayPal AI Hackathon. PayPal runs in sandbox only, so no real money moves.

**The demo story:** a Lagos cake shop prices in naira. A buyer in the UK orders a birthday cake for family in Lagos and pays in US dollars through PayPal.

## Try it

- **Live demo store:** <https://axorios.vercel.app/s/demo>
- **Chat with the store on Telegram:** <https://t.me/EbukahTgBot?start=demo>
- **Seller side:** sign in at <https://axorios.vercel.app>

The demo seller login and the PayPal sandbox buyer login are in the testing notes of the Devpost submission.

To see the flow from the buyer's side:

1. Open the demo store, add a cake to the cart and enter delivery details.
2. Note both amounts: the naira price, and the US dollars PayPal will charge at a locked rate.
3. Pay as the sandbox buyer. The order page confirms payment, and the order appears on the seller's dashboard with both amounts.

To see it from the seller's side, sign in and open Axori AI (Ctrl/⌘+J). Ask it to change the store, plan a campaign or refund an order: anything that changes something shows a card first and runs only when you approve.

## How PayPal is used

| PayPal feature | Where it's used |
|---|---|
| Orders v2: create and capture | Storefront checkout and chat payment links. The server computes every total; the browser and the model never send a price |
| PayPal JS SDK buttons (`@paypal/react-paypal-js`) | Checkout on the storefront |
| Webhooks with signature verification | `CHECKOUT.ORDER.APPROVED` captures the order if the buyer never returns to the site; `PAYMENT.CAPTURE.REFUNDED` confirms refunds |
| Payments v2 refunds | Full and partial refunds from an approval card, with `PayPal-Request-Id` so a second tap or a job retry never refunds twice |
| Cross-currency checkout | Naira isn't a PayPal currency, so the order is charged in the store's settlement currency at a rate locked when the order is created. The buyer sees both totals before paying, and the rate and its source are stored on the order |
| Captures and reporting APIs | The analytics reconciliation view checks each order and refund against PayPal |

Evidence from the sandbox, run on production: 22 real sandbox payments and 3 refunds (full, partial and half), each reconciled against PayPal. A ₦45,000 cake was charged 33.44 USD at the stored rate. A GBP store charged GBP directly. Replaying the same webhook left one paid order and moved stock once.

## What works

| Area | What it does |
|---|---|
| Voice | The mic sends audio straight to the agent, with no separate speech-to-text step. It shows what it heard, then acts on it. Tested in English and Nigerian Pidgin |
| Brand and store | Brand kit from a conversation. Three Market templates that take the brand's colours and fonts. Live draft preview, click a section and change it by chat, undo, publish after approval |
| Payments | PayPal checkout in any store currency, as described above. Prices are stored in integer minor units, with currencies such as JPY that have no decimals handled |
| Chat selling | A sales agent on Telegram answers from one store's catalog only, in the customer's language, creates an order, sends a PayPal link and sends a receipt in the chat once the order is paid. A pasted shop link binds the chat to that store |
| Inbox | Every customer chat in one place. The seller can take over a conversation from the agent, reply through the real channel, and hand it back |
| Marketing | Campaigns of on-brand images and captions. The seller approves and schedules them for a Telegram channel, or downloads a zip with each image, caption and suggested time. Each post has its own tracked link, so orders and revenue are counted per post |
| Shopify | Copies products, a collection and pages to a Shopify store after approval. Syncing again updates rather than duplicates. The Shopify token is stored encrypted |
| Analytics | An AG Studio workspace over the store's own data: sales, channels, products, customers, marketing conversion, and a reconciliation grid against PayPal captures and refunds |
| Money | PayPal balance, money in and out, PayPal fees, refunds, expenses, VAT, monthly statements as CSV, and the FX gain or loss between the rate buyers were quoted and the rate on withdrawals to Paga |
| Customers | Contacts from checkout and chat, labels, duplicate detection (for example 0803… and +234803… match), merge and export |
| Design and media | Brand kits, templates and a media library. Files dropped into Axori AI are checked by their bytes, tagged and matched to products |
| Connections | Export orders to Google Sheets through Zapier MCP, behind an approval card. The seller can make any Axori AI action stricter (Needs approval or Blocked), never looser, and every action is written to an activity log |

### Demo data

The demo account looks like it has been trading since 9 May 2026. That history is generated by `scripts/seed-v2.mts` with a fixed seed and loaded through the same import module a real seller would use. Every seeded or imported row carries a `source` column, so it is never mixed up with real sandbox orders (`source = 'app'`). `scripts/reset-demo.mts` restores the demo account in one command.

### Limits

- **Shopify themes:** Shopify refused our theme write, because `themeFilesUpsert` needs an exemption it grants separately. The seller gets a link to the theme editor with their colours and fonts listed.
- **Shared accounts:** this build has one Telegram channel and one Shopify dev store, so only the demo store can post to them. Other stores get the download pack.
- **Images:** image generation sits behind one adapter. The default renders on-brand graphics from templates with no AI model. A Cloudflare Workers AI (FLUX.1 schnell) adapter paints the background while code draws the words and price; it falls back to the template if the model is rate-limited. Gemini's image model returned 429s without paid access, which is why the adapter exists.
- **WhatsApp:** a Kapso WhatsApp adapter is built, with its webhook, signature check and 24-hour reply window, but it has not had an end-to-end phone test, so it is not claimed as working. An older Twilio adapter sits switched off behind `WHATSAPP_ENABLED`.
- **Other networks:** Instagram, Facebook, TikTok and Google appear in the marketing views through demo adapters behind the same interfaces. They do not post anywhere.
- **Not in this build:** a web chat bubble on the store, a logo generator, and payouts to Paga through an API (withdrawals are recorded, and the Money tab links to Paga).

## How it's built

![Architecture: people reach one Next.js app, whose modules call vendors only through adapters, with webhooks handed to background jobs](docs/architecture.svg)

- **App:** Next.js (App Router) with TypeScript in strict mode, Tailwind CSS, shadcn/ui and `motion`, hosted on Vercel.
- **Data:** Supabase for Postgres, auth, storage and row-level security on every table.
- **AI:** the Vercel AI SDK with Gemini Flash-tier for text and audio. Groq can stand in as the text model through one env flag.
- **Background work:** Inngest runs every slow or scheduled task: chat replies, image generation, publishing, Shopify sync and refunds.
- **Vendors:** PayPal Orders v2 and Payments v2, the Telegram Bot API, the Shopify Admin GraphQL API, Cloudflare Workers AI, Zapier MCP, Kapso, and open.er-api.com for exchange rates.
- **Analytics:** AG Grid and AG Studio.
- **Validation and tests:** Zod for every schema (env, tool inputs, API bodies, site config), and Vitest with over 200 unit tests. `scripts/e2e-*.mts` run the real flows against a deployment.

Some rules are enforced in code rather than asked of the model:

- **Money:** the model never supplies a price or total. Prices come from the database, and code writes the payment details a customer sees. VAT is computed on the server and stored on every order. Image prompts never contain prices.
- **Store scoping:** every tool gets its store from the session or the chat's binding, never from model output. Row-level security covers every table.
- **Approvals:** publishing, scheduling, Shopify actions, refunds, payment links from the seller side, imports, expenses and Zapier exports all show a card and run only after the seller approves. One list in `src/modules/agent/approvals.ts` gates them, and each has a test proving nothing happens before approval.
- **Untrusted input:** customer messages are data. The sales agent has three tools: `search_products`, `create_order` and `send_payment_link`. A test proves it has no connection or Zapier tool.
- **Webhooks:** verify the signature, store the event once, return 200, and do the work in a background job. The model is never called inside a webhook request.
- **Agent limits:** at most 8 tool steps per turn, a time limit on the agent route, streamed replies, and a daily request cap per store.
- **Site rendering:** the agent edits a validated JSON config. It never writes page code. Every edit is a versioned draft with a signed 24-hour preview link.

Each vendor sits behind an interface in `src/modules/<name>/adapters/`, so a new image model, payment provider or chat channel is one new file plus one registry entry, with no change to the agent. Three planned vendors changed during the build, and none of those changes touched the agent.

## Run it yourself

You need Node 22 or newer, and free accounts with Supabase, Google AI Studio, PayPal Developer, Telegram (a bot from @BotFather), Inngest and Vercel. Shopify, Cloudflare, Zapier and Kapso are optional.

```bash
git clone https://github.com/ChukwuebukaHenrey/axorios.git
cd axorios
npm install
cp .env.example .env.local   # then fill it in: every key has a comment
```

Apply the database schema, then create the demo seller and store:

```bash
npx supabase db push --db-url "<your Supabase session pooler connection string>"
npx tsx --env-file=.env.local scripts/seed-demo-user.mts
npx tsx --env-file=.env.local scripts/seed-demo-store.mts
```

Optionally, add six months of demo history (restore it later with `scripts/reset-demo.mts`):

```bash
npx tsx --env-file=.env.local scripts/seed-v2.mts
```

Start the app and the local job runner, each in its own terminal:

```bash
npm run dev
npx inngest-cli@latest dev
```

Open <http://localhost:3000> and sign in with the `DEMO_SELLER_EMAIL` and `DEMO_SELLER_PASSWORD` you set. The store is at `/s/demo`.

PayPal and Telegram must reach a public URL to call the webhooks. Deploy to Vercel, then register them with `scripts/register-paypal-webhook.mts` and `scripts/register-telegram-webhook.mts`.

```bash
npm test        # unit tests
npm run build   # production build
```

`scripts/e2e-*.mts` run the real flows against a deployment, and say at the top what they leave behind.

## License

[MIT](LICENSE)
