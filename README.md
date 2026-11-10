# Retail Intelligence Radar

Team web app that tracks investment, expansion, acquisition and technology signals from retail companies in India and the USA, using public sources, and turns them into a shared opportunity pipeline for AlgoShack business development.

```
Public sources ──► Daily collector (GitHub Actions) ──► Claude classifies ──► Supabase database
 Google News RSS     fetch, de-duplicate                   company, market, sector,     signals, runs,
 GDELT               48 + 8 + 4 + 3 searches               signal type, summary,        opportunities,
 SEC EDGAR                                                 implication, AlgoShack fit   team, audit log
 Press-release RSS                                                                           │
                                                   Web app (GitHub Pages) ◄──────────────────┘
                                                   Feed · Investments · Pipeline · AI assistant ──► "ask" Edge Function (Claude, with citations)
```

## What needs to be connected

| # | What | Where it goes | Needed for |
|---|------|---------------|-----------|
| 1 | **Supabase project** (free) | — | Everything |
| 2 | Supabase **URL** and **anon (public) key** | `.env.production` in this repo | Web app |
| 3 | Supabase **service-role key** | GitHub secret `SUPABASE_SERVICE_ROLE_KEY` (+ secret `SUPABASE_URL`) | Daily collector writes data |
| 4 | **Anthropic API key** | GitHub secret `ANTHROPIC_API_KEY` | Classification + AI assistant |
| 5 | Supabase **access token** and **project ref** | GitHub secret `SUPABASE_ACCESS_TOKEN`, variable `SUPABASE_PROJECT_REF` | Deploying the AI assistant |
| 6 | SEC contact string, e.g. `AlgoShack Research research@algoshack.com` | GitHub variable `SEC_USER_AGENT` | SEC EDGAR (SEC requires it) |
| 7 | GitHub Pages | Settings → Pages → Source: GitHub Actions | Hosting |

Optional GitHub variables: `CLAUDE_MODEL` (default `claude-opus-5-5`), `MAX_CLASSIFY` (articles classified per day, default 200).

Never commit the service-role key or the Anthropic key. The anon key is public by design (it ships in the web page); the database rules protect the data.

## Setup

1. **Supabase**: create a project. In **SQL Editor**, run `supabase/migrations/001_init.sql`.
   Under **Authentication → Sign In / Providers → Email**, turn **off** "Allow new users to sign up" (the team is invite-only).
   Under **Authentication → URL Configuration**, set **Site URL** to the GitHub Pages address.
2. **Keys**: from **Project Settings → API**, copy the URL and anon key into `.env.production`; put the service-role key in GitHub secrets.
3. **Invite the team**: **Authentication → Users → Invite user**. Each person gets an email, sets a password, and is added as a member. Make yourself admin in the SQL editor:
   `update team_members set role = 'admin' where email = 'you@company.com';`
4. **GitHub**: add the secrets and variables above, enable Pages, then run **Actions → Collect signals → Run workflow** and **Actions → Deploy AI assistant → Run workflow**.

## Costs

GitHub Actions, Pages and Supabase free tiers cover this. The Claude API is pay-per-use: classifying ~200 articles/day with `claude-opus-5-5` is roughly $1–2/day; each assistant question costs a few cents. Set `MAX_CLASSIFY` or `CLAUDE_MODEL` (e.g. `claude-haiku-5-5`, far cheaper) to adjust.

## Local development

```bash
npm install
npm run dev                    # web app (needs .env.local with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... npm run collect
```

Search terms, sectors, markets and feeds are in `collector/config.ts`.

## Data notes

- Only headlines, snippets, links and AI classifications are stored, not full article text.
- Summaries, implications and fit scores are AI-generated from headlines and snippets; verify against the source before outreach.
- Investors and amounts are recorded only when the source states them.
