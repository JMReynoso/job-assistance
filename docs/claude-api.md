# Using the Claude API

This guide explains how the API talks to **Claude** (Anthropic's AI model) — what the pieces are, how to call it from your code, and how to write good prompts. It assumes you've never used an AI API before.

---

## What is this, in plain terms?

Claude is an AI model that lives on Anthropic's servers. You can't run it yourself — instead, your backend sends it some text over the internet ("here's a resume and a job posting, write a cover letter") and Claude sends text back.

Everything you need to do that is already wired up in this project. You mostly just call **one method** and get a string back.

```
Your controller  →  your service  →  ClaudeService  →  Anthropic SDK  →  Claude (in the cloud)
                                          ▲
                              this is the only part
                              that knows about Claude
```

The important idea: **only [`ClaudeService`](../api/src/claude/claude.service.ts) knows how to talk to Claude.** The rest of your app just calls it, the same way the rest of the app talks to the database only through repositories.

---

## The pieces that make it work

| Piece | File | What it is (plain terms) |
| --- | --- | --- |
| **API key** | `ANTHROPIC_API_KEY` (env var) | Your password to Anthropic. Every request must include it. Kept out of the code. |
| **The SDK** | `@anthropic-ai/sdk` (npm package) | A library that does the actual internet calls to Claude, so you don't have to. |
| **The client provider** | [anthropic.provider.ts](../api/src/claude/anthropic.provider.ts) | Builds **one** SDK client using your API key, so it's set up in a single place. |
| **ClaudeService** | [claude.service.ts](../api/src/claude/claude.service.ts) | Your friendly wrapper. Has simple methods like `draftCoverLetter(...)`. This is what you call. |
| **ClaudeModule** | [claude.module.ts](../api/src/claude/claude.module.ts) | A NestJS bundle that groups the above so other parts of the app can use `ClaudeService`. |

You'll spend almost all your time in just one of these: **ClaudeService**.

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

## How to use it in the service layer

Three steps. Say you have a `JobService` and you want it to draft cover letters.

**Step 1 — let your feature module use Claude.** In your feature's module file, import `ClaudeModule`:

```ts
import { Module } from '@nestjs/common';
import { ClaudeModule } from '../../claude/claude.module';
import { JobService } from './job.service';

@Module({
  imports: [ClaudeModule], // ← this line gives the module access to ClaudeService
  providers: [JobService],
})
export class JobModule {}
```

**Step 2 — inject `ClaudeService`** into your service, right next to your repositories:

```ts
import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../../claude/claude.service';

@Injectable()
export class JobService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly claude: ClaudeService, // ← injected, ready to use
  ) {}
}
```

**Step 3 — call it.** Your service gathers data (from the database, the request, wherever), hands it to Claude, and does something with the answer:

```ts
async writeCoverLetter(jobId: number): Promise<string> {
  const job = await this.jobRepository.findByIdOrThrow(jobId);
  const letter = await this.claude.draftCoverLetter(job.resume, job.posting);
  return letter;
}
```

That's it. Your service never imports the Anthropic SDK — it just asks `ClaudeService` for a result.

---

## How to write prompts

A "prompt" is just the text you send Claude. In this project a request has **two parts**:

### 1. The system prompt — the AI's job description

This tells Claude *who it is* and *what rules to follow*. It stays the same for every request of the same type. In [claude.service.ts](../api/src/claude/claude.service.ts) it's the `COVER_LETTER_SYSTEM` constant:

```ts
const COVER_LETTER_SYSTEM = `You are an expert career coach writing tailored cover letters.
Write in a confident, specific voice. Never invent experience the candidate does not have.`;
```

Think of it as onboarding instructions you'd give a new employee: their role, their tone, their hard rules.

### 2. The user message — the actual request + data

This is what changes every call — the specific resume and job posting:

```ts
messages: [
  {
    role: 'user',
    content: `RESUME:\n${resume}\n\nJOB POSTING:\n${jobPosting}\n\nWrite a one-page cover letter.`,
  },
],
```

### Tips for writing good prompts (beginner edition)

- **Be specific about the task.** "Write a one-page cover letter" beats "help with this job."
- **Say what format you want back.** e.g. "Reply with only the letter text, no preamble" or "Return a bulleted list."
- **Put rules and persona in the system prompt; put data in the user message.** This keeps things organized *and* saves money (see caching below).
- **Tell it what *not* to do.** e.g. "Never invent experience the candidate does not have." Models follow these literally.
- **Give an example** if the output shape is tricky. Show one good answer and Claude will match it.

### The other settings, explained

In the `messages.create({ ... })` call you'll see a few options:

| Setting | What it means |
| --- | --- |
| `model: 'claude-opus-4-8'` | Which Claude to use. `claude-opus-4-8` is the smartest. If you need cheaper/faster for simple tasks, `claude-sonnet-4-6` is a good alternative. |
| `max_tokens: 16000` | The **longest** reply Claude may produce. A token is roughly ¾ of a word. If replies get cut off, raise this. |
| `thinking: { type: 'adaptive' }` | Lets Claude think privately before answering. "Adaptive" means it decides how much thinking each request needs. Good default for anything non-trivial. |
| `cache_control: { type: 'ephemeral' }` | Caches the system prompt so repeated calls are cheaper (see below). |

### Prompt caching — why the system prompt is "cached"

Claude charges you per token it reads. If you send the same big system prompt on every request, you'd pay for it every time. **Caching** lets Anthropic remember a chunk of text so re-sending it is ~10× cheaper.

The rule to remember: **stable text goes first (and gets cached), changing text goes last.** That's exactly why the system prompt (same every time) is marked with `cache_control`, and the resume/posting (different every time) go in the user message after it. If you flip that order, caching stops working.

You don't have to do anything special — just keep following that pattern and it works.

---

## Adding your own Claude-powered method

Copy the shape of `draftCoverLetter`. For example, a method that summarizes a job posting:

```ts
const SUMMARY_SYSTEM = `You summarize job postings into 3 short bullet points:
the role, the top 3 required skills, and the seniority level. Be concise.`;

async summarizeJobPosting(posting: string): Promise<string> {
  const response = await this.anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: SUMMARY_SYSTEM, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: posting }],
  });

  // Claude's answer comes back as a list of "blocks"; we keep the text ones.
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}
```

**Why that last bit?** Claude's response isn't a plain string — it's a list of "blocks" (text, thinking, etc.). The `.filter(...).map(...).join('')` just pulls out the text blocks and glues them into one string.

---

## Handling errors

Things can go wrong: Anthropic might be busy, your key might be missing, or the network might hiccup. `ClaudeService` already handles the most common one — rate limiting (too many requests) — by turning it into a clean HTTP error:

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

- **Prompt caching** (above) is the biggest lever — keep stable text first.
- **Pick the right model.** Use `claude-opus-4-8` when quality matters; drop to `claude-sonnet-4-6` for high-volume simple tasks.
- **Set a sensible `max_tokens`.** You pay for what Claude generates, so don't ask for 16,000 tokens if the answer is a paragraph.

---

## Good to know / gotchas

- **`ClaudeModule` is deliberately *not* loaded app-wide.** The client needs `ANTHROPIC_API_KEY` the moment the module loads, so if it were always on, the app would crash on startup without a key. Instead you add `imports: [ClaudeModule]` only to the feature modules that use it — so you only need a key once you're actually using Claude.
- **The API has no memory.** Each call is independent. For a back-and-forth chat, you send the whole conversation history each time (an advanced topic — ask if you need it).
- **Long answers should stream.** For big outputs (long documents), use `this.anthropic.messages.stream({...})` instead of `create({...})` to avoid timeouts and to show text as it arrives. Not needed for short replies.
- **Production gets the key differently.** The prod image has no `api/.env`, so the key comes through the container environment instead. [infra/docker-compose.prod.yml](../infra/docker-compose.prod.yml) already declares `ANTHROPIC_API_KEY` — supply its value at deploy time (an exported shell variable or `--env-file`).

---

## File map

| Path | What it is |
| --- | --- |
| [api/src/claude/anthropic.provider.ts](../api/src/claude/anthropic.provider.ts) | Builds the Anthropic client from the API key |
| [api/src/claude/claude.service.ts](../api/src/claude/claude.service.ts) | The wrapper you call (`ClaudeService`) — add your methods here |
| [api/src/claude/claude.module.ts](../api/src/claude/claude.module.ts) | The NestJS module to import into your feature modules |
| [api/.env](../api/.env) | Your local config, including `ANTHROPIC_API_KEY` (not committed to git) |
| [api/.env.example](../api/.env.example) | Template listing the env vars the api needs |
