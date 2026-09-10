# Job Assistance

A self-hosted job-application tracker that researches the company, tailors your resume, drafts your outreach, and finds who to send it to — one click per job.

---

## Why this app exists

Applying to jobs well and applying to jobs *often* pull in opposite directions. The applications that actually land interviews are the researched ones — the resume rewritten against the posting's own language, the outreach message that names something real about the company, the email that reaches a human instead of a careers portal. Doing that by hand takes an hour per role, so most people stop doing it by application number five and start spraying the same PDF everywhere.

This app automates the hour.

Paste four links and the job description, click **Add to tracker**, and a pipeline runs the research a careful applicant would have done manually:

- **Researches the company** — two live web searches covering its mission, products, and funding, then its engineering culture, tech stack, and engineering blog, with sources kept.
- **Tailors your resume to the posting** — rewritten against the actual job description, ATS-friendly and one page, rendered to PDF.
- **Scores the match and names the gaps** — a 0–100 JD-match percentage plus the concrete keywords the posting asks for that your resume never states, each one selectable for a targeted regenerate.
- **Drafts the outreach** — a personalized first-contact message and a follow-up, both grounded in the research rather than in filler.
- **Finds who to send it to** — real contacts at the company, with emails and confidence scores.

Everything lands on one tracker row you can reopen, edit, and move through the pipeline (`not_applied` → `applied` → `phone_screening` → `interviewing` → `offer` / `rejected` / `ghosted`). The goal is straightforward: keep the quality of a hand-researched application while making the volume of a mass-applied one possible.

It runs entirely on your own machine, against your own API keys, with your own master CV.

---

## Tech stack

| Frontend | Backend | External APIs |
| --- | --- | --- |
| Next.js 16 (App Router) | NestJS 11 on the Fastify adapter | **Perplexity Sonar** — company research, 2 calls per job |
| React 19 | PostgreSQL 16 | **Anthropic Claude** — outreach + follow-up drafts (`claude-sonnet-5`), tailored resume (`claude-opus-4-8`), JD-match scoring and regeneration (`claude-opus-5`) |
| TypeScript 5 | TypeORM (migrations, no `synchronize`) | **Hunter.io** — contact email discovery by company domain |
| Tailwind CSS v4 | class-validator / class-transformer DTOs | |
| Jest + React Testing Library | Swagger / OpenAPI (served at the API root) | |
| | Handlebars + Puppeteer (resume → PDF) | |
| | Docker Compose (web, api, postgres, pgAdmin) | |

---

## Visual demo

> **TODO — screenshots not captured yet.** Drop the images in `docs/assets/` and these links resolve. Suggested set below.

| | |
| --- | --- |
| ![The quick-add form and job tracker](docs/assets/tracker.png) | ![The five-stage setup pipeline](docs/assets/pipeline.png) |
| **The tracker** — quick-add form on top, every tracked job below with its status, date applied, and last contacted. | **The setup pipeline** — five stages, each flipping to done the moment its real API call returns. Failures name the stage and offer a retry. |
| ![The job detail window](docs/assets/job-detail.png) | ![JD match score and missing keywords](docs/assets/match-score.png) |
| **The job detail window** — research notes, both drafted messages, the contacts Hunter found, and the tailored resume download. | **Match score and gaps** — the JD-match percentage plus the keywords the posting wants that your resume is missing; tick the ones to work in and regenerate. |

---

## Quick start

Everything runs in Docker. You need **Docker Desktop** (or any Docker engine with Compose v2) and nothing else installed locally.

```bash
git clone https://github.com/JMReynoso/job-assistance.git
cd job-assistance

# 1. Environment. The example is safe to start from — keys can stay blank.
cp api/.env.example api/.env

# 2. Your master CV. The tailoring step rewrites this file against each posting.
cp api/src/CV/resume.example.json api/src/CV/resume.json

# 3. Up.
docker compose -f infra/docker-compose.dev.yml up --build
```

First build takes a few minutes (it installs a headless Chromium for the PDF renderer). Once it settles:

| | Where | What |
| --- | --- | --- |
| **Web app** | <http://localhost:4000> | The tracker — start here |
| **API + Swagger UI** | <http://localhost:4001> | Live, generated API docs (raw OpenAPI at `/-json`) |
| **pgAdmin** | <http://localhost:5050> | Database browser, no login required |
| **Postgres** | `localhost:5432` | `postgres` / `postgres`, database `job_assistance` |

Migrations run automatically on API startup, and seed data loads unless you set `RUN_SEEDS=false` — so the tracker has example rows in it the first time you open it.

### API keys

The app **boots and runs without any keys**, so you can explore the UI immediately. Each key unlocks one stage of the pipeline; without it, that stage fails visibly in the progress modal and the rest still work. Add whichever you want to `api/.env`:

| Variable | Get one at | Powers |
| --- | --- | --- |
| `PERPLEXITY_API_KEY` | <https://www.perplexity.ai/settings/api> | The **research** stage |
| `ANTHROPIC_API_KEY` | <https://platform.claude.com> | The **tailoring** stage — messages, resume, match score |
| `HUNTER_API_KEY` | <https://hunter.io/api-keys> | The **contacts** stage |

`api/.env` and `api/src/CV/resume.json` are both gitignored — your keys and your real CV never get committed.

### Editing while it runs

Both services hot-reload from bind mounts, so edits under `web/` and `api/` apply without a rebuild. The API also exposes the Node inspector on `9229` for the VS Code attach config — see [docs/debugging.md](docs/debugging.md).

To stop: `docker compose -f infra/docker-compose.dev.yml down`. Add `-v` to also wipe the database.

---

## Running the tests

### Frontend — the real suite

25 test files covering components, hooks, and the whole API boundary, with coverage collected on every run against a 75% floor.

```bash
cd web
npm install
npm test              # or: npm run test:watch
```

> **Note:** a handful of assertions in `tests/lib/date.test.ts` are timezone-sensitive and expect UTC. If you see failures there and nowhere else, run `TZ=UTC npm test`.

### Backend — work in progress

The API's test coverage is **not built out yet**. What exists today is a single end-to-end smoke test hitting `GET /health`; there are no unit specs for the services, repositories, or controllers.

```bash
cd api
npm install
npm run test:e2e      # needs Postgres reachable — easiest with the dev stack up
npm test              # unit runner is wired, but matches no spec files yet
```

Contributions here are the most useful thing anyone could add. The layering is already test-friendly — services throw their own `NotFoundException`s and repositories are the only files that touch TypeORM — so services can be tested against a mocked repository without a database.

---

## Project structure

```
job-assistance/
├── api/                        NestJS backend
│   └── src/
│       ├── entities/           One folder per feature — the core of the API
│       │   ├── jobs/           The job you're applying to
│       │   ├── companyResearch/  What Perplexity found
│       │   ├── generatedContent/ What Claude wrote (+ resume-pdf/ renderer)
│       │   ├── contacts/       Who Hunter found
│       │   ├── jobDetail/      Composes the four above into one save endpoint
│       │   └── example/        A copy-me template, not a real feature
│       ├── externalAPIs/       Thin clients: claude/, perplexity/, hunter/, ollama/
│       ├── database/           migrations/ and seeds/
│       ├── CV/                 Your master resume JSON (gitignored)
│       └── main.ts             Bootstrap: CORS, migrations, seeds, validation, Swagger
│
├── web/                        Next.js frontend
│   ├── src/
│   │   ├── app/                App Router entry
│   │   ├── components/job-assistance/   The tracker, forms, and modals
│   │   ├── hooks/              useJobTracker, useCreateJob, useRegenerateResume
│   │   └── lib/
│   │       ├── api/            client, jobs, mappers, types — the wire boundary
│   │       └── job-assistance/ Pure domain helpers
│   └── tests/                  Mirrors src/ — a test's path tells you what it covers
│
├── infra/                      docker-compose.dev.yml, docker-compose.prod.yml
└── docs/                       Deep-dive guides — see below
```

Each entity folder follows the same five-file shape: `.entity.ts` (the TypeORM model) → `.repository.ts` (the only file that touches `Repository<T>`) → `.service.ts` (business logic) → `.controller.ts` (routes + Swagger) → `.module.ts`, plus a `dto/` folder. Copy `entities/example/` to start a new one.

---

## Documentation

**The [`docs/`](docs/) folder is where the real depth lives.** This README is the tour; those pages are the manual. Each is written to be read by someone who has never touched the technology in question.

| Page | Covers |
| --- | --- |
| [data-model.md](docs/data-model.md) | Every entity, table, column, and endpoint in one place — start here |
| [add-job-pipeline.md](docs/add-job-pipeline.md) | What "Add to tracker" actually does, stage by stage, including retry and cancel |
| [job-detail-window.md](docs/job-detail-window.md) | How one job is assembled from four tables, and how Save writes back |
| [controllers-services-repositories.md](docs/controllers-services-repositories.md) | Adding a feature to the API, the way this project does it |
| [migrations-and-seeds.md](docs/migrations-and-seeds.md) | Changing the schema and loading data with TypeORM |
| [claude-api.md](docs/claude-api.md) | The Claude integration: prompts, parsing, cost tracking |
| [perplexity-api.md](docs/perplexity-api.md) | The Perplexity Sonar integration: research angles, sources |
| [hunter-api.md](docs/hunter-api.md) | The Hunter.io integration: domain search, confidence scores |
| [debugging.md](docs/debugging.md) | Breakpoints in the API from VS Code, including inside Docker |

---

## Architecture overview

### The components

```
   Browser  ──────────────────────────────────────────────────────────┐
      │                                                               │
      │  http://localhost:4000                                        │
      ▼                                                               │
┌──────────────────────────┐                                          │
│  web  ·  Next.js 16      │   Renders the tracker. No server-side    │
│  React 19 · Tailwind v4  │   data layer — the browser calls the     │
│                          │   API directly from client components.   │
│  hooks/  ─ pipeline,     │                                          │
│            tracker state │                                          │
│  lib/api/ ─ the only     │                                          │
│            place that    │                                          │
│            knows the     │                                          │
│            wire format   │                                          │
└──────────────────────────┘                                          │
      │                                                               │
      │  fetch → http://localhost:4001   (CORS-allowed origin)  ◀──────┘
      ▼
┌───────────────────────────────────────────────────────────────────────┐
│  api  ·  NestJS 11 on Fastify                                         │
│                                                                       │
│   Controller  →  Service  →  Repository  →  TypeORM                   │
│   (routes,       (business    (the only                               │
│    Swagger,       logic,       file that                              │
│    DTO valid-     404s,        talks to                               │
│    ation)         orchestr-    the ORM)                               │
│                   ation)                                              │
│                                                                       │
│   Feature modules:  jobs · company-research · generated-content ·     │
│                     contacts · job-detail (composes the other four)   │
│                                                                       │
│   External clients (loaded per-module, so the app boots without keys):│
│      PerplexityService     ClaudeService      HunterService           │
│              │                   │                  │                 │
└──────────────┼───────────────────┼──────────────────┼─────────────────┘
               │                   │                  │
               ▼                   ▼                  ▼
        Perplexity Sonar      Anthropic API       Hunter.io
                                   │
                                   ▼
                          ResumePdfService
                        (Handlebars → Chromium
                         → PDF on a volume)
               │
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│  postgres 16   ·   jobs · company_research · generated_content ·      │
│                    missing_keywords · contacts                        │
│                                                                       │
│  Migrations run at API startup. `synchronize` is off.                 │
└───────────────────────────────────────────────────────────────────────┘
```

### The data model

A **job** is the center; the other three tables hang off it by `jobId`, each filled by a different external API:

```
                    jobs  ← you create this first
                      │ jobId
      ┌───────────────┼───────────────┐
      ▼               ▼               ▼
company_research → generated_content  contacts
(Perplexity)       (Claude)           (Hunter.io)
                        │
                        ▼
                  missing_keywords
```

Two things that arrow means in practice:

- **`generated_content` cannot be created until `company_research` exists** for that job — the drafting prompts have nothing to personalize from, so the endpoint 404s. This is why the setup pipeline is strictly sequential rather than a `Promise.all`.
- **`jobId` carries no foreign key** anywhere except `missing_keywords`. Deleting a job leaves its satellites behind, which is why cancelling a setup run deletes each row explicitly, newest first.

### The data flow: one click, five stages

Clicking **Add to tracker** runs this chain, each stage a real HTTP call whose response flips its node in the progress modal:

```
 1. created     POST /jobs                → the jobs row; every later call needs its id
 2. research    POST /company-research    → 2 Perplexity searches
 3. tailoring   POST /generated-content   → 4 Claude calls + a PDF render
 4. contact     POST /contacts            → 1 Hunter.io domain search
 5. ready       GET × 4                   → reads the finished job back onto its row
```

A failure stops the chain at that stage and shows the API's own error text. **Retry resumes from the failed stage**, not from the start — re-running a stage that already succeeded means paying Perplexity or Claude for it twice.

### Key endpoints

The full table is in [data-model.md](docs/data-model.md#every-endpoint-in-one-table); Swagger at <http://localhost:4001> is the exact, live version. The ones that matter:

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/jobs` | The tracker list |
| `POST` | `/jobs` | Stage 1 — create the job row |
| `PATCH` | `/jobs/:id/detail` | The detail window's Save — fans one draft across `jobs`, `company_research`, and `missing_keywords` in a single call |
| `DELETE` | `/jobs/:id` | Remove a job |
| `POST` | `/company-research` | Stage 2 — Perplexity × 2 |
| `POST` | `/generated-content` | Stage 3 — Claude × 4 + PDF render. 404s if the job has no research yet |
| `POST` | `/generated-content/regenerate` | Rewrite the resume around chosen missing keywords, then re-score |
| `POST` | `/contacts` | Stage 4 — Hunter domain search; returns an array |
| `GET` | `/company-research/by-job/:jobId` | Newest research for a job, or `null` |
| `GET` | `/generated-content/by-job/:jobId` | Newest content + its missing keywords, or `null` |
| `GET` | `/contacts/by-job/:jobId` | A job's contacts, or `[]` |
| `GET` | `/health` | Liveness |

The three `by-job` reads deliberately **never 404** — "no research yet" is the normal state of a job you just added, so absence is returned as data. That gives the frontend one rule with no per-endpoint exceptions: any non-`ok` response is a real error.

---

## Status

Actively being built. The add-job pipeline, the job detail window, and the regenerate flow are all wired end to end against the real API. Known gaps are tracked honestly in each doc's "What isn't wired" / "Known gaps" section — the largest ones today being backend test coverage, server-side cancellation of an in-flight pipeline run, and the missing foreign keys noted above.
