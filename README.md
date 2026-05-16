# Assignly

An AI assistant for university students. Connect your Canvas account, then ask questions in plain English — "What's due this week?", "What's my grade in CS 301?", "Summarize the announcements from my professors" — and get real answers pulled live from your Canvas data.

**[Live demo →](https://assignly.dev)** (no Canvas account needed — try the demo login)

---

## Features

- **AI agent loop** — Claude calls Canvas API tools in sequence to answer multi-step questions. The model decides which tools to call; you just ask.
- **Streaming chat** — answers stream word-by-word as they're generated, with tool-call indicators while Canvas data is being fetched.
- **Six Canvas tools** — list assignments, get assignment details, view grades, check the calendar, read announcements, and browse course modules.
- **Demo mode** — try the full app with realistic sample data, no Canvas account required.
- **Conversation history** — past threads are saved and resumable; delete conversations from the sidebar.
- **Canvas PAT auth** — connects via a Personal Access Token (read-only). Token is encrypted with AES-256-GCM at rest.
- **Rate limiting** — burst limit (20 messages/10 min) and daily cap (100 messages/day) protect against runaway costs.
- **DB-backed caching** — Canvas API responses are cached per-user with short TTLs to reduce API calls and latency.

---

## How it works

When you send a message, the server runs a multi-step agent loop powered by the Vercel AI SDK:

```
User message
    │
    ▼
POST /api/chat
    │
    ├─ Validate session + Canvas connection
    ├─ Build system prompt (today's date, user name, tool list)
    │
    └─ streamText(claude-sonnet-4-6, tools, maxSteps=8)
            │
            ├─ Claude decides to call list_assignments({ dueAfter: "..." })
            │       └─ Canvas API → cached results returned to Claude
            │
            ├─ Claude calls get_grades()
            │       └─ Canvas API → results returned to Claude
            │
            └─ Claude generates final answer
                    └─ Streamed back to browser, persisted to DB
```

Each tool is a thin wrapper around the Canvas REST API. The model chooses which tools to call and in what order — up to 8 steps per turn. Tool results are passed back to the model as context for the next step.

---

## Tech stack

| Layer     | Choice                                               |
| --------- | ---------------------------------------------------- |
| Framework | Next.js 15 (App Router)                              |
| Language  | TypeScript                                           |
| UI        | Tailwind CSS + shadcn/ui                             |
| AI        | Vercel AI SDK + Anthropic (`claude-sonnet-4-6`)      |
| Auth      | Better Auth (Google OAuth + email/password for demo) |
| Database  | Neon (serverless Postgres)                           |
| ORM       | Drizzle                                              |
| Hosting   | Vercel                                               |
| Tests     | Vitest (unit + integration)                          |
| CI        | GitHub Actions                                       |

---

## Local development

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) database
- An [Anthropic API key](https://console.anthropic.com)
- Google OAuth credentials (for Google sign-in)

### Setup

```bash
# Clone the repo
git clone https://github.com/Kyleverto/Assignly.git
cd Assignly

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local and fill in the values

# Push the database schema
npx drizzle-kit push

# Start the dev server
npm run dev
```

Visit `http://localhost:3000`.

### Environment variables

| Variable                    | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`       | Your app URL (e.g. `http://localhost:3000`)     |
| `BETTER_AUTH_SECRET`        | Random 32+ char string (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL`           | Same as `NEXT_PUBLIC_APP_URL`                   |
| `DATABASE_URL`              | Neon Postgres connection string                 |
| `TOKEN_ENCRYPTION_KEY`      | 64 hex chars (`openssl rand -hex 32`)           |
| `ANTHROPIC_API_KEY`         | Anthropic API key                               |
| `AUTH_GOOGLE_CLIENT_ID`     | Google OAuth client ID                          |
| `AUTH_GOOGLE_CLIENT_SECRET` | Google OAuth client secret                      |
| `DEMO_USER_PASSWORD`        | Password for the shared demo account            |
| `MAX_AGENT_ITERATIONS`      | Max tool-call steps per turn (default: 8)       |

---

## Connecting Canvas

After signing in with Google:

1. Go to your Canvas instance → **Account → Settings → New Access Token**
2. Generate a token and copy it
3. On the Assignly onboarding page, enter your school's Canvas URL and paste the token
4. You'll be redirected to the dashboard — you won't need to enter the token again

Tokens are encrypted with AES-256-GCM before storage. The plaintext token is never logged or cached.

---

## Running tests

```bash
# Unit tests (no external services needed)
npx vitest run

# Integration tests (requires DATABASE_URL and ANTHROPIC_API_KEY)
npx vitest run tests/integration

# Type check
npm run typecheck

# Lint
npm run lint
```

### Test architecture

| Layer       | Tool           | What it covers                                                                   |
| ----------- | -------------- | -------------------------------------------------------------------------------- |
| Unit        | Vitest + msw   | Crypto round-trips, Canvas client pagination and error handling, Canvas DB cache |
| Integration | Vitest + msw   | Full `POST /api/chat` → tool call → DB persistence with mocked Anthropic         |
| Type safety | `tsc --noEmit` | Run in CI on every push                                                          |

The integration test (`tests/integration/agent-loop.test.ts`) is the centrepiece: it intercepts the Anthropic API at the HTTP level using msw, runs the real agent loop against demo Canvas data, and asserts that the thread and messages are correctly persisted to the database. It proves the full pipeline without requiring a real Anthropic API call or live Canvas account.

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Kyleverto/Assignly)

After deploying:

1. Add all environment variables in the Vercel dashboard
2. Add your Vercel deployment URL as an authorized redirect URI in your Google OAuth app (`https://your-app.vercel.app/api/auth/callback/google`)
3. Redeploy

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture diagram, data model, auth flow, and Canvas tool catalog.
