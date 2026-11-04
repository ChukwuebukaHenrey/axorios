# Start here — get everything ready, then Claude Code builds

You prepare accounts, tools and keys. Claude Code creates the repo, the project and everything inside it.

## 1. Tools on your machine
| Tool | Install / check (Git Bash) | Why |
|---|---|---|
| Node.js 20+ | `node -v` | Runs Next.js |
| Git + identity | `git config --global user.name` / `user.email` | Commits |
| GitHub CLI | `winget install --id GitHub.cli` (PowerShell), then `gh auth login` → GitHub.com → HTTPS → browser | Lets Claude Code create the repo and push. Replaces the PAT; delete the old token |
| Vercel CLI | `npm i -g vercel`, then `vercel login` | Lets Claude Code link and deploy |
| cloudflared | `winget install --id Cloudflare.cloudflared` (PowerShell) | Webhook tunnel. If it won't install: `npm i -g ngrok` + free ngrok account works the same |
| Claude Code | already working | Builds everything |

No Docker needed: we use your hosted Supabase project directly, not a local database.

## 2. Accounts and keys
| Service | Status | What to collect into `.env.local` |
|---|---|---|
| PayPal | Sandbox app ✅ | Client ID + Secret; note the sandbox **buyer** email/password (Testing Tools → Sandbox Accounts) |
| Supabase | ✅ | URL, anon key, service-role key, project ref, DB password |
| Google AI Studio | Key ✅ | Turn billing on + $10 budget alert |
| Twilio | ✅ (rotate token) | SID, new auth token. Messaging → Try it out → WhatsApp: join the Sandbox from your phone |
| Telegram | ✅ (rotate token) | New bot token; create a public channel, add the bot as admin, note `@channel_name` |
| Inngest | ✅ | Nothing now; keys only at deploy time |
| Vercel | ✅ | Nothing; `vercel login` covers it |
| Shopify | Blocked | See below |

### Shopify workaround
The Stripe ID check is for **collaborator access to other merchants' stores**, not for dev stores. Create the store from the Dev Dashboard instead of the Partner Dashboard:
1. Go to dev.shopify.com/dashboard → **Stores** → **Create store** → type **Dev** → name it → create.
2. Don't create the app yet; Claude Code sets it up in step 0.5 with Shopify CLI.

If the Dev Dashboard also asks for verification: it's a government ID + selfie through Stripe, a few minutes. If you'd rather not, skip it. Shopify is spike 0.5 and step 4.4; everything else proceeds without it, and Shopify drops to the cut list.

## 3. Prepare the folder (no repo, no code)
```
axorios/
  CLAUDE.md
  REQUIREMENTS.md
  .env.local          ← from env/.env.local, filled in
  docs/spec.md        ← export the architecture doc as Markdown
```
Generate the two random secrets in Git Bash: `openssl rand -base64 32` (run twice).

## 4. First Claude Code session
Open Git Bash in `axorios/`, run `claude`, paste:
```
Read CLAUDE.md, REQUIREMENTS.md and docs/spec.md fully. .env.local already holds the keys; never print its values.

1. Scaffold Next.js (App Router, TypeScript, Tailwind, src dir, ESLint) into a temp
   folder and move it into this folder, keeping CLAUDE.md, docs/ and .env.local.
   Add .env.example (keys only, with comments), MIT LICENSE, README stub.
2. git init, first commit, then create a public GitHub repo with
   `gh repo create <name> --public --source=. --push`.
3. Link Supabase. First load the env into the shell (`set -a; source .env.local;
   set +a`), then `npx supabase link --project-ref $SUPABASE_PROJECT_REF
   --password $SUPABASE_DB_PASSWORD`. SUPABASE_ACCESS_TOKEN in the env handles login.
   Migrations go in supabase/migrations and apply with `npx supabase db push`.
4. Create plans/axorios.md from the "Build plan" and "Decisions, open questions
   and scope" sections of docs/spec.md, keeping every step's size, acceptance,
   verification and Blocked-by, plus a Progress table.
5. Execute Phase 0 in order (0.1, 0.7, then 0.2–0.6 as scripts in scripts/). For 0.2 find
   the AI SDK version @paypal/agent-toolkit works with and pin exact versions.
   For 0.5 use Shopify CLI to create an app on my dev store with the scopes in the
   spec; if the store isn't ready, mark 0.5 blocked and continue.
6. After each step run its verification, show output, update Progress, commit, push.
7. Stop after Phase 0 and report: spikes passed, pinned versions, Shopify theme
   write result, FX provider chosen. Don't start Phase 1 until I confirm.
```

## 5. Every session after
```
Read CLAUDE.md and plans/axorios.md. Continue with the next Not started step whose
blockers are done. Follow "How to work". Stop at the end of the phase and report.
```

## 6. Phase gates
- Phase 0: spikes green (Shopify may be blocked) → Phase 1
- Phase 1: a bakery store is live from a chat
- Phase 2: sandbox buyer pays; order shows both currencies
- Phase 3: a WhatsApp chat ends in a paid order
- Phase 4: 3 consistent posts, one on Telegram; Shopify sync twice without duplicates
- 11 Nov: record video, submit
