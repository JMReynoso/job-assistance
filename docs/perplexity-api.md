# Using the Perplexity Search API

This guide explains how the app searches the web using **Perplexity** — what it is, how to call it from your code, and how to read what comes back. It assumes you've never used a search API before.

Docs (official): <https://docs.perplexity.ai/docs/search/quickstart>

---

## What is this, in plain terms?

Perplexity runs a **web search** for you. Your backend sends it a question or phrase ("Stripe company engineering culture"), and it sends back a list of matching web pages — each with a title, a link, and a short snippet of text.

We use it for **company research**: given a company, we search the web, then hand the results (links + snippets) to Claude to summarize.

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
| **PerplexityService** | [perplexity.service.ts](../api/src/perplexity/perplexity.service.ts) | Your friendly wrapper. Has one method: `search(...)`. This is what you call. |
| **PerplexityModule** | [perplexity.module.ts](../api/src/perplexity/perplexity.module.ts) | A NestJS bundle so other parts of the app can use `PerplexityService`. |

You'll spend almost all your time in just one of these: **PerplexityService**.

---

## One-time setup: get and set your API key

1. **Get a key.** Log in to Perplexity and open [API settings](https://www.perplexity.ai/settings/api). Create a key (you'll need to add a little billing credit — the Search API is pay-as-you-go). Treat the key like a password.

2. **Give it to the app.** Open `api/.env` (if it doesn't exist, copy it from [api/.env.example](../api/.env.example)). This file is **not** committed to git. Fill in your key:

   ```bash
   PERPLEXITY_API_KEY=pplx-your-key-here
   ```

   NestJS's `ConfigModule` loads `api/.env` automatically, so `PerplexityService` can read the key from it.

3. **Restart the api** so it picks up the new value:

   ```bash
   docker compose -f infra/docker-compose.dev.yml restart api
   ```

> **You don't need a key just to run the app.** Perplexity is only contacted when a feature actually uses it (see the note about `PerplexityModule` at the bottom), so the app boots fine without a key until you start searching.

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

**Step 3 — call it.** Ask a question, get back a list of results:

```ts
async researchCompany(name: string) {
  const results = await this.perplexity.search(
    `${name} company engineering culture, tech stack, and recent products`,
    { maxResults: 5 },
  );

  // results is an array — each item has a title, url, and snippet
  return results;
}
```

That's it. Your service never touches `fetch` or the Perplexity URL — it just asks `PerplexityService` for results.

---

## The `search(...)` method

```ts
search(
  query: string | string[],
  options?: PerplexitySearchOptions,
): Promise<PerplexitySearchResult[]>
```

- **`query`** — a single phrase, **or** an array of up to 5 phrases to run in one call.
- **`options`** (all optional):

  | Option | Meaning |
  | --- | --- |
  | `maxResults` | How many results to return, 1–20 (default 10). |
  | `country` | Two-letter country code to bias results, e.g. `'US'`. |
  | `domains` | Only search these domains (max 20). Prefix one with `-` to *exclude* it, e.g. `['-pinterest.com']`. |
  | `contextSize` | How much of each page it reads: `'low'`, `'medium'`, or `'high'` (default `'high'`). Higher = better snippets, slightly more cost. |

### What you get back

An array of results, each shaped like this:

```ts
{
  title: string;         // the page's title
  url: string;           // link to the page
  snippet: string;       // a short extract of the relevant text
  date: string | null;         // when it was published (YYYY-MM-DD), if known
  last_updated: string | null; // when it was last updated, if known
}
```

The most relevant result comes first. For company research you'll usually feed the `snippet` + `url` fields into Claude.

---

## Writing good queries

- **Be specific.** `"Stripe payments company culture and tech stack"` beats `"Stripe"`.
- **Batch related questions.** Pass an array of up to 5 queries in one call instead of looping — it's one request:

  ```ts
  await this.perplexity.search([
    `${company} mission statement`,
    `${company} tech stack`,
    `${company} recent product launches`,
  ]);
  ```

- **Narrow with `domains`** when you trust a source (e.g. a company's own site) or want to avoid junk.

---

## Handling errors

Things can go wrong: Perplexity might be busy, your key might be missing, or the network might hiccup. `PerplexityService` maps the common failures to a clean HTTP error so your callers don't have to:

- **Too many requests (HTTP 429)** → `ServiceUnavailableException` ("Search service is busy, please try again shortly").
- **Network failure / any non-OK response** → `ServiceUnavailableException` with a logged reason.
- **Missing key** → the service throws the moment its module loads (fail fast), not mid-request.

If you need to react differently (e.g. return an empty list instead of erroring), catch the exception in your service.

---

## Keeping costs sane

- **Ask for only what you need.** `maxResults: 5` is plenty for a summary; you pay more for more results and higher `contextSize`.
- **Batch queries** (the array form) instead of many separate calls.
- **Cache repeated research.** If you research the same company twice, store the result rather than searching again.

---

## Good to know / gotchas

- **`PerplexityModule` is deliberately *not* loaded app-wide.** The client provider needs `PERPLEXITY_API_KEY` the moment the module loads, so if it were always on, the app would crash on startup without a key. Instead you add `imports: [PerplexityModule]` only to the feature modules that use it.
- **This is search, not chat.** It returns links and snippets, **not** a written answer. To turn results into prose (a summary, an outreach message), pass them to `ClaudeService`.
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
