# Using the Claude API

This guide explains how the API talks to **Claude** (Anthropic's AI model) — what the pieces are, what it's used for in this app, how the answers get parsed, and how they end up in Postgres. It assumes you've never used an AI API before.

Docs (official): <https://platform.claude.com/docs>

---

## What is this, in plain terms?

Claude is an AI model that lives on Anthropic's servers. You can't run it yourself — instead, your backend sends it some text over the internet ("here's a resume and a job posting, tailor it") and Claude sends text back.

Everything you need to do that is already wired up. You mostly just call **one method** and get a result back.

```
GeneratedContentService  →  ClaudeService  →  Anthropic SDK  →  Claude (in the cloud)
         │                        ▲
         │            this is the only part
         │            that knows about Claude
         ▼
GeneratedContentRepository  →  Postgres (generated_content)
```

The important idea: **only [`ClaudeService`](../api/src/externalAPIs/claude/claude.service.ts) knows how to talk to Claude.** The rest of the app just calls it, the same way the rest of the app talks to the database only through repositories.

---

## What it's used for, and which entity it feeds

| | |
| --- | --- |
| **Used for** | Writing things *for* the user: the outreach message, the follow-up message, and the tailored resume |
| **Entity** | [`GeneratedContent`](../api/src/entities/generatedContent/entities/generated-content.entity.ts) |
| **Table** | `generated_content` |
| **Called from** | [`GeneratedContentService.create()`](../api/src/entities/generatedContent/generated-content.service.ts) |
| **Endpoint** | `POST /generated-content` |
| **Input it works from** | The stored `company_research.summary` for the job (see [perplexity-api.md](perplexity-api.md)) plus the master CV at `api/src/CV/resume.json` |

The three external APIs each own one entity: **Perplexity → CompanyResearch**, **Claude → GeneratedContent**, **Hunter.io → Contacts**. All three hang off a `jobId` — see [data-model.md](data-model.md) for every table and endpoint in one place.

---

## The pieces that make it work

| Piece | File | What it is (plain terms) |
| --- | --- | --- |
| **API key** | `ANTHROPIC_API_KEY` (env var) | Your password to Anthropic. Every request must include it. Kept out of the code. |
| **The SDK** | `@anthropic-ai/sdk` (npm package) | A library that does the actual internet calls to Claude, so you don't have to. |
| **The client provider** | [anthropic.provider.ts](../api/src/externalAPIs/claude/anthropic.provider.ts) | Builds **one** SDK client using your API key, so it's set up in a single place. |
| **ClaudeService** | [claude.service.ts](../api/src/externalAPIs/claude/claude.service.ts) | Your friendly wrapper. Three methods; this is what you call. |
| **The prompts** | [claude.constants.ts](../api/src/externalAPIs/claude/claude.constants.ts) | The (long) system prompts and Justin's outreach template, kept out of the service file. |
| **The price list** | [claude.pricing.ts](../api/src/externalAPIs/claude/claude.pricing.ts) | Turns a call's token usage into a USD estimate. |
| **ClaudeModule** | [claude.module.ts](../api/src/externalAPIs/claude/claude.module.ts) | A NestJS bundle that groups the above so other parts of the app can use `ClaudeService`. |

You'll spend almost all your time in just two of these: **ClaudeService** and **claude.constants.ts**.

---

## One-time setup: get and set your API key

1. **Get a key.** Log in to the [Anthropic Console](https://platform.claude.com), go to API keys, and create one. It looks like `sk-ant-...`. Treat it like a password — anyone with it can spend your money.

2. **Give it to the app.** Open `api/.env` (if it doesn't exist, copy it from [api/.env.example](../api/.env.example)). This file is **not** committed to git. Fill in your key:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

   NestJS's `ConfigModule` loads `api/.env` automatically, so `ClaudeService` can read the key from it. (In Docker, this file reaches the container through the `../api` bind mount.)

3. **Restart the api** so it picks up the new value:

   ```bash
   docker compose -f infra/docker-compose.dev.yml restart api
   ```

> **You don't need a key just to run the app.** Claude is only contacted when a feature actually uses it (see the note about `ClaudeModule` at the bottom). So the app boots fine without a key until you start calling Claude.

---

## The three methods

```ts
draftOutreachMessage(summary: string): Promise<ClaudeTextResult>
draftFollowUpMessage(summary: string): Promise<ClaudeTextResult>
draftResume(
  masterResume: string,
  jobPosting: string,
  companyWebsite: string,
  companySummary?: string,
): Promise<ClaudeResumeResult>
```

- **`draftOutreachMessage`** — a warm first-contact message to a recruiter or hiring manager. It fills Justin's fixed template (`OUTREACH_TEMPLATE`), personalizing only the company name and 2–3 connecting sentences; everything else is copied verbatim.
- **`draftFollowUpMessage`** — a warm-but-corporate nudge after the outreach, ~90–140 words.
- **`draftResume`** — rewrites the master CV against one job posting and returns it as **structured JSON** (which then gets rendered to a PDF).

The `summary` all three work from is the stored company research — one string. Nothing here talks to the database; the caller fetches the summary and passes it in.

**Two different models, on purpose:**

| Method | Model | Why |
| --- | --- | --- |
| `draftOutreachMessage` / `draftFollowUpMessage` | `claude-sonnet-5` (`MESSAGE_MODEL`) | A short, warm message doesn't need the top-tier model. Runs at `effort: 'medium'`, capped at 1200 output tokens. |
| `draftResume` | `claude-opus-4-8` (`RESUME_MODEL`) | Rewriting a whole CV against a posting *and* returning valid JSON is the hard job. Capped at 12,000 output tokens. |

Both use `thinking: { type: 'adaptive' }` — Claude decides for itself how much to reason before answering.

---

## How to use it in the service layer

Three steps — this is exactly what [`GeneratedContentModule`](../api/src/entities/generatedContent/generated-content.module.ts) does.

**Step 1 — let your feature module use Claude.** In your feature's module file, import `ClaudeModule`:

```ts
import { Module } from '@nestjs/common';
import { ClaudeModule } from '../../externalAPIs/claude/claude.module';
import { GeneratedContentService } from './generated-content.service';

@Module({
  imports: [ClaudeModule], // ← this line gives the module access to ClaudeService
  providers: [GeneratedContentService],
})
export class GeneratedContentModule {}
```

**Step 2 — inject `ClaudeService`** into your service, right next to your repositories:

```ts
import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../../externalAPIs/claude/claude.service';

@Injectable()
export class GeneratedContentService {
  constructor(
    private readonly generatedContentRepository: GeneratedContentRepository,
    private readonly claudeService: ClaudeService, // ← injected, ready to use
  ) {}
}
```

**Step 3 — call it.** Your service gathers data (from the database, the request, wherever), hands it to Claude, and does something with the answer:

```ts
const outreach = await this.claudeService.draftOutreachMessage(companySummary);
outreach.content; // the message text
outreach.usage;   // token counts
outreach.cost;    // estimated USD for this one call
```

That's it. Your service never imports the Anthropic SDK — it just asks `ClaudeService` for a result.

---

## From Claude's response to a database row

This is the part worth understanding, because Claude's reply is **not** a plain string.

### 1. What the API actually returns

A response is a list of **content blocks**, not text. A thinking-enabled call typically returns a `thinking` block followed by one or more `text` blocks, plus a `usage` object:

```jsonc
{
  "id": "msg_01...",
  "model": "claude-sonnet-5",
  "content": [
    { "type": "thinking", "thinking": "" },       // empty unless display: 'summarized'
    { "type": "text", "text": "Hi [Name], I hope you're doing well!..." }
  ],
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 1500,
    "output_tokens": 800,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0
  }
}
```

### 2. How we parse it

**For the two message methods** — keep the text blocks, drop everything else, glue them together:

```ts
const content = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
```

**For the resume** — same extraction, then two extra steps, because we asked for JSON:

```ts
// Claude often wraps JSON in a ```json … ``` fence even when asked for raw JSON.
const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

try {
    return { resume: JSON.parse(json), usage: response.usage, cost: ... };
} catch {
    // Logged with the first 200 chars, then surfaced as a clean 503
    throw new ServiceUnavailableException('AI service returned malformed data, please try again');
}
```

**Then the cost** — `usage` is token *counts*, not money. [`costFromUsage(model, usage)`](../api/src/externalAPIs/claude/claude.pricing.ts) turns it into USD by splitting the tokens across the buckets that bill differently:

| Token bucket | Rate |
| --- | --- |
| Fresh input | the model's base input rate |
| Cache **reads** | 0.1× base input |
| Cache **writes** (5-minute TTL) | 1.25× base input |
| Cache **writes** (1-hour TTL) | 2× base input |
| Output (already includes thinking tokens — don't add them twice) | the model's output rate |

A model with no entry in the price list yields a cost of `0` rather than throwing — a missing rate should never fail a generation you've already been billed for.

So each method hands back a small, tidy object:

```ts
interface ClaudeTextResult   { content: string;                    usage: Anthropic.Message['usage']; cost: number }
interface ClaudeResumeResult { resume: Record<string, unknown>;    usage: Anthropic.Message['usage']; cost: number }
```

### 3. How it gets stored

[`GeneratedContentService.create()`](../api/src/entities/generatedContent/generated-content.service.ts) is the conductor. In order, it:

1. Reads the master CV from `api/src/CV/resume.json` as **raw text** (it's context for Claude, so it needn't be valid JSON).
2. Resolves the company name — from the request, else from the `Job` record via `JobsService.findOne()`.
3. Pulls the **latest company research** for the job (`companyResearchRepository.findByJobId`). No research → `404`, because there'd be nothing to personalize from.
4. Calls all three Claude methods with that summary.
5. Renders the resume JSON to a PDF via [`ResumePdfService`](../api/src/entities/generatedContent/resume-pdf/resume-pdf.service.ts) (Handlebars → Puppeteer) and keeps the **file path**.
6. Hands one flat object to `GeneratedContentRepository.create()`.

Which lands in `generated_content` like this:

| Column | Type | Comes from |
| --- | --- | --- |
| `jobId` | `integer` | the request |
| `outreachMessage` | `text` | `draftOutreachMessage().content` |
| `followupMessage` | `text` | `draftFollowUpMessage().content` |
| `tailoredResume` | `text` | the **PDF path** — not the JSON. The JSON is rendered and discarded. |
| `outreachMessageUsage` / `followupMessageUsage` / `tailoredResumeUsage` | `jsonb` | the raw `usage` block from each call |
| `outreachMessageCost` / `followupMessageCost` / `tailoredResumeCost` | `double precision` | `costFromUsage(...)` for each call |
| `created_at` / `updated_at` | `timestamp` | TypeORM |

Storing usage *and* cost side by side is deliberate: `usage` is the receipt from Anthropic and never changes, while `cost` is our own estimate against a price list that can go stale. If rates change you can re-derive every cost from the stored `usage`.

---

## How to write prompts

A "prompt" is just the text you send Claude. A request here has **two parts**, and both live in [claude.constants.ts](../api/src/externalAPIs/claude/claude.constants.ts).

### 1. The system prompt — the AI's job description

This tells Claude *who it is* and *what rules to follow*. It stays the same for every request of the same type — `OUTREACH_SYSTEM`, `FOLLOWUP_SYSTEM`, `COVER_LETTER_SYSTEM`:

```ts
export const OUTREACH_SYSTEM = `You are helping Justin Reynoso, a software engineer, send a warm outreach message...

Rules:
- Replace every "{ COMPANY NAME }" with the company's actual name from the summary.
- Keep ALL other text EXACTLY as written — do not paraphrase, reorder, add, or remove anything.
- Output only the finished message: no subject line, notes, or preamble.`;
```

Think of it as onboarding instructions you'd give a new employee: their role, their tone, their hard rules.

### 2. The user message — the actual request + data

This is what changes every call — the specific company summary:

```ts
messages: [
  {
    role: 'user',
    content: `Here is the company research summary to work from:\n\n${summary}`,
  },
],
```

### Tips for writing good prompts

- **Be specific about the task.** "Return a one-page resume in json format" beats "help with this job."
- **Say what format you want back.** e.g. "Output only the message text — no subject line, notes, or preamble."
- **Put rules and persona in the system prompt; put data in the user message.** This keeps things organized *and* saves money (see caching below).
- **Tell it what *not* to do.** e.g. "Never invent facts about Justin or the company." Models follow these literally.
- **Give an example** if the output shape is tricky — `OUTREACH_TEMPLATE` is exactly that: the literal message with two `{ ... }` slots to fill.

### The other settings, explained

| Setting | What it means |
| --- | --- |
| `model` | Which Claude to use — `claude-opus-4-8` for the resume, `claude-sonnet-5` for the messages. |
| `max_tokens` | The **longest** reply Claude may produce. A token is roughly ¾ of a word. If replies get cut off, raise this. It caps thinking **plus** the answer. |
| `thinking: { type: 'adaptive' }` | Lets Claude think privately before answering, deciding how much each request needs. Good default for anything non-trivial. |
| `output_config: { effort: 'medium' }` | How hard to work. Lower = faster and cheaper; the messages use `medium`, which buys warm, personal quality without paying for deep deliberation. |
| `cache_control: { type: 'ephemeral' }` | Caches the system prompt so repeated calls are cheaper (see below). |

### Prompt caching — why the system prompt is "cached"

Claude charges per token it reads. If you send the same big system prompt every request, you'd pay for it every time. **Caching** lets Anthropic remember a chunk of text so re-sending it is ~10× cheaper.

The rule to remember: **stable text goes first (and gets cached), changing text goes last.** That's exactly why each system prompt is marked with `cache_control` and the summary goes in the user message after it. Flip that order and caching stops working.

> **Gotcha — there's a minimum.** A cached prefix has to reach **1,024 tokens** on both `claude-opus-4-8` and `claude-sonnet-5`, or the cache is silently skipped: no error, just `cache_creation_input_tokens: 0` in the response. Our system prompts are on the short side, so don't assume caching is happening — check that field on a real response before counting on the savings.

---

## Adding your own Claude-powered method

Copy the shape of `draftMessage`. For example, a method that summarizes a job posting:

```ts
const SUMMARY_SYSTEM = `You summarize job postings into 3 short bullet points:
the role, the top 3 required skills, and the seniority level. Be concise.`;

async summarizeJobPosting(posting: string): Promise<ClaudeTextResult> {
  const response = await this.anthropic.messages.create({
    model: MESSAGE_MODEL,
    max_tokens: 1000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: [
      { type: 'text', text: SUMMARY_SYSTEM, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: posting }],
  });

  const content = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  return { content, usage: response.usage, cost: costFromUsage(MESSAGE_MODEL, response.usage) };
}
```

Always return `usage` and `cost` alongside the content — that's what makes per-job spend visible in the database.

---

## Handling errors

`ClaudeService` maps the common failures to clean HTTP errors so callers don't have to:

- **Too many requests** (`Anthropic.RateLimitError`) → `ServiceUnavailableException` ("AI service is busy, please try again shortly").
- **Resume JSON that won't parse** → logged with the first 200 characters, then `ServiceUnavailableException` ("AI service returned malformed data, please try again"). This is the one failure unique to `draftResume` — the model returned *something*, just not JSON.
- **Anything else** bubbles up unchanged.

```ts
catch (error) {
  if (error instanceof Anthropic.RateLimitError) {
    this.logger.warn('Anthropic rate limited the request');
    throw new ServiceUnavailableException('AI service is busy, please try again shortly');
  }
  throw error; // anything else bubbles up
}
```

The SDK gives you typed errors like `Anthropic.RateLimitError`, `Anthropic.AuthenticationError` (bad/missing key), and `Anthropic.BadRequestError`. Check for the ones you care about; let the rest bubble up.

---

## Keeping costs sane

Current rates, per 1,000,000 tokens — these are what [claude.pricing.ts](../api/src/externalAPIs/claude/claude.pricing.ts) encodes:

| Model | Input | Output |
| --- | --- | --- |
| `claude-opus-4-8` (resume) | $5 | $25 |
| `claude-sonnet-5` (messages) | **$2 → $3** | **$10 → $15** |

> **Sonnet 5 is on introductory pricing through 2026-08-31.** From 2026-09-01 it bills at $3 / $15 — a 50% jump. `costFromUsage` already handles the switch by date, so nothing breaks; your per-message cost just rises. One drafted message stays well under $0.04 either way.

Other levers:

- **Prompt caching** (above) is the biggest one — keep stable text first, and verify it's actually caching.
- **Pick the right model.** The split is already made for you: Opus for the resume, Sonnet for the messages.
- **Set a sensible `max_tokens`.** You pay for what Claude generates — 1200 for a message, 12000 for a resume.
- **Read the stored costs.** `SELECT SUM(outreachMessageCost + followupMessageCost + tailoredResumeCost) FROM generated_content` tells you what the AI features have actually cost.

---

## Good to know / gotchas

- **`ClaudeModule` is deliberately *not* loaded app-wide.** The client needs `ANTHROPIC_API_KEY` the moment the module loads, so if it were always on, the app would crash on startup without a key. Instead you add `imports: [ClaudeModule]` only to the feature modules that use it.
- **The API has no memory.** Each call is independent. The three drafting calls know nothing about each other — they each get the same summary and work alone.
- **Prompts are shared with Ollama.** [claude.constants.ts](../api/src/externalAPIs/claude/claude.constants.ts) is written to be model-agnostic so the same outreach/follow-up prompts can run locally through `OllamaService` (not implemented yet).
- **`generated_content` stores the resume's *path*, not its text.** The JSON Claude returns is rendered to a PDF and the file path is what's saved. If you need the JSON later, you'd have to re-generate.
- **Long answers should stream.** For big outputs, `this.anthropic.messages.stream({...})` avoids HTTP timeouts. Not needed at our current `max_tokens`; worth remembering if the resume cap ever grows.
- **Production gets the key differently.** The prod image has no `api/.env`, so the key comes through the container environment instead. [infra/docker-compose.prod.yml](../infra/docker-compose.prod.yml) already declares `ANTHROPIC_API_KEY` — supply its value at deploy time (an exported shell variable or `--env-file`).

---

## File map

| Path | What it is |
| --- | --- |
| [api/src/externalAPIs/claude/anthropic.provider.ts](../api/src/externalAPIs/claude/anthropic.provider.ts) | Builds the Anthropic client from the API key |
| [api/src/externalAPIs/claude/claude.service.ts](../api/src/externalAPIs/claude/claude.service.ts) | The wrapper you call (`ClaudeService`) — add your methods here |
| [api/src/externalAPIs/claude/claude.constants.ts](../api/src/externalAPIs/claude/claude.constants.ts) | System prompts, the outreach template, and `MESSAGE_MODEL` |
| [api/src/externalAPIs/claude/claude.pricing.ts](../api/src/externalAPIs/claude/claude.pricing.ts) | Per-call USD cost estimation from a `usage` block |
| [api/src/externalAPIs/claude/claude.module.ts](../api/src/externalAPIs/claude/claude.module.ts) | The NestJS module to import into your feature modules |
| [api/src/entities/generatedContent/](../api/src/entities/generatedContent/) | The entity that consumes it — service, repository, entity, PDF renderer |
| [api/.env](../api/.env) | Your local config, including `ANTHROPIC_API_KEY` (not committed to git) |
| [api/.env.example](../api/.env.example) | Template listing the env vars the api needs |
