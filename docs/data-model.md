# The data model — entities, tables, and endpoints

One page covering **everything the API stores and exposes**: each entity, the Postgres table behind it, how rows get written, and the HTTP endpoints that reach them.

- For *how* the layers fit together (controller → service → repository), see [controllers-services-repositories.md](controllers-services-repositories.md).
- For how the web app assembles one job out of these four tables, see [job-detail-window.md](job-detail-window.md).
- For *how* the schema changes, see [migrations-and-seeds.md](migrations-and-seeds.md).
- For the external APIs that fill three of these tables, see [perplexity-api.md](perplexity-api.md), [claude-api.md](claude-api.md), and [hunter-api.md](hunter-api.md).

**Live API docs:** the running app serves Swagger UI at the root — <http://localhost:4001> — generated from the `@ApiProperty` / `@ApiResponse` decorators on these entities and controllers. This document is the narrative version; Swagger is the exact one.

---

## The shape of the app

A **job** is the center of everything. The other three tables hang off it by `jobId`, and each one is filled by a different external API:

```
                          ┌───────────────────────┐
                          │  jobs                 │  ← you create this first
                          │  the thing you're     │     (company, posting URL, status)
                          │  applying to          │
                          └───────────┬───────────┘
                                      │ jobId
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
   ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
   │ company_research   │→ │ generated_content  │  │ contacts           │
   │ what the company   │  │ outreach, follow-  │  │ who to send it to  │
   │ is about           │  │ up, tailored CV    │  │                    │
   ├────────────────────┤  ├────────────────────┤  ├────────────────────┤
   │ Perplexity Sonar   │  │ Claude             │  │ Hunter.io          │
   └────────────────────┘  └────────────────────┘  └────────────────────┘
```

The arrow matters: **`generated_content` can't be created until `company_research` exists** for that job — the drafting prompts have nothing to personalize from otherwise, so the endpoint 404s. `contacts` is independent; look them up whenever.

### At a glance

| Entity | Table | Base route | Filled by | Holds |
| --- | --- | --- | --- | --- |
| [`Job`](../api/src/entities/jobs/job.entity.ts) | `jobs` | `/jobs` | you (the request) | The company, its URLs, pipeline status, and the applied / last-contacted dates |
| [`CompanyResearch`](../api/src/entities/companyResearch/entities/company-research.entity.ts) | `company_research` | `/company-research` | Perplexity Sonar | A research summary + its sources |
| [`GeneratedContent`](../api/src/entities/generatedContent/entities/generated-content.entity.ts) | `generated_content` | `/generated-content` | Claude | Two drafted messages, a resume PDF path, and what they cost |
| [`Contact`](../api/src/entities/contacts/entities/contact.entity.ts) | `contacts` | `/contacts` | Hunter.io | People at the company, with emails |
| [`Example`](../api/src/entities/example/example.entity.ts) | `examples` | *(not mounted)* | seeds only | A copy-me template, not a real feature |

---

## Conventions that apply to every entity

- **Primary key** is always `id`, a Postgres `SERIAL` (auto-incrementing integer).
- **Timestamps** are always `created_at` / `updated_at` (`TIMESTAMP NOT NULL DEFAULT now()`), exposed as `createdAt` / `updatedAt` in TypeScript. Every other column keeps its camelCase name in the database — `"jobId"`, `"companyName"` — which is why they need double quotes in raw SQL.
- **`jobId` is a plain `integer` with no foreign-key constraint.** The relationship is a convention the code upholds, not something Postgres enforces. See the gaps section below for what that costs.
- **Anything an external API returned verbatim goes in `jsonb`** (`urls`, `usage`, the three `*Usage` columns) — queryable, but stored without us having to model it.
- **Request bodies are validated and stripped.** A global `ValidationPipe` with `whitelist: true` means any field not declared on the DTO is silently dropped before your service sees it; `transform: true` turns `"5"` into `5` where the DTO says number.
- **Errors are consistent:** `400` from validation, `404` raised by the service when a row is missing, `503` when an external API is busy or unreachable, `500` from [`BaseRepository`](../api/src/entities/base.repository.ts) if Postgres itself fails (the real error is logged, never returned). The three `by-job/:jobId` reads are the deliberate exception — they answer `200` with `[]` or `null` rather than 404ing; see [below](#the-by-job-routes-never-404).
- **Migrations own the schema.** `synchronize` is off — editing an entity does nothing until you write a migration.

---

## `jobs` — the job you're applying to

The root record. Created by hand (or by the frontend); everything else references it.

### Columns

| Column | Type | Null? | Notes |
| --- | --- | --- | --- |
| `id` | `SERIAL` | no | PK |
| `companyName` | `text` | no | |
| `jobPostingURL` | `text` | no | The original posting |
| `companyPage` | `text` | no | Company website — also what Hunter's domain lookup is derived from |
| `companyLinkedIn` | `text` | no | |
| `extraURLs` | `text` | **yes** | One extra link (Crunchbase, etc.) |
| `status` | `text` | no | Default `'not_applied'` |
| `dateApplied` | `date` | no | Default `CURRENT_DATE` — the day the application went in |
| `dateLastContacted` | `date` | no | Default `CURRENT_DATE` — the day the company was last heard from |
| `created_at` / `updated_at` | `TIMESTAMP` | no | |

`status` is a plain `text` column backed by the [`Status`](../api/src/entities/jobs/enum/status.enum.ts) enum in TypeScript — the DTO validates it, Postgres doesn't:

`not_applied` · `applied` · `phone_screening` · `interviewing` · `offer` · `rejected` · `ghosted`

**Both date columns are `NOT NULL` with a `CURRENT_DATE` default**, so a job has both from the moment it exists and there is no "unset" state to render or guard against. TypeORM hydrates a `date` column to a **`'YYYY-MM-DD'` string**, not a `Date` — which is exactly what an `<input type="date">` wants, so the frontend needs no formatting layer in either direction. They were added by [`1784468500000-JobsApplicationDates`](../api/src/database/migrations/1784468500000-JobsApplicationDates.ts), whose `DEFAULT` backfilled existing rows in the same statement.

### Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `GET` | `/jobs` | — | `200` — all jobs, `id ASC` |
| `GET` | `/jobs/:id` | — | `200` · `404` |
| `POST` | `/jobs` | `CreateJobDto` | `201` — the created job |
| `PATCH` | `/jobs/:id` | `UpdateJobDto` (all fields optional) | `200` · `404` |
| `DELETE` | `/jobs/:id` | — | `204` · `404` |

**`CreateJobDto`** — `companyName` (≤255 chars), `jobPostingURL`, `companyPage`, `companyLinkedIn` are required; `extraURLs`, `status`, `dateApplied`, and `dateLastContacted` optional. All four URL fields are validated with `@IsUrl()`.

The two dates are matched against `/^\d{4}-\d{2}-\d{2}$/` rather than `@IsDateString()` — which would also accept a full ISO datetime, and a `date` column has nowhere to put the time. `@Matches` also **rejects `''`** where `@IsOptional()` alone would not, so neither `POST` nor (via `PartialType`) `PATCH` can blank one back out.

### How rows get written

Straightforwardly — `JobsService` hands the DTO to `JobsRepository.create()`, which is a plain TypeORM `save()`. No external API involved.

---

## `company_research` — what Perplexity found

One row per research run. See [perplexity-api.md](perplexity-api.md) for the parsing detail.

### Columns

| Column | Type | Null? | Comes from |
| --- | --- | --- | --- |
| `id` | `SERIAL` | no | |
| `jobId` | `integer` | no | the request |
| `company` | `text` | no | `dto.companyName` |
| `summary` | `text` | no | Both research angles' 5-bullet reports, joined by a `----------` rule |
| `urls` | `jsonb` | no | Deduped source URLs, ranked (`string[]`) |
| `usage` | `jsonb` | no | `{ totalCost, searches, promptTokens, completionTokens }` |
| `created_at` / `updated_at` | `TIMESTAMP` | no | |

### Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/company-research` | `CreateCompanyResearchDto` | `201` — the created row (**runs two live Sonar searches; takes seconds**) |
| `GET` | `/company-research` | — | `200` — all rows |
| `GET` | `/company-research/by-job/:jobId` | — | `200` — the newest row for the job, **or `null`** |
| `GET` | `/company-research/:id` | — | `200` · `404` |
| `DELETE` | `/company-research/:id` | — | `204` · `404` |

**No `PATCH`** — a research row is a snapshot of one API run; re-run it rather than edit it.

**`CreateCompanyResearchDto`** — `jobId` (positive int), `companyName`, `jobPostingUrl`, `companyPageUrl`, `companyLinkedInUrl` required; `extraLinks` (array of URLs) optional. The three URLs plus any extras become Perplexity's `verifyUrls` — trusted pages it cross-checks its claims against.

### How rows get written

`CompanyResearchService.create()` calls `PerplexityService.research()`, then the repository spreads the result straight onto the entity — `summary`, `urls`, and `usage` are named to match the service's return type, so the two can't drift without a compile error.

---

## `generated_content` — what Claude wrote

One row per generation run: both messages, the resume, and the cost of each. See [claude-api.md](claude-api.md) for the parsing detail.

### Columns

| Column | Type | Null? | Comes from |
| --- | --- | --- | --- |
| `id` | `SERIAL` | no | |
| `jobId` | `integer` | no | the request |
| `outreachMessage` | `text` | yes | `draftOutreachMessage()` |
| `followupMessage` | `text` | yes | `draftFollowUpMessage()` |
| `tailoredResume` | `text` | yes | **The PDF's file path** — not the resume text |
| `outreachMessageUsage` | `jsonb` | yes | Anthropic's raw token counts |
| `followupMessageUsage` | `jsonb` | yes | " |
| `tailoredResumeUsage` | `jsonb` | yes | " |
| `outreachMessageCost` | `double precision` | yes | Our USD estimate from those counts |
| `followupMessageCost` | `double precision` | yes | " |
| `tailoredResumeCost` | `double precision` | yes | " |
| `created_at` / `updated_at` | `TIMESTAMP` | no | |

Every content column is nullable so a partial run can still be recorded.

### Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/generated-content` | `CreateGeneratedContentDto` | `201` — the created row (**three Claude calls + a PDF render; slowest endpoint in the app**) |
| `GET` | `/generated-content` | — | `200` — all rows |
| `GET` | `/generated-content/by-job/:jobId` | — | `200` — the newest run for the job, **or `null`** |
| `GET` | `/generated-content/:id` | — | `200` · `404` |
| `PATCH` | `/generated-content/:id` | `UpdateGeneratedContentDto` | `200` · `404` — **see the gap below** |
| `DELETE` | `/generated-content/:id` | — | `204` · `404` |

**`CreateGeneratedContentDto`** — `jobId`, `jobPosting` (the posting text, not a URL), `companyWebsite` required; `companyName` optional (falls back to the `Job` record).

### How rows get written

`GeneratedContentService.create()` is the most involved path in the app:

1. Read the master CV from `api/src/CV/resume.json` as raw text.
2. Resolve the company name — request, else the `Job` record.
3. Load the **latest** `company_research` for the job → **`404` if there is none**.
4. Three Claude calls off that summary: outreach, follow-up, tailored resume.
5. Render the resume JSON → PDF (Handlebars + Puppeteer), keep the path.
6. One `repository.create()` with all of it, costs included.

**A job can have many rows.** Nothing stops a second `POST` for the same `jobId`; you get another row, and the older ones stay as history.

---

## `contacts` — who Hunter found

One row per person per job. See [hunter-api.md](hunter-api.md) for the parsing detail.

### Columns

| Column | Type | Null? | Comes from |
| --- | --- | --- | --- |
| `id` | `SERIAL` | no | |
| `jobId` | `integer` | no | the request |
| `email` | `text` | no | Hunter `value` |
| `firstName` | `text` | yes | `first_name` — Hunter often has no name |
| `lastName` | `text` | yes | `last_name` |
| `position` | `text` | yes | The person's role, when known |
| `linkedin` | `text` | yes | Hunter `linkedin` — the person's profile URL, when it has one |
| `confidence` | `integer` | no | 0–100 deliverability score |
| `type` | `text` | no | `'personal'` or `'generic'`, default `'personal'` |
| `created_at` / `updated_at` | `TIMESTAMP` | no | |

**Plus a unique index** — `UQ_contacts_job_email` on `("jobId", email)`. It's the only index in the schema beyond the primary keys, and it's what makes repeat lookups safe.

### Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/contacts` | `CreateContactDto` | `201` — **an array**: every contact on the job, most reachable first |
| `GET` | `/contacts` | — | `200` — all contacts |
| `GET` | `/contacts/by-job/:jobId` | — | `200` — the job's contacts, most reachable first; **`[]` when there are none** |
| `GET` | `/contacts/:id` | — | `200` · `404` |
| `PATCH` | `/contacts/:id` | `UpdateContactDto` | `200` · `404` |
| `DELETE` | `/contacts/:id` | — | `204` · `404` |

**`CreateContactDto`** is a *lookup request*, not a row: `jobId` and `companyPageUrl` required, `limit` (1–100, default 10) optional. **`UpdateContactDto`** is the row shape — `email`, `firstName`, `lastName`, `position`, `linkedin`, `confidence`, `type`, all optional. `jobId` isn't editable: a contact belongs to the job it was found for.

### How rows get written

`ContactsService.create()` reduces the URL to a bare domain, runs a `personal`-only Hunter domain search, and hands the batch to `createMany()`, which **upserts** on `("jobId", email)` — a second lookup refreshes titles, LinkedIn URLs, and confidence scores and adds anyone new instead of duplicating or failing. It returns every contact on the job, `confidence DESC`.

`linkedin` was only added to the write path in [`1784468600000-ContactsLinkedIn`](../api/src/database/migrations/1784468600000-ContactsLinkedIn.ts). Hunter has always returned the field — the `HunterEmail` type simply didn't declare it, so it was dropped on parse. **Rows saved before that migration stay blank until their job's lookup is re-run**; they don't backfill.

---

## `examples` — the template

A dummy entity kept as a copy-me reference for the folder shape (entity / dto / repository / service / controller / module). Columns: `id`, `name` (`text`), `description` (`text`, nullable), timestamps.

**Its table exists and is seeded, but its endpoints are not reachable.** `ExampleModule` is imported into [app.module.ts](../api/src/app.module.ts) but never added to the `imports` array — so `ExampleController` is never mounted and `/examples` 404s. (That dangling import is also the one lint error in the file.) Add `ExampleModule` to `imports` if you ever want the routes live.

---

## Every endpoint, in one table

| Method | Path | Success | Notes |
| --- | --- | --- | --- |
| `GET` | `/health` | `200` | Liveness check |
| `GET` | `/` | `200` | Swagger UI |
| `GET` | `/jobs` | `200` | |
| `POST` | `/jobs` | `201` | |
| `GET` | `/jobs/:id` | `200` | |
| `PATCH` | `/jobs/:id` | `200` | |
| `DELETE` | `/jobs/:id` | `204` | |
| `GET` | `/company-research` | `200` | |
| `POST` | `/company-research` | `201` | Calls Perplexity ×2 |
| `GET` | `/company-research/by-job/:jobId` | `200` | Newest row, or `null` |
| `GET` | `/company-research/:id` | `200` | |
| `DELETE` | `/company-research/:id` | `204` | |
| `GET` | `/generated-content` | `200` | |
| `POST` | `/generated-content` | `201` | Calls Claude ×3 + renders a PDF |
| `GET` | `/generated-content/by-job/:jobId` | `200` | Newest run, or `null` |
| `GET` | `/generated-content/:id` | `200` | |
| `PATCH` | `/generated-content/:id` | `200` | See gap below |
| `DELETE` | `/generated-content/:id` | `204` | |
| `GET` | `/contacts` | `200` | |
| `POST` | `/contacts` | `201` | Calls Hunter; returns an array |
| `GET` | `/contacts/by-job/:jobId` | `200` | The job's contacts, or `[]` |
| `GET` | `/contacts/:id` | `200` | |
| `PATCH` | `/contacts/:id` | `200` | |
| `DELETE` | `/contacts/:id` | `204` | |

Every `:id` route returns `404` when the row doesn't exist. Every endpoint that calls an external API can return `503` when that API is busy or unreachable.

### The `by-job` routes never 404

The three `by-job/:jobId` reads answer `200` with `[]` or `null` for a job that has nothing yet — they do **not** 404. "No research yet" is the *normal* state of a job you just added, not an exceptional one, so absence is data. (`POST /generated-content` still 404s on missing research, because there it genuinely is a precondition failure — a read is different.) That gives the frontend one trivially correct rule: **any non-`ok` response is a real error**, with no 404-as-absence special case per endpoint.

Two things this rests on:

- **The service must return `null`, never `undefined`.** Fastify treats an `undefined` payload as an empty body, and the browser's `res.json()` then throws `Unexpected end of JSON input`. TypeORM's `findOne` returns `null`, so the natural code is safe — but don't write `?? undefined`, and don't swap in `Array.prototype.find`.
- **Don't rename these to `/contacts/:jobId/latest`.** find-my-way refuses to register two routes differing only by parameter name and throws **at boot**. `by-job/:jobId` is three static-prefixed segments and shares no router node with `:id`, so ordering between them doesn't matter.

They also use `ParseIntPipe` rather than the `+id` coercion the older routes use: `+id` on a non-numeric param yields `NaN` and a confusing 404/500 instead of a clean 400.

### CORS

The web app is served from `:4000` and the API from `:4001`, so [main.ts](../api/src/main.ts) calls `app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:4000', credentials: false })` before `listen()` — after which Fastify freezes plugin registration. `@fastify/cors` ships as a direct dependency of `@nestjs/platform-fastify`, so this needs no install and no import. Without it **every browser request fails**.

### How the modules wire up

Four feature modules are registered in `AppModule`. `JobsModule` is one of them **explicitly** — it used to be reachable only as a side effect of `GeneratedContentModule` importing it for `JobsService` (the company-name fallback), which is too fragile now that the frontend reads `/jobs` directly:

```
AppModule
├── AppController                 → /health, /
├── CompanyResearchModule         → /company-research
│   └── PerplexityModule
├── GeneratedContentModule        → /generated-content
│   ├── ClaudeModule
│   ├── CompanyResearchModule (reused)
│   ├── ResumePdfModule
│   └── JobsModule (reused)
├── ContactsModule                → /contacts
│   └── HunterModule
└── JobsModule                    → /jobs
```

The three external-API modules are deliberately **not** app-wide: each needs its API key the moment it loads, so the app can boot without keys until a feature actually uses one.

---

## Known gaps and gotchas

- **`PATCH /generated-content/:id` returns `500` for most bodies.** `UpdateGeneratedContentDto` is `PartialType(CreateGeneratedContentDto)`, so it accepts `jobPosting`, `companyWebsite`, and `companyName` — none of which are columns on the entity. TypeORM throws `EntityPropertyNotFoundError` for any non-column property in an update, which `BaseRepository` turns into a generic 500. Only `jobId` happens to work. The fix is what `contacts` already does: write the update DTO against the row's own fields (`outreachMessage`, `followupMessage`, …) instead of deriving it from the create DTO.
- **No foreign keys anywhere.** `jobId` is a bare integer, so nothing stops a row pointing at a job that doesn't exist, and `DELETE /jobs/:id` leaves its research, content, and contacts behind as orphans. Cleanup is manual today.
- **`company_research` and `generated_content` allow unlimited rows per job.** Reads that want "the current one" order by `id DESC` and take the newest. `contacts` is the exception — one row per person per job, enforced by the unique index.
- **`generated_content.tailoredResume` is a file path.** The PDF lives on the `resume-storage` Docker volume; the row just points at it. Delete the row and the file stays; wipe the volume and the path dangles.
- **Seeds don't re-run on an already-seeded database.** Each seed is guarded by `count() > 0`, so a dev DB that predates the date columns keeps whatever `CURRENT_DATE` backfilled rather than picking up the dates written into [jobs.seed.ts](../api/src/database/seeds/jobs.seed.ts). Harmless — they're valid dates — but `docker compose -f infra/docker-compose.dev.yml down -v` is what gets you the fixtures exactly as written.
- **No authentication on any endpoint.** Everything is open — fine for local development, not for anything public.
- **Reads have no pagination or filtering.** `GET /contacts` returns every contact for every job. Fine at seed scale; add a `?jobId=` filter before it isn't.
