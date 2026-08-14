# Using the Perplexity Sonar API (company research)

This guide explains how the app does **company research** using **Perplexity Sonar** — what it is, what it's used for here, how to read what comes back, and how it ends up in Postgres. It assumes you've never used a research API before.

Docs (official): <https://docs.perplexity.ai/api-reference/chat-completions-post>

---

## What is this, in plain terms?

Perplexity **Sonar** is an AI research agent. Unlike a plain search engine (which just returns links), Sonar **searches the web *and* writes a grounded answer** — and it hands back the **source URLs** it used ("citations").

We use it for **company research**: `research(company)` fans out **two** focused Sonar Pro searches — (1) company / product / funding and (2) engineering culture / stack — runs them in parallel, then **merges, de-dupes, and ranks** the sources by URL. You get one combined summary plus one clean list of sources (the company's about-page appears once, not twice), ready to feed into Claude.

```
CompanyResearchService  →  PerplexityService  →  PerplexityClient  →  Perplexity (in the cloud)
         │                        ▲
         │            this is the only part
         │           that knows about Perplexity
         ▼
CompanyResearchRepository  →  Postgres (company_research)
```

The important idea: **only [`PerplexityService`](../api/src/externalAPIs/perplexity/perplexity.service.ts) knows how to talk to Perplexity.** The rest of the app just calls it — the same way it talks to the database only through repositories, and to Claude only through `ClaudeService`.

---

## What it's used for, and which entity it feeds

| | |
| --- | --- |
| **Used for** | Learning about a company before applying — what it does, how it makes money, what its engineers use and write about |
| **Entity** | [`CompanyResearch`](../api/src/entities/companyResearch/entities/company-research.entity.ts) |
| **Table** | `company_research` |
| **Called from** | [`CompanyResearchService.create()`](../api/src/entities/companyResearch/company-research.service.ts) |
| **Endpoint** | `POST /company-research` |
| **Who consumes the result** | Claude — the stored `summary` is the entire input to the outreach, follow-up, and resume prompts (see [claude-api.md](claude-api.md)) |

This is the **first** step in the chain: research a company, then generate content from that research. `POST /generated-content` 404s if no research exists for the job yet. See [data-model.md](data-model.md) for every table and endpoint in one place.

---

## The pieces that make it work

| Piece | File | What it is (plain terms) |
| --- | --- | --- |
| **API key** | `PERPLEXITY_API_KEY` (env var) | Your password to Perplexity. Every request includes it. Kept out of the code. |
| **The client provider** | [perplexity.provider.ts](../api/src/externalAPIs/perplexity/perplexity.provider.ts) | Builds **one** HTTP client (a thin `fetch` wrapper, since there's no npm SDK) from your API key, in a single place — the same shape as Claude's provider. |
| **PerplexityService** | [perplexity.service.ts](../api/src/externalAPIs/perplexity/perplexity.service.ts) | Your friendly wrapper. Has one method: `research(...)`. This is what you call. |
| **The tuning constants** | [perplexity.constants.ts](../api/src/externalAPIs/perplexity/perplexity.constants.ts) | The two research angles, the researcher persona, and the default caps. |
| **The types** | [perplexity.types.ts](../api/src/externalAPIs/perplexity/perplexity.types.ts) | The result/option shapes plus the raw Sonar request/response shapes. |
| **PerplexityModule** | [perplexity.module.ts](../api/src/externalAPIs/perplexity/perplexity.module.ts) | A NestJS bundle so other parts of the app can use `PerplexityService`. |

You'll spend almost all your time in just two of these: **PerplexityService** and **perplexity.constants.ts**.

---

## One-time setup: get and set your API key

1. **Get a key.** Log in to Perplexity and open [API settings](https://www.perplexity.ai/settings/api). Create a key and add a little billing credit (the API is pay-as-you-go). Treat the key like a password.

2. **Give it to the app.** Open `api/.env` (if it doesn't exist, copy it from [api/.env.example](../api/.env.example)). This file is **not** committed to git. Fill in your key:

   ```bash
   PERPLEXITY_API_KEY=pplx-your-key-here
   ```

   NestJS's `ConfigModule` loads `api/.env` automatically, so the client provider can read the key from it.

3. **Restart the api** so it picks up the new value:

   ```bash
   docker compose -f infra/docker-compose.dev.yml restart api
   ```

> **You don't need a key just to run the app.** Perplexity is only contacted when a feature actually uses it (see the note about `PerplexityModule` at the bottom), so the app boots fine without a key until you start researching.

---

## How to use it in the service layer

Three steps — this is exactly what [`CompanyResearchModule`](../api/src/entities/companyResearch/company-research.module.ts) does.

**Step 1 — let your feature module use Perplexity.** In your feature's module file, import `PerplexityModule`:

```ts
import { Module } from '@nestjs/common';
import { PerplexityModule } from '../../externalAPIs/perplexity/perplexity.module';
import { CompanyResearchService } from './company-research.service';

@Module({
  imports: [PerplexityModule], // ← gives the module access to PerplexityService
  providers: [CompanyResearchService],
})
export class CompanyResearchModule {}
```

**Step 2 — inject `PerplexityService`** into your service, next to your repositories:

```ts
import { Injectable } from '@nestjs/common';
import { PerplexityService } from '../../externalAPIs/perplexity/perplexity.service';

@Injectable()
export class CompanyResearchService {
  constructor(
    private readonly companyResearchRepository: CompanyResearchRepository,
    private readonly perplexityService: PerplexityService, // ← injected, ready to use
  ) {}
}
```

**Step 3 — call it.** Hand it a company name, get back a summary *and* the source URLs:

```ts
const research = await this.perplexityService.research(company, {
  // Anchor the research to official sources — the model verifies against these:
  verifyUrls: [jobPostingUrl, companyPageUrl, companyLinkedInUrl],
});

research.summary; // both angles' 5-bullet reports, combined into one string
research.urls;    // deduped source URLs, in ranked order
research.usage;   // { totalCost, searches, promptTokens, completionTokens }
```

That's it. Your service never touches `fetch` or the Perplexity URL — it just asks `PerplexityService`.

---

## The `research(...)` method

```ts
research(
  company: string,
  options?: CompanyResearchOptions,
): Promise<CompanyResearchResult>
```

- **`company`** — the company name (e.g. `'Stripe'`). `research()` builds the two angle prompts for you; you don't pass a prompt.
- **`options`** (all optional):

  | Option | Meaning |
  | --- | --- |
  | `model` | Which Sonar model each angle uses. Defaults to `'sonar-pro'`. |
  | `system` | Override the default researcher persona / rules. |
  | `contextSize` | Search depth per angle: `'low'` / `'medium'` / `'high'`. Defaults to `'medium'`. |
  | `verifyUrls` | Official company URLs (site, LinkedIn, …) the model cross-checks its claims against. Broadens grounding **without** restricting the search. De-duped before use, and always present in the output. |
  | `domains` | Restrict to (or, with a leading `-`, exclude) specific domains, applied to every angle. Max 20. **See the warning below.** |
  | `recency` | Only use pages newer than `'hour'` / `'day'` / `'week'` / `'month'` / `'year'`. |
  | `maxSourcesPerAngle` | Keep at most this many sources from **each** angle (they arrive ranked, so it's the top-N). Defaults to **10**. |
  | `maxTokens` | Hard ceiling on each angle's summary length, in completion tokens. Defaults to **1500**. |
  | `timeoutMs` | Abort each angle after this many ms. Defaults to **2 minutes**. |

---

## From API response to database row

### 1. What the API actually returns

Each angle is one POST to `chat/completions`, and comes back in OpenAI-compatible shape — the answer buried in `choices`, the citations in a separate `search_results` array:

```jsonc
{
  "id": "...",
  "model": "sonar-pro",
  "choices": [
    { "index": 0, "finish_reason": "stop",
      "message": { "role": "assistant", "content": "- Acme builds developer tooling...\n- Raised a $20M Series A..." } }
  ],
  "search_results": [
    { "title": "About Acme", "url": "https://acme.com/about", "date": "2025-03-01", "last_updated": null, "snippet": "..." }
  ],
  "usage": {
    "prompt_tokens": 412, "completion_tokens": 1180, "total_tokens": 1592,
    "num_search_queries": 1,
    "cost": { "input_tokens_cost": 0.0012, "output_tokens_cost": 0.0177, "request_cost": 0.006, "total_cost": 0.0305 }
  }
}
```

Note the two useful bits: **`usage.cost.total_cost` is the real billed amount** (Perplexity does the math for you — no rate table needed on our side), and `search_results` is already ranked by relevance.

### 2. How we parse it

Four steps, all inside `PerplexityService`:

**a. Pull out the text and the sources** per angle — with defaults, because either can be missing:

```ts
content: data.choices[0]?.message?.content ?? '',
sources: (data.search_results ?? []).slice(0, cap),   // cap = maxSourcesPerAngle, default 10
```

**b. Merge the sources across angles.** `mergeSources()` de-dupes on a **normalized key** — fragment dropped, trailing slash dropped, lowercased — so `/about`, `/about/`, and `/about#team` collapse into one entry. Each survivor tracks `hits` (how many angles cited it) and the best position any angle gave it, then the list is sorted by hits first, position second. Your `verifyUrls` get folded in too: cited ones are flagged `verified`, uncited ones are appended with `hits: 0` so a trusted anchor is never missing.

**c. Combine the summaries** in angle order, dropping empty ones, joined by `SUMMARY_ANGLE_SEPARATOR` (four newlines, ten dashes, four newlines) so the two reports stay visually distinct in one text column.

**d. Add up the usage** across angles — `totalCost`, `searches`, `promptTokens`, `completionTokens`.

The result is deliberately small:

```ts
interface CompanyResearchResult {
  summary: string;   // both angles' bullets, separated by the rule
  urls: string[];    // deduped source URLs, ranked
  usage: { totalCost: number; searches: number; promptTokens: number; completionTokens: number };
}
```

> **The ranking survives, but the ranking *data* doesn't.** `hits`, `verified`, `snippet`, and titles are computed during the merge and then thrown away — only the URL strings come out, in ranked order. If you ever want "this page was cited by both angles" in the UI, `RankedSource` is where to start.

**If an angle fails, the other still returns.** Angles run under `Promise.allSettled`; a failure is logged as a warning and `research()` only throws when **both** fail.

### 3. How it gets stored

[`CompanyResearchService.create()`](../api/src/entities/companyResearch/company-research.service.ts) collects the URLs from the request (job posting, company page, LinkedIn, plus any extras), trims and filters them, and passes them as `verifyUrls`. The repository then writes the row by spreading the result straight onto the entity:

```ts
const newCompanyResearch = this.repository.create({
    jobId: dto.jobId,
    company: dto.companyName,
    ...perplexityResearch,   // summary, urls, usage — the column names match the result shape
});
```

That spread is the whole point of keeping `CompanyResearchResult` small: the entity's columns are **defined against the service's return type**, so a change to one is a compile error in the other.

| Column | Type | Comes from |
| --- | --- | --- |
| `jobId` | `integer` | the request |
| `company` | `text` | `dto.companyName` |
| `summary` | `text` | both angles' bullets joined by the separator |
| `urls` | `jsonb` | the deduped, ranked URL list |
| `usage` | `jsonb` | `{ totalCost, searches, promptTokens, completionTokens }` |
| `created_at` / `updated_at` | `timestamp` | TypeORM |

> **A job can be researched more than once.** Nothing stops a second `POST /company-research` for the same `jobId` — you get a second row. That's why `findByJobId()` orders by `id DESC` and takes the newest; the older rows stay as history.

---

## Which model to use

| Model | Good for | Speed / cost |
| --- | --- | --- |
| `sonar` | Quick grounded lookups, single facts | Fastest, cheapest |
| `sonar-pro` *(default)* | Solid single-shot company answers with citations | Fast, cheap |
| `sonar-reasoning-pro` | Multi-step analysis (chain-of-thought) | Medium |
| `sonar-deep-research` | Exhaustive, multi-search company reports | **Slow (minutes), priciest** |

The default is **`sonar-pro`** — fast and cheap enough to call many times a day. `research()` already runs two of them (one per angle). Opt into deeper runs only when you need them: `research(company, { model: 'sonar-deep-research' })` (both angles go deep — ~10× the cost and minutes each).

**A note on how many URLs you get back:** each `sonar-pro` angle cites a handful of sources, capped at `maxSourcesPerAngle` (10 by default); across the two angles you typically end up with **~10–20 unique** URLs after de-duplication.

---

## Steering the research

- **The task is built in.** The two angle prompts already ask Sonar to be specific and cite every claim, so the sources fill themselves — you just pass the company name.
- **Use `system` to tweak the persona/rules.** The default is a "meticulous company researcher" that only states citable facts. Override it via `options.system` if you want a different tone or focus (same system-vs-user split as [claude-api.md](claude-api.md)).
- **To verify against the company's own pages, use `verifyUrls` — not `domains`.** Pass the company site + LinkedIn to `verifyUrls`; the model cross-checks its claims against them and flags discrepancies, while research stays broad:

  ```ts
  await this.perplexityService.research('Stripe', {
    verifyUrls: ['https://stripe.com', 'https://www.linkedin.com/company/stripe'],
  });
  ```

  `domains`, by contrast, **restricts** every angle to only those sites (killing breadth) — reserve it for when you truly want a fixed set of sites.
- **`contextSize` controls search depth** (`'low'`/`'medium'`/`'high'`, default `'medium'`). Higher pulls more page content into each answer — better grounding, a slightly higher per-call request fee.
- **Want a third angle?** Add it to `RESEARCH_ANGLES` in [perplexity.constants.ts](../api/src/externalAPIs/perplexity/perplexity.constants.ts) — one `{ label, focus }` entry. Everything else (parallel fan-out, merging, the separator, cost aggregation) adapts automatically. Note it also adds a call's worth of cost per research run.

---

## Handling errors

`PerplexityService` maps the common failures to a clean HTTP error so your callers don't have to:

- **One angle fails** → the other still returns; `research()` only throws if **both** fail. Failed angles are logged as warnings.
- **Too many requests (HTTP 429)** → `ServiceUnavailableException` ("Research service is busy…").
- **Timeout** (an angle ran past `timeoutMs`) → `ServiceUnavailableException` ("Research is taking too long…").
- **Network failure / any non-OK response** → `ServiceUnavailableException` with a logged reason.
- **Missing key** → the client provider throws the moment its module loads (fail fast), not mid-request.

---

## Cost

Perplexity bills **per token _plus_ extra fees**, and the extras differ by model. Current rates:

| | Sonar Pro | Sonar Deep Research |
| --- | --- | --- |
| Input tokens | $3 / 1M | $2 / 1M |
| Output tokens | $15 / 1M | $8 / 1M |
| Reasoning tokens | — | $3 / 1M |
| Citation tokens | — | $2 / 1M |
| Search queries | — | $5 / 1,000 searches |
| Request fee | $6 / $10 / $14 per 1,000 (low/med/high context) | — |

**Rough cost of researching one company.** `research()` makes **two** Sonar Pro calls (one per angle):

- **Per angle** ≈ **$0.03** — mostly the request fee (~$0.006–$0.014) plus ~1k output tokens (~$0.02).
- **Whole company** ≈ **2 × $0.03 ≈ $0.06**.
- Switching both angles to deep research (`{ model: 'sonar-deep-research' }`) is ≈ 2 × $0.30 ≈ **$0.60** and takes minutes — reserve it for special cases.

**The service logs the real cost, not an estimate.** Perplexity reports the billed amount in `usage.cost.total_cost`; the service sums it into `result.usage.totalCost` and logs each angle plus a combined line:

```
[PerplexityService] Perplexity usage — angle=company-product-funding model=sonar-pro searches=1 prompt=412 completion=1180 cost=$0.0305
[PerplexityService] Perplexity usage — angle=eng-culture-stack model=sonar-pro searches=1 prompt=398 completion=1204 cost=$0.0311
[PerplexityService] Perplexity company research "Stripe" — angles=2/2 sources=18 cost=$0.0616
```

**Keeping costs sane:** the default (`sonar-pro`) is already the cheap path; **reuse the stored row** instead of re-researching a company you've already looked at, and read `usage.totalCost` off `company_research` to track spend per job.

---

## Good to know / gotchas

- **`research()` fires two Sonar calls in parallel.** With the default `sonar-pro` each returns in seconds (the `timeoutMs` guard is 2 min per angle). Switch to `sonar-deep-research` and each angle can take minutes — a user-triggered request tying up a connection that long is fragile, so prefer a background job / Perplexity's **async API** for that case.
- **One slow or failing angle won't sink the rest.** Angles run independently; `research()` returns whatever succeeded and only throws if both fail (see Handling errors).
- **`PerplexityModule` is deliberately *not* loaded app-wide.** The client provider needs `PERPLEXITY_API_KEY` the moment the module loads, so if it were always on, the app would crash on startup without a key. Instead you add `imports: [PerplexityModule]` only to the feature modules that use it.
- **This returns an AI answer *with* citations** — the model can still be wrong, so keep "cite every claim" in your prompt and treat the summary as a draft, not gospel. Everything Claude later writes is built on it.
- **The `summary` column is one big text blob, by design.** It was originally two columns (`reports` and `sources`); the [CompanyResearchSummaryColumn migration](../api/src/database/migrations/1784468000000-CompanyResearchSummaryColumn.ts) collapsed them because the drafting prompts want one string, not structured angles.
- **Endpoint:** the client calls `/chat/completions` (the OpenAI-compatible alias of Perplexity's canonical `/v1/sonar`).
- **Production gets the key differently.** The prod image has no `api/.env`, so the key comes through the container environment instead. Declare `PERPLEXITY_API_KEY` in your prod compose/deploy config and supply its value at deploy time.

---

## File map

| Path | What it is |
| --- | --- |
| [api/src/externalAPIs/perplexity/perplexity.provider.ts](../api/src/externalAPIs/perplexity/perplexity.provider.ts) | Builds the Perplexity HTTP client from the API key (token + `fetch` wrapper) |
| [api/src/externalAPIs/perplexity/perplexity.service.ts](../api/src/externalAPIs/perplexity/perplexity.service.ts) | The wrapper you call (`PerplexityService`) — add methods here |
| [api/src/externalAPIs/perplexity/perplexity.constants.ts](../api/src/externalAPIs/perplexity/perplexity.constants.ts) | The research angles, researcher persona, and default caps |
| [api/src/externalAPIs/perplexity/perplexity.types.ts](../api/src/externalAPIs/perplexity/perplexity.types.ts) | Result/option shapes plus the raw Sonar response shape |
| [api/src/externalAPIs/perplexity/perplexity.module.ts](../api/src/externalAPIs/perplexity/perplexity.module.ts) | The NestJS module to import into your feature modules |
| [api/src/entities/companyResearch/](../api/src/entities/companyResearch/) | The entity that consumes it — service, repository, entity |
| [api/.env](../api/.env) | Your local config, including `PERPLEXITY_API_KEY` (not committed to git) |
| [api/.env.example](../api/.env.example) | Template listing the env vars the api needs |
