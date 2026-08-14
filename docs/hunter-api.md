# Using the Hunter.io API

This guide explains how the app finds **contact email addresses** using **Hunter.io** — what it is, what it's used for here, how to read what comes back, and how it ends up in Postgres. It assumes you've never used a contact-lookup API before.

Docs (official): <https://hunter.io/api-documentation/v2>

---

## What is this, in plain terms?

Hunter.io finds **work email addresses**. Give it a company's website domain (like `stripe.com`) and it returns the email addresses it has found published on the web — often with the person's name and job title. You can also ask it to guess **one specific person's** email from their name + company.

We use it to find **recruiters and hiring managers** to reach out to after researching a company.

```
ContactsService  →  HunterService  →  HunterClient  →  Hunter.io (in the cloud)
      │                   ▲
      │       this is the only part
      │        that knows about Hunter
      ▼
ContactsRepository  →  Postgres (contacts)
```

The important idea: **only [`HunterService`](../api/src/externalAPIs/hunter/hunter.service.ts) knows how to talk to Hunter.** The rest of the app just calls it — the same way it talks to the database only through repositories.

---

## What it's used for, and which entity it feeds

| | |
| --- | --- |
| **Used for** | Finding the people to send the outreach message to — recruiters, hiring managers, engineers at the company |
| **Entity** | [`Contact`](../api/src/entities/contacts/entities/contact.entity.ts) |
| **Table** | `contacts` |
| **Called from** | [`ContactsService.create()`](../api/src/entities/contacts/contacts.service.ts) |
| **Endpoint** | `POST /contacts` |
| **What it needs** | A `jobId` and the company's website URL — nothing from the other two APIs |

Unlike the research → generate chain, contact lookup is **independent**: it doesn't need company research to exist first, and nothing downstream consumes the rows yet. Claude drafts the message; Hunter finds who to send it to; joining the two is still a manual step. See [data-model.md](data-model.md) for every table and endpoint in one place.

---

## The pieces that make it work

| Piece | File | What it is (plain terms) |
| --- | --- | --- |
| **API key** | `HUNTER_API_KEY` (env var) | Your password to Hunter. Every request includes it. Kept out of the code. |
| **The client provider** | [hunter.provider.ts](../api/src/externalAPIs/hunter/hunter.provider.ts) | Builds **one** HTTP client (a thin `fetch` wrapper, since there's no npm SDK) from your API key, in a single place — the same shape as Claude's provider. |
| **HunterService** | [hunter.service.ts](../api/src/externalAPIs/hunter/hunter.service.ts) | Your friendly wrapper. Has two methods: `domainSearch(...)` and `findEmail(...)`. |
| **HunterModule** | [hunter.module.ts](../api/src/externalAPIs/hunter/hunter.module.ts) | A NestJS bundle so other parts of the app can use `HunterService`. |

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

> **Tip:** Hunter provides a special key, `test-api-key`, for trying the endpoints out without spending real credits. Handy while wiring things up — it returns fixture data (Richard Hendricks at Pied Piper) for any domain you ask about.

> **You don't need a key just to run the app.** Hunter is only contacted when a feature actually uses it (see the note about `HunterModule` at the bottom).

---

## How to use it in the service layer

Three steps — this is exactly what [`ContactsModule`](../api/src/entities/contacts/contacts.module.ts) does.

**Step 1 — let your feature module use Hunter.** In your feature's module file, import `HunterModule`:

```ts
import { Module } from '@nestjs/common';
import { HunterModule } from '../../externalAPIs/hunter/hunter.module';
import { ContactsService } from './contacts.service';

@Module({
  imports: [HunterModule], // ← gives the module access to HunterService
  providers: [ContactsService],
})
export class ContactsModule {}
```

**Step 2 — inject `HunterService`** into your service, next to your repositories:

```ts
import { Injectable } from '@nestjs/common';
import { HunterService } from '../../externalAPIs/hunter/hunter.service';

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepository: ContactsRepository,
    private readonly hunterService: HunterService, // ← injected, ready to use
  ) {}
}
```

**Step 3 — call it.** Find emails at a company domain:

```ts
const { emails } = await this.hunterService.domainSearch(domain, {
  type: 'personal',   // real people, not info@ / careers@
  limit: 10,
});

emails; // [{ value, type, confidence, first_name, last_name, position }, ...]
```

That's it. Your service never touches `fetch` or the Hunter URL — it just asks `HunterService`.

---

## The two methods

### 1. `domainSearch(domain, options?)` — "who works here?"

Finds email addresses published for a company domain. **This is the one the app uses.**

```ts
domainSearch(
  domain: string,
  options?: DomainSearchOptions,
): Promise<HunterDomainSearchResult>
```

- **`domain`** — the company's website domain, e.g. `'stripe.com'`. Bare domain only — `ContactsService` strips the scheme, `www.`, and any path before calling.
- **`options`** (all optional):

  | Option | Meaning |
  | --- | --- |
  | `limit` | How many emails to return, 1–100 (default 10). |
  | `type` | `'personal'` (real people) or `'generic'` (role addresses like `info@`). |
  | `seniority` | `'junior'`, `'senior'`, or `'executive'` (comma-separate to combine). |
  | `department` | e.g. `'executive'`, `'hr'`, `'it'`, `'sales'`. |

### 2. `findEmail(domain, name)` — "what's this person's email?"

Guesses (and verifies) the most likely email for one specific person.

```ts
findEmail(
  domain: string,
  name: { fullName?: string; firstName?: string; lastName?: string },
): Promise<HunterEmailFinderResult>
```

Returns `{ email, first_name, last_name, score, position, company }`, with `email: null` (and no credit charged) when nothing is found.

> **Nothing calls `findEmail` yet.** It's wired up and ready, but no entity uses it. The natural use is filling in a person you already know about — e.g. someone found on LinkedIn who didn't show up in the domain search.

---

## From API response to database row

### 1. What the API actually returns

`GET https://api.hunter.io/v2/domain-search?domain=…&api_key=…` returns a `data` envelope. Hunter's full payload is much larger than what we keep — each email also carries `sources`, `linkedin`, `twitter`, `phone_number`, `verification`, `seniority`, `department`, and more:

```jsonc
{
  "data": {
    "domain": "acme.com",
    "organization": "Acme",
    "pattern": "{first}@acme.com",
    "emails": [
      {
        "value": "jane.doe@acme.com",
        "type": "personal",
        "confidence": 94,
        "first_name": "Jane",
        "last_name": "Doe",
        "position": "Engineering Manager",
        "seniority": "senior",
        "department": "it",
        "linkedin": "...",
        "verification": { "status": "valid", "date": "2026-08-01" },
        "sources": [ /* up to 20 */ ]
      }
    ]
  },
  "meta": { "results": 42, "limit": 10, "offset": 0 }
}
```

### 2. How we parse it

**a. The client unwraps `data`.** [`HunterClient.get()`](../api/src/externalAPIs/hunter/hunter.provider.ts) appends the API key last (so it can never land in a log), and returns `body.data` — callers never see the envelope.

**b. The service narrows the shape.** `HunterEmail` declares only the six fields we care about — `value`, `type`, `confidence`, `first_name`, `last_name`, `position`. The extra fields still arrive over the wire; TypeScript simply ignores them. `domainSearch` also defaults `emails` to `[]`, so an unknown domain is an empty list rather than a crash.

**c. `ContactsService` turns a URL into a domain** before calling, since `@IsUrl` accepts a bare `acme.com` that `new URL()` would reject:

```ts
const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
return new URL(withScheme).hostname.replace(/^www\./i, '');   // 'https://www.acme.com/jobs' → 'acme.com'
```

**d. `ContactsRepository` renames the fields.** Hunter speaks `snake_case` and uses `null` for unknowns; the entity uses `camelCase` and optional columns:

```ts
{
  jobId,
  email: email.value,
  type: email.type,
  confidence: email.confidence,
  firstName: email.first_name ?? undefined,   // null → undefined → NULL column
  lastName:  email.last_name  ?? undefined,
  position:  email.position   ?? undefined,
}
```

### 3. How it gets stored

The whole batch goes in as **one statement**, upserting on the `(jobId, email)` unique index:

```ts
this.repository.createQueryBuilder().insert().values(contacts)
    .orUpdate(
        ['firstName', 'lastName', 'position', 'confidence', 'type', 'updated_at'],
        ['jobId', 'email'],
    )
    .execute();
```

That's what makes re-running a lookup safe. A job stays open for weeks and you'll search the same company more than once — the second run **refreshes** the titles and confidence scores of people you already have and adds anyone new, instead of duplicating rows or failing on the constraint. (`save()` can't express that, which is why this one drops to the query builder. `updated_at` is in the overwrite list because a raw upsert bypasses TypeORM's `@UpdateDateColumn`.)

`createMany()` then returns **every** contact on the job, not just the ones it wrote — sorted by confidence, so the most reachable person is first.

| Column | Type | Comes from |
| --- | --- | --- |
| `jobId` | `integer` | the request |
| `email` | `text` | Hunter `value` |
| `firstName` / `lastName` | `text`, nullable | `first_name` / `last_name` — Hunter often has neither |
| `position` | `text`, nullable | `position` — the person's role, when Hunter knows it |
| `confidence` | `integer` | `confidence`, 0–100 |
| `type` | `text`, default `'personal'` | `personal` vs `generic` |
| `created_at` / `updated_at` | `timestamp` | TypeORM (`updated_at` maintained by hand in the upsert) |

Plus one unique index, `UQ_contacts_job_email` on `(jobId, email)` — the thing the upsert keys on.

> **Why only `personal`?** `ContactsService` hard-codes `type: 'personal'` on the search. Role inboxes like `info@` come back with no name and no title, which is nothing to personalize an outreach message from. Generic addresses are still *storable* — the `type` column exists and the seed has one — you just have to ask for them deliberately.

---

## Reading the confidence numbers

Both `confidence` (domain search) and `score` (email finder) are **0–100** estimates of how likely the email is real and deliverable. Rough guide:

- **90+** — very likely valid, safe to use.
- **50–89** — probably valid; fine for outreach, expect the occasional bounce.
- **under 50** — shaky; treat as a guess.

Since `findByJobId` sorts by confidence descending, the top of the list is where to start.

---

## Handling errors

Things can go wrong: Hunter might be busy, your key might be missing, or the network might hiccup. `HunterService` maps the common failures to a clean HTTP error:

- **Too many requests (HTTP 429)** → `ServiceUnavailableException` ("Contact lookup service is busy…"). Hunter's limits are 15 requests/second and 500/minute.
- **Network failure / any non-OK response** → `ServiceUnavailableException` with a logged reason.
- **Missing key** → the service throws the moment its module loads (fail fast), not mid-request.
- **A company URL that won't parse** → `BadRequestException` from `ContactsService`, before Hunter is ever called.

**"No results" is not an error.** An unknown domain returns HTTP 200 with an empty `emails` array; `ContactsService` returns `[]` and saves nothing. `findEmail` likewise returns `email: null` (and Hunter charges no credit):

```ts
const found = await this.hunterService.findEmail(domain, { fullName });
if (!found.email) {
  // fall back to domainSearch, or skip this contact
}
```

---

## Keeping costs / credits sane

- **Prefer `findEmail` when you already know the name** — it's one targeted lookup and costs nothing when it finds nothing.
- **Use `limit` on `domainSearch`** so you don't pull 100 emails when you need 10. `POST /contacts` accepts an optional `limit` (1–100, default 10) for exactly this.
- **Filter with `department`/`seniority`** to reach the right people in fewer calls.
- **Re-use the stored rows.** The contacts are already in Postgres — read them with `GET /contacts` instead of searching the same domain again.
- **Develop against `test-api-key`.** Fixture data, zero credits.

---

## Good to know / gotchas

- **`HunterModule` is deliberately *not* loaded app-wide.** The client provider needs `HUNTER_API_KEY` the moment the module loads, so if it were always on, the app would crash on startup without a key. Instead you add `imports: [HunterModule]` only to the feature modules that use it.
- **The API key never appears in logs.** `HunterClient` adds it to the request URL last and never logs the full URL.
- **A contact belongs to the job it was found for.** `PATCH /contacts/:id` can fix a stale title or a mangled name, but it can't move a contact to another job — `jobId` isn't in `UpdateContactDto`, and the global `ValidationPipe` (`whitelist: true`) strips it from the body.
- **Respect people's data.** Only use found emails for legitimate, relevant outreach — and follow anti-spam rules (e.g. CAN-SPAM/GDPR) where they apply.
- **Production gets the key differently.** The prod image has no `api/.env`, so the key comes through the container environment instead. Declare `HUNTER_API_KEY` in your prod compose/deploy config and supply its value at deploy time.

---

## File map

| Path | What it is |
| --- | --- |
| [api/src/externalAPIs/hunter/hunter.provider.ts](../api/src/externalAPIs/hunter/hunter.provider.ts) | Builds the Hunter HTTP client from the API key (token + `fetch` wrapper) |
| [api/src/externalAPIs/hunter/hunter.service.ts](../api/src/externalAPIs/hunter/hunter.service.ts) | The wrapper you call (`HunterService`) — add methods here |
| [api/src/externalAPIs/hunter/hunter.module.ts](../api/src/externalAPIs/hunter/hunter.module.ts) | The NestJS module to import into your feature modules |
| [api/src/entities/contacts/](../api/src/entities/contacts/) | The entity that consumes it — service, repository, entity |
| [api/.env](../api/.env) | Your local config, including `HUNTER_API_KEY` (not committed to git) |
| [api/.env.example](../api/.env.example) | Template listing the env vars the api needs |
