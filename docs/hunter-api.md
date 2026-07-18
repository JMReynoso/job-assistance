# Using the Hunter.io API

This guide explains how the app finds **contact email addresses** using **Hunter.io** — what it is, how to call it from your code, and how to read what comes back. It assumes you've never used a contact-lookup API before.

Docs (official): <https://hunter.io/api-documentation/v2>

---

## What is this, in plain terms?

Hunter.io finds **work email addresses**. Give it a company's website domain (like `stripe.com`) and it returns the email addresses it has found published on the web — often with the person's name and job title. You can also ask it to guess **one specific person's** email from their name + company.

We use it to find **recruiters and hiring managers** to reach out to after researching a company.

```
Your controller  →  your service  →  HunterService  →  Hunter.io (in the cloud)
                                          ▲
                              this is the only part
                              that knows about Hunter
```

The important idea: **only [`HunterService`](../api/src/hunter/hunter.service.ts) knows how to talk to Hunter.** The rest of the app just calls it — the same way it talks to the database only through repositories.

---

## The pieces that make it work

| Piece | File | What it is (plain terms) |
| --- | --- | --- |
| **API key** | `HUNTER_API_KEY` (env var) | Your password to Hunter. Every request includes it. Kept out of the code. |
| **`fetch`** | built into Node | Makes the actual internet call. No extra library needed. |
| **HunterService** | [hunter.service.ts](../api/src/hunter/hunter.service.ts) | Your friendly wrapper. Has two methods: `domainSearch(...)` and `findEmail(...)`. |
| **HunterModule** | [hunter.module.ts](../api/src/hunter/hunter.module.ts) | A NestJS bundle so other parts of the app can use `HunterService`. |

You'll spend almost all your time in just one of these: **HunterService**.

---

## One-time setup: get and set your API key

1. **Get a key.** Sign up at [hunter.io](https://hunter.io) and open [API keys](https://hunter.io/api-keys). Copy your key. (The free plan includes a monthly search allowance.) Treat the key like a password.

2. **Give it to the app.** Open `api/.env` (if it doesn't exist, copy it from [api/.env.example](../api/.env.example)). This file is **not** committed to git. Fill in your key:

   ```bash
   HUNTER_API_KEY=your-key-here
   ```

   NestJS's `ConfigModule` loads `api/.env` automatically, so `HunterService` can read the key from it.

3. **Restart the api** so it picks up the new value:

   ```bash
   docker compose -f infra/docker-compose.dev.yml restart api
   ```

> **Tip:** Hunter provides a special key, `test-api-key`, for trying the endpoints out without spending real credits. Handy while wiring things up.

> **You don't need a key just to run the app.** Hunter is only contacted when a feature actually uses it (see the note about `HunterModule` at the bottom).

---

## How to use it in the service layer

Three steps. Say you have a `JobsService` and you want it to find contacts at a company.

**Step 1 — let your feature module use Hunter.** In your feature's module file, import `HunterModule`:

```ts
import { Module } from '@nestjs/common';
import { HunterModule } from '../../hunter/hunter.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [HunterModule], // ← gives the module access to HunterService
  providers: [JobsService],
})
export class JobsModule {}
```

**Step 2 — inject `HunterService`** into your service, next to your repositories:

```ts
import { Injectable } from '@nestjs/common';
import { HunterService } from '../../hunter/hunter.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly hunter: HunterService, // ← injected, ready to use
  ) {}
}
```

**Step 3 — call it.** Find emails at a company domain:

```ts
async findRecruiters(companyDomain: string) {
  const result = await this.hunter.domainSearch(companyDomain, {
    department: 'hr',   // aim at recruiting / people teams
    limit: 10,
  });

  return result.emails; // array of { value, first_name, last_name, position, ... }
}
```

That's it. Your service never touches `fetch` or the Hunter URL — it just asks `HunterService`.

---

## The two methods

### 1. `domainSearch(domain, options?)` — "who works here?"

Finds email addresses published for a company domain.

```ts
domainSearch(
  domain: string,
  options?: DomainSearchOptions,
): Promise<HunterDomainSearchResult>
```

- **`domain`** — the company's website domain, e.g. `'stripe.com'`.
- **`options`** (all optional):

  | Option | Meaning |
  | --- | --- |
  | `limit` | How many emails to return, 1–100 (default 10). |
  | `type` | `'personal'` (real people) or `'generic'` (role addresses like `info@`). |
  | `seniority` | `'junior'`, `'senior'`, or `'executive'` (comma-separate to combine). |
  | `department` | e.g. `'executive'`, `'hr'`, `'it'`, `'sales'`. |

  **What you get back:**

  ```ts
  {
    domain: string;
    organization: string | null;       // the company name
    pattern: string | null;            // inferred email format, e.g. "{first}@acme.com"
    emails: [
      {
        value: string;                 // the email address
        type: 'personal' | 'generic';
        confidence: number;            // 0–100, how sure Hunter is it's deliverable
        first_name: string | null;
        last_name: string | null;
        position: string | null;       // job title
      },
    ];
  }
  ```

### 2. `findEmail(domain, name)` — "what's this person's email?"

Guesses (and verifies) the most likely email for one specific person.

```ts
findEmail(
  domain: string,
  name: { fullName?: string; firstName?: string; lastName?: string },
): Promise<HunterEmailFinderResult>
```

- Provide the **`domain`** plus either a `fullName`, or `firstName` + `lastName`:

  ```ts
  await this.hunter.findEmail('stripe.com', { fullName: 'Jane Doe' });
  // or
  await this.hunter.findEmail('stripe.com', { firstName: 'Jane', lastName: 'Doe' });
  ```

  **What you get back:**

  ```ts
  {
    email: string | null;      // null (and no credit charged) if nothing found
    first_name: string | null;
    last_name: string | null;
    score: number | null;      // 0–100 deliverability confidence
    position: string | null;   // job title
    company: string | null;
  }
  ```

---

## Reading the confidence numbers

Both `confidence` (domain search) and `score` (email finder) are **0–100** estimates of how likely the email is real and deliverable. Rough guide:

- **90+** — very likely valid, safe to use.
- **50–89** — probably valid; fine for outreach, expect the occasional bounce.
- **under 50** — shaky; treat as a guess.

---

## Handling errors

Things can go wrong: Hunter might be busy, your key might be missing, or the network might hiccup. `HunterService` maps the common failures to a clean HTTP error:

- **Too many requests (HTTP 429)** → `ServiceUnavailableException` ("Contact lookup service is busy…"). Hunter's limits are 15 requests/second and 500/minute.
- **Network failure / any non-OK response** → `ServiceUnavailableException` with a logged reason.
- **Missing key** → the service throws the moment its module loads (fail fast), not mid-request.

**"No email found" is not an error.** `findEmail` simply returns `email: null` (and Hunter charges no credit). Check for that in your code:

```ts
const found = await this.hunter.findEmail(domain, { fullName });
if (!found.email) {
  // fall back to domainSearch, or skip this contact
}
```

---

## Keeping costs / credits sane

- **Prefer `findEmail` when you already know the name** — it's one targeted lookup and costs nothing when it finds nothing.
- **Use `limit` on `domainSearch`** so you don't pull 100 emails when you need 10.
- **Filter with `department`/`seniority`** to reach the right people in fewer calls.
- **Cache results.** If you already looked up a company, reuse the stored contacts instead of searching again.

---

## Good to know / gotchas

- **`HunterModule` is deliberately *not* loaded app-wide.** The service needs `HUNTER_API_KEY` the moment the module loads, so if it were always on, the app would crash on startup without a key. Instead you add `imports: [HunterModule]` only to the feature modules that use it.
- **The API key never appears in logs.** `HunterService` adds it to the request URL last and never logs the full URL.
- **Respect people's data.** Only use found emails for legitimate, relevant outreach — and follow anti-spam rules (e.g. CAN-SPAM/GDPR) where they apply.
- **Production gets the key differently.** The prod image has no `api/.env`, so the key comes through the container environment instead. Declare `HUNTER_API_KEY` in your prod compose/deploy config and supply its value at deploy time.

---

## File map

| Path | What it is |
| --- | --- |
| [api/src/hunter/hunter.service.ts](../api/src/hunter/hunter.service.ts) | The wrapper you call (`HunterService`) — add methods here |
| [api/src/hunter/hunter.module.ts](../api/src/hunter/hunter.module.ts) | The NestJS module to import into your feature modules |
| [api/.env](../api/.env) | Your local config, including `HUNTER_API_KEY` (not committed to git) |
| [api/.env.example](../api/.env.example) | Template listing the env vars the api needs |
