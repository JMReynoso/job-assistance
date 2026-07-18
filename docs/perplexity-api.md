# Using the Perplexity Sonar API (deep research)

This guide explains how the app does **company research** using **Perplexity Sonar** — what it is, how to call it from your code, and how to read what comes back. It assumes you've never used a research API before.

Docs (official): <https://docs.perplexity.ai/api-reference/chat-completions-post>

---

## What is this, in plain terms?

Perplexity **Sonar** is an AI research agent. Unlike a plain search engine (which just returns links), Sonar **searches the web *and* writes a grounded answer** — and it hands back the **source URLs** it used ("citations").

We use it for **company research**: `research(company)` fans out **three** focused Sonar Pro searches — (1) company / product / funding, (2) engineering culture / stack, (3) recent news / hiring signals — runs them in parallel, then **merges, de-dupes, and ranks** the sources by URL. You get three short reports plus one clean list of sources (the company's about-page appears once, not three times), ready to feed into Claude to draft a resume/outreach.

```
Your controller  →  your service  →  PerplexityService  →  PerplexityClient  →  Perplexity (in the cloud)
                                            ▲
                                this is the only part
                              that knows about Perplexity
```

The important idea: **only [`PerplexityService`](../api/src/perplexity/perplexity.service.ts) knows how to talk to Perplexity.** The rest of the app just calls it — the same way it talks to the database only through repositories, and to Claude only through `ClaudeService`.

---

## The pieces that make it work

| Piece | File | What it is (plain terms) |
| --- | --- | --- |
| **API key** | `PERPLEXITY_API_KEY` (env var) | Your password to Perplexity. Every request includes it. Kept out of the code. |
| **The client provider** | [perplexity.provider.ts](../api/src/perplexity/perplexity.provider.ts) | Builds **one** HTTP client (a thin `fetch` wrapper, since there's no npm SDK) from your API key, in a single place — the same shape as Claude's provider. |
| **PerplexityService** | [perplexity.service.ts](../api/src/perplexity/perplexity.service.ts) | Your friendly wrapper. Has one method: `research(...)`. This is what you call. |
| **PerplexityModule** | [perplexity.module.ts](../api/src/perplexity/perplexity.module.ts) | A NestJS bundle so other parts of the app can use `PerplexityService`. |

You'll spend almost all your time in just one of these: **PerplexityService**.

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

Three steps. Say you have a `JobsService` and you want it to research a company.

**Step 1 — let your feature module use Perplexity.** In your feature's module file, import `PerplexityModule`:

```ts
import { Module } from '@nestjs/common';
import { PerplexityModule } from '../../perplexity/perplexity.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [PerplexityModule], // ← gives the module access to PerplexityService
  providers: [JobsService],
})
export class JobsModule {}
```

**Step 2 — inject `PerplexityService`** into your service, next to your repositories:

```ts
import { Injectable } from '@nestjs/common';
import { PerplexityService } from '../../perplexity/perplexity.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly perplexity: PerplexityService, // ← injected, ready to use
  ) {}
}
```

**Step 3 — call it.** Hand it a research brief, get back a report *and* the source URLs:

```ts
const research = await this.perplexity.research(company, {
  // Anchor the research to official sources — the model verifies against these:
  verifyUrls: [companyUrl, linkedinUrl],
});

research.reports;   // three angle write-ups: [{ angle, content }, ...]
research.sources;   // deduped, ranked sources: [{ title, url, snippet, hits }, ...]
research.urls;      // just the deduped URLs, ranked
research.usage;     // { totalCost, searches, promptTokens, completionTokens }

// Feed Claude the deduped sources once — no page sent three times:
const forClaude = research.sources
  .map((s) => `${s.title} — ${s.url}\n${s.snippet ?? ''}`)
  .join('\n\n');
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

- **`company`** — the company name (e.g. `'Stripe'`). `research()` builds the three angle prompts for you; you don't pass a prompt.
- **`options`** (all optional):

  | Option | Meaning |
  | --- | --- |
  | `model` | Which Sonar model each angle uses. Defaults to `'sonar-pro'`. |
  | `system` | Override the default researcher persona / rules. |
  | `contextSize` | Search depth per angle: `'low'` / `'medium'` / `'high'`. Defaults to `'medium'`. |
  | `verifyUrls` | Official company URLs (site, LinkedIn, …) the model cross-checks its claims against. Broadens grounding **without** restricting the search. |
  | `domains` | Restrict to (or, with a leading `-`, exclude) specific domains, applied to every angle. Max 20. **See the warning below.** |
  | `recency` | Only use pages newer than `'hour'` / `'day'` / `'week'` / `'month'` / `'year'`. |
  | `timeoutMs` | Abort each angle after this many ms. Defaults to **2 minutes**. |

### What you get back

```ts
{
  reports: { angle: string; content: string }[];  // one per angle (distinct)
  sources: {                                       // deduped + ranked across angles
    title: string; url: string; date: string | null;
    last_updated: string | null; snippet?: string;
    hits: number;   // how many angles cited this URL (1–3) — higher ranks first
  }[];
  urls: string[];                                  // the deduped URLs, ranked
  usage: {                                         // summed across the 3 calls
    totalCost: number; searches: number;
    promptTokens: number; completionTokens: number;
  };
}
```

Feed `sources` (or `urls` + `reports`) to Claude. Because sources are deduped by URL, a page cited by all three angles is sent once — with `hits: 3` marking it as central.

---

## Which model to use

| Model | Good for | Speed / cost |
| --- | --- | --- |
| `sonar` | Quick grounded lookups, single facts | Fastest, cheapest |
| `sonar-pro` *(default)* | Solid single-shot company answers with citations | Fast, cheap |
| `sonar-reasoning-pro` | Multi-step analysis (chain-of-thought) | Medium |
| `sonar-deep-research` | Exhaustive, multi-search company reports | **Slow (minutes), priciest** |

The default is **`sonar-pro`** — fast and cheap enough to call many times a day. `research()` already runs three of them (one per angle). Opt into deeper runs only when you need them: `research(company, { model: 'sonar-deep-research' })` (all three angles go deep — ~10× the cost and minutes each).

**A note on how many URLs you get back:** each `sonar-pro` angle cites a **handful** of sources (~5–15); across the three angles you typically end up with **~20–40 unique** URLs after de-duplication. That fan-out is exactly why `research()` makes three calls instead of one.

---

## Steering the research

- **The task is built in.** The three angle prompts already ask Sonar to be specific and cite every claim, so `sources` fills itself — you just pass the company name.
- **Use `system` to tweak the persona/rules.** The default is a "meticulous company researcher" that only states citable facts. Override it via `options.system` if you want a different tone or focus (same system-vs-user split as [claude-api.md](claude-api.md)).
- **To verify against the company's own pages, use `verifyUrls` — not `domains`.** Pass the company site + LinkedIn to `verifyUrls`; the model cross-checks its claims against them and flags discrepancies, while research stays broad:

  ```ts
  await this.perplexity.research('Stripe', {
    verifyUrls: ['https://stripe.com', 'https://www.linkedin.com/company/stripe'],
  });
  ```

  `domains`, by contrast, **restricts** every angle to only those sites (killing breadth) — reserve it for when you truly want a fixed set of sites.
- **`contextSize` controls search depth** (`'low'`/`'medium'`/`'high'`, default `'medium'`). Higher pulls more page content into each answer — better grounding, a slightly higher per-call request fee.

### Getting just a list of URLs

`research()` already returns them, deduped and ranked:

```ts
const { urls } = await this.perplexity.research(company);
```

You can't set an exact count — sparse companies simply yield fewer.

---

## Handling errors

`PerplexityService` maps the common failures to a clean HTTP error so your callers don't have to:

- **One angle fails** → the other two still return; `research()` only throws if **all three** fail. Failed angles are logged as warnings.
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

**Rough cost of researching one company.** `research()` makes **three** Sonar Pro calls (one per angle):

- **Per angle** ≈ **$0.03** — mostly the request fee (~$0.006–$0.014) plus ~1k output tokens (~$0.02).
- **Whole company** ≈ **3 × $0.03 ≈ $0.09**.
- Switching all angles to deep research (`{ model: 'sonar-deep-research' }`) is ≈ 3 × $0.30 ≈ **$0.90** and takes minutes — reserve it for special cases.

**The service logs the real cost, not an estimate.** Perplexity reports the billed amount in `usage.cost.total_cost`; the service sums it into `result.usage.totalCost` and logs each angle plus a combined line:

```
[PerplexityService] Perplexity usage — angle=company-product-funding model=sonar-pro searches=1 prompt=412 completion=1180 cost=$0.0305
[PerplexityService] Perplexity usage — angle=eng-culture-stack model=sonar-pro searches=1 prompt=398 completion=1204 cost=$0.0311
[PerplexityService] Perplexity usage — angle=news-hiring model=sonar-pro searches=1 prompt=405 completion=1150 cost=$0.0298
[PerplexityService] Perplexity company research "Stripe" — angles=3/3 sources=27 cost=$0.0914
```

**Keeping costs sane:** the default (`sonar-pro`) is already the cheap path; **cache results** so you don't re-research the same company, and read `result.usage.totalCost` if you want to track spend per company.

---

## Good to know / gotchas

- **`research()` fires three Sonar calls in parallel.** With the default `sonar-pro` each returns in seconds (the `timeoutMs` guard is 2 min per angle). Switch to `sonar-deep-research` and each angle can take minutes — a user-triggered request tying up a connection that long is fragile, so prefer a background job / Perplexity's **async API** for that case.
- **One slow or failing angle won't sink the rest.** Angles run independently; `research()` returns whatever succeeded and only throws if all three fail (see Handling errors).
- **`PerplexityModule` is deliberately *not* loaded app-wide.** The client provider needs `PERPLEXITY_API_KEY` the moment the module loads, so if it were always on, the app would crash on startup without a key. Instead you add `imports: [PerplexityModule]` only to the feature modules that use it.
- **This returns an AI answer *with* citations** — the model can still be wrong, so keep "cite every claim" in your prompt and treat `content` as a draft, not gospel.
- **Endpoint:** the client calls `/chat/completions` (the OpenAI-compatible alias of Perplexity's canonical `/v1/sonar`).
- **Production gets the key differently.** The prod image has no `api/.env`, so the key comes through the container environment instead. Declare `PERPLEXITY_API_KEY` in your prod compose/deploy config and supply its value at deploy time.

---

## File map

| Path | What it is |
| --- | --- |
| [api/src/perplexity/perplexity.provider.ts](../api/src/perplexity/perplexity.provider.ts) | Builds the Perplexity HTTP client from the API key (token + `fetch` wrapper) |
| [api/src/perplexity/perplexity.service.ts](../api/src/perplexity/perplexity.service.ts) | The wrapper you call (`PerplexityService`) — add methods here |
| [api/src/perplexity/perplexity.module.ts](../api/src/perplexity/perplexity.module.ts) | The NestJS module to import into your feature modules |
| [api/.env](../api/.env) | Your local config, including `PERPLEXITY_API_KEY` (not committed to git) |
| [api/.env.example](../api/.env.example) | Template listing the env vars the api needs |
