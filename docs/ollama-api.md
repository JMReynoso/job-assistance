# Using the local Ollama engine

This guide explains how the API talks to **Ollama** — the free, local counterpart to Claude. It's the twin of [claude-api.md](claude-api.md): same five methods, same job, same entity, but the model runs on your own machine instead of Anthropic's, so it costs nothing and takes longer. Read that doc first if you haven't; this one only explains what's different.

Docs (official): <https://ollama.com>

---

## 1. What this is, in plain terms

Ollama is a program that runs an AI model **on your own computer** — no internet call, no API key, no bill. Your backend still sends it "here's a resume and a job posting, tailor it" the same way it talks to Claude; it just sends it to `localhost` instead of `api.anthropic.com`.

```
GeneratedContentService → AiProviderRegistry → OllamaService → Ollama (on your machine)
                                 │                    ▲
                                 │        this is the only part
                                 │        that knows about Ollama's HTTP API
                                 ▼
                    GeneratedContentRepository → Postgres (generated_content)
```

`AiProviderRegistry` is the one new piece Ollama introduced: it picks whichever engine a request asked for (`ClaudeService` or `OllamaService`), so `GeneratedContentService` never imports either one directly — see [ai-provider.interface.ts](../api/src/externalAPIs/ai/ai-provider.interface.ts) and [ai-provider.registry.ts](../api/src/externalAPIs/ai/ai-provider.registry.ts).

**The trade this engine makes:** free and private, in exchange for slower and (on a smaller model) less reliable JSON. Claude is still there for the jobs worth paying for — see the Settings window (the gear icon, top right).

---

## 2. One-time setup

### a. Install Ollama and pull the model

```bash
# https://ollama.com/download
ollama pull qwen3.5:27b   # ~17GB — this is the default; any pulled tag works via OLLAMA_MODEL
```

Confirm it's running: `ollama ps` (empty is fine — models load on first use, not on `ollama serve` startup).

### b. Connect the containerized API to your host's Ollama

The dev api runs inside Docker; Ollama runs directly on your machine. Three things have to line up:

**The hostname.** From inside a container, `localhost` is *the container*. Docker Desktop publishes the host as `host.docker.internal` — already the code's default ([ollama.constants.ts](../api/src/externalAPIs/ollama/ollama.constants.ts)). On a **Linux** host that name doesn't exist unless asked for, which is why [docker-compose.dev.yml](../infra/docker-compose.dev.yml) declares it explicitly for the `api` service:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

A no-op on macOS/Windows; the difference between working and not on Linux.

**What Ollama is listening on.** `ollama serve` binds `127.0.0.1:11434` by default — reachable from your own shell, not reliably from a container. Make it listen on every interface:

```bash
# macOS, running the menu-bar app:
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
# then quit and reopen Ollama.app so it picks the value up
```

**Verify from inside the container**, not your shell — your shell can always reach it, which proves nothing:

```bash
docker compose -f infra/docker-compose.dev.yml exec api \
  wget -qO- http://host.docker.internal:11434/api/tags
```

A model list back means you're done. **Connection refused** means the previous step (Ollama is still loopback-only). **Bad address / could not resolve host** means `extra_hosts` didn't take — rebuild the `api` service.

**Production note:** a deployed API has no host Ollama to reach. Set `AI_PROVIDER=claude` there — exactly what the provider switch is for.

### c. Configure

Everything is optional and defaults sensibly — see [api/.env.example](../api/.env.example) for the full annotated list (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_NUM_CTX`, `OLLAMA_TIMEOUT_MS`, `OLLAMA_THINK`, `OLLAMA_KEEP_WARM`).

---

## 3. The five methods

Identical signatures to `ClaudeService` — that's the point of `AiProvider`:

```ts
draftOutreachMessage(summary: string): Promise<AiTextResult>
draftFollowUpMessage(summary: string): Promise<AiTextResult>
draftResume(
  masterResume: string,
  jobPosting: string,
  companyWebsite: string,
  companySummary?: string,
): Promise<AiResumeResult>
scoreResumeMatch(
  tailoredResume: Record<string, unknown>,
  jobDescription: string,
): Promise<AiMatchResult>
regenerateResume(
  tailoredResume: Record<string, unknown>,
  jobDescription: string,
  keywords: string[],
): Promise<AiResumeResult>
```

Plus a sixth method Claude doesn't need: `release(): Promise<void>` — see [§7 Memory](#7-memory-does-ollama-give-the-ram-back).

| Method | Returns | `format` sent | `num_ctx` | `num_predict` | Timeout |
| --- | --- | --- | --- | --- | --- |
| `draftOutreachMessage` / `draftFollowUpMessage` | **`string`** (plain prose) | *omitted* | 8192 | 1200 | 5 min |
| `draftResume` / `regenerateResume` | JSON object | `"json"` | 32768 | 12000 | 15 min |
| `scoreResumeMatch` | clamped 0–100 integer + `string[]` | `MATCH_SCHEMA` | 32768 | 2000 | 5 min |

Same **prompts** as Claude, too — [ai/prompts.constants.ts](../api/src/externalAPIs/ai/prompts.constants.ts) is the one copy both engines read. What differs is *enforcement* (next section) and the model-specific tuning in [ollama.constants.ts](../api/src/externalAPIs/ollama/ollama.constants.ts).

---

## 4. How a reply is parsed

Ollama's non-streaming `/api/chat` reply looks like this:

```jsonc
{
  "model": "qwen3.5:27b",
  "message": {
    "role": "assistant",
    "content": "{\"matchPercent\": 78, \"missingKeywords\": [\"Kubernetes\"]}",
    "thinking": "The resume mentions Docker but not orchestration..."
  },
  "done_reason": "stop",
  "prompt_eval_count": 3120,
  "eval_count": 42
}
```

`message.thinking` is a **separate field** from `message.content` — a reasoning model's scratch work never reaches the parser through the field meant for it. Some models leak reasoning into `content` anyway, which is why the shared JSON parser still strips it defensively.

**The shared extractor** — [helper/parseJson.ts](../api/src/externalAPIs/helper/parseJson.ts), used by both engines:

```ts
const text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')   // a leaked reasoning block
    .replace(/^```(?:json)?\s*/i, '')            // a markdown fence, opening
    .replace(/\s*```$/, '')                      // ...and closing
    .trim();

const candidate = sliceOutermostObject(text) ?? text; // first '{' to its true matching '}'
JSON.parse(candidate);
```

`sliceOutermostObject` does a balanced-brace scan that tracks whether it's inside a string (so a `}` inside a quoted value can't end the scan early) — needed because local models preamble far more than Claude does: a sentence before the JSON, one after, or both.

**The repair retry** — local models produce an unparseable reply often enough that `OllamaService.chatForJson()` gives it one more chance before failing:

1. Send the request.
2. Try to extract JSON. Got it? Done.
3. Didn't parse? Send *one* follow-up: the original prompt, the malformed reply (truncated), and "Return ONLY the JSON object."
4. Try again. Still nothing? `ServiceUnavailableException` — same contract Claude's `draftResume` follows on a genuinely malformed reply.

**For the JD-match score**, there's nothing to repair: `format` is a JSON schema (next section), so the reply is guaranteed valid JSON by construction — `scoreResumeMatch` still clamps `matchPercent` to a plain 0–100 integer defensively, the same discipline `ClaudeService` uses.

---

## 5. Enforcing the shape

Ollama's `format` field can be three different strengths:

| `format` value | Guarantees | Used by |
| --- | --- | --- |
| *(omitted)* | Nothing — free-form prose | `draftOutreachMessage`, `draftFollowUpMessage` |
| `"json"` | Valid JSON — *any* shape | `draftResume`, `regenerateResume` |
| a JSON Schema object | Valid JSON **matching that exact schema** — a decoding grammar, so an off-shape reply is impossible rather than merely unlikely | `scoreResumeMatch` (`MATCH_SCHEMA`) |

This is the local equivalent of Claude's `output_config.format` — same idea, same schema even, just enforced by Ollama's decoder instead of Anthropic's.

**Why the resume methods use `"json"` and not a full schema:** the resume shape is deeply nested with open-ended `technical_skills` category keys the model invents per job. A schema loose enough to describe that adds complexity without adding real strength — it wouldn't catch anything `"json"` mode doesn't already catch. The real risk there isn't *invalid* JSON, it's *wrong-shaped valid* JSON — a renamed key — which a schema can't prevent either (JSON Schema validates structure, not which keys you chose to use). That's what the prompt rules exist for instead:

> **The system prompt names the exact key vocabulary.** `resume.hbs` reads keys literally (`{{contact.email}}`, `{{#each professional_experience}}`…), so a model that "helpfully" renames `technical_skills` to `skills` produces valid JSON that silently renders a blank section — no error anywhere. `COVER_LETTER_SYSTEM` and `RESUME_REGENERATE_SYSTEM` both spell out the master resume's real key names and say, four different ways, never rename one — while explicitly permitting a key to be **dropped** when a section doesn't fit on one page. Dropping is expected; renaming isn't. This is enforced by instruction, not validation — the repair retry and the parser catch malformed JSON, but a well-formed JSON object with the wrong keys parses fine and has to be prevented at the prompt.

---

## 6. Three settings that decide whether this works at all

Each of these fails **silently** if wrong — which is exactly why they're named constants in [ollama.constants.ts](../api/src/externalAPIs/ollama/ollama.constants.ts) rather than inline literals, and worth understanding on purpose:

- **`num_ctx`** — the context window, in tokens. Ollama's own default is small; anything past it is truncated with **no error**. You get a resume confidently tailored against half a job description. The master CV + job posting + company summary comfortably exceed the small default, so this is set explicitly (32768 for resume/match calls) and is env-overridable via `OLLAMA_NUM_CTX` for a smaller model that can't hold that much context.
- **`stream: false`** — `/api/chat` **streams by default**. Without this flag you get a sequence of newline-delimited JSON fragments instead of one response object, and the failure shows up as a transport/parsing error, not a content problem.
- **`think: false`** — the latency default. Reasoning models think *before* answering when asked to, which is often better and always slower. `OLLAMA_THINK=true` is the first lever to try if local output quality disappoints.

---

## 7. Memory: does Ollama give the RAM back?

**Short answer: not immediately on its own, so the app makes it.**

**What Ollama does by default.** The `ollama serve` daemon itself is small and always resident (tens of MB). The expensive part is the **model weights** — Ollama loads them into RAM/VRAM on first use and keeps them there for `keep_alive` after the *last* request (Ollama's own default: 5 minutes), then unloads automatically. A 27B model is roughly 17GB, pinned for that whole window after every single job if nothing else is done.

**What this app does about it.** Every real call sends `keep_alive: '5m'` — just enough to bridge the four sequential calls of one run so the weights load once, not four times. Then, the moment the run ends (success *or* failure), `OllamaService.release()` runs:

```ts
async release(): Promise<void> {
    if (this.keepWarm) return;
    try {
        await this.client.post('api/chat',
            { model: this.model, messages: [], keep_alive: 0 },
            RELEASE_TIMEOUT_MS);
    } catch (error) {
        this.logger.warn(`Could not unload ${this.model}, leaving it to keep_alive: ${error}`);
    }
}
```

An **empty `messages` array** turns this into a control request rather than a generation — Ollama loads/unloads and returns without producing a token. `keep_alive: 0` means "expire now," evicting the weights on the spot instead of waiting out the timer. It's the same operation the `ollama stop <model>` CLI command performs.

**Where it's called from.** [generated-content.service.ts](../api/src/entities/generatedContent/generated-content.service.ts) calls `ai.release()` once, in a `finally` block wrapping the AI calls in both `create()` and `regenerate()`:

```ts
const ai = this.aiProviders.resolve(dto.provider);
try {
    // ...four sequential AI calls...
    return saved;
} finally {
    await ai.release();
}
```

`finally` — not just the happy path — because a run that dies at the PDF render or the DB write has *already* loaded 17GB; that memory needs to come back on the failure path too. `release()` catches everything and only logs a warning: freeing memory is housekeeping, and it must never turn an already-successful generation into a failed request. Ollama's own `keep_alive` timer is the backstop if the unload call itself doesn't land.

`ClaudeService.release()` is a bare `Promise.resolve()` — Claude's weights are on Anthropic's hardware, there's nothing local to free. `AiProvider` declares `release()` on both so `GeneratedContentService` can call it unconditionally without knowing which engine it got.

**The escape hatch:** `OLLAMA_KEEP_WARM=true` skips the unload — for adding several jobs back to back, where reloading 17GB each time costs more than leaving it resident a while longer.

**Watching it work:** `ollama ps` during a run shows the model with an `UNTIL` timestamp; within seconds of the run finishing, it's empty again (or, with `OLLAMA_KEEP_WARM=true`, stays listed).

---

## 8. Why there's no cost column for Ollama

[`ClaudeUsage`](../api/src/externalAPIs/claude/claude.types.ts) — the type behind every `*Usage` column on `generated_content` — is **Claude-only on purpose**:

> Ollama runs on your own machine and bills nothing, so an Ollama-generated row leaves every `*Usage` column `NULL` rather than filling the shape with local token counts. A token count sitting in a column named after a receipt reads as if money was spent.

An Ollama-generated row therefore has `*Usage` = `NULL` and `*Cost` = `0` on every column. The `provider` column (added alongside this feature) is what tells "free" apart from "not recorded" — see [data-model.md](data-model.md).

---

## 9. Speed: what to expect

Local generation is slow compared to a hosted frontier model — this is the real cost of "free." Rough shape, not a promise:

- A drafted message (outreach/follow-up): seconds.
- A full tailored resume (12,000-token ceiling): can run into minutes on a large dense model, longer again on a cold load (first request after the model was unloaded).
- The whole `tailoring` stage — three sequential resume-shaped calls plus a JD-match score — is the one pipeline node most affected. It's a single HTTP request server-side, so the stepper shows one node "In progress" for the whole stretch.

**The levers, in order of impact:**

1. **Model size.** `OLLAMA_MODEL` — a smaller or MoE (mixture-of-experts) tag trades some quality for a large speed gain.
2. **`OLLAMA_THINK`** — leave `false` unless quality genuinely needs it; reasoning roughly doubles latency.
3. **`num_predict`** — the output ceiling per call, already tuned per method in `ollama.constants.ts`.
4. **`keep_alive` / `release()`** — avoiding a cold reload between the four calls of one run (already handled automatically) is the difference between one load and four.

If a resume routinely takes an uncomfortably long time on your machine, the first thing to try is a smaller `OLLAMA_MODEL` tag before anything else.

---

## 10. Errors

`OllamaService.toServiceError()` maps every failure to a clean HTTP error that names its own fix:

| Situation | What's returned | The fix it names |
| --- | --- | --- |
| Model not pulled (`404` from Ollama) | `503` | `ollama pull <model>` |
| Ollama unreachable (connection refused/DNS) | `503` | "is `ollama serve` running?" — plus see [§2b](#b-connect-the-containerized-api-to-your-hosts-ollama) for the Docker networking checklist |
| Request timed out | `503` | "try a smaller `OLLAMA_MODEL` or raise `OLLAMA_TIMEOUT_MS`" |
| Model doesn't support `think` (`400` naming it) | *(handled, not surfaced)* | automatically retried once with `think` removed from the request |
| Reply isn't valid JSON, twice in a row | `503` | "Local AI returned malformed data, please try again" — the repair retry already ran once before this |
| Empty reply | `503` | "Local AI returned an empty response, please try again" |

Every one of these is something fixable on your own machine with a single command — unlike a Claude-side error, there's no account, quota, or billing involved.

---

## 11. File map

| Path | What it is |
| --- | --- |
| [api/src/externalAPIs/ollama/ollama.service.ts](../api/src/externalAPIs/ollama/ollama.service.ts) | The engine — implements `AiProvider`, mirrors `ClaudeService`'s five methods plus `release()` |
| [api/src/externalAPIs/ollama/ollama.constants.ts](../api/src/externalAPIs/ollama/ollama.constants.ts) | Model default, timeouts, `num_ctx`/`num_predict` per call, `MATCH_SCHEMA` |
| [api/src/externalAPIs/ollama/ollama.provider.ts](../api/src/externalAPIs/ollama/ollama.provider.ts) | The injection token + thin `fetch` client for Ollama's HTTP API (mirrors `perplexity.provider.ts`) |
| [api/src/externalAPIs/ollama/ollama.types.ts](../api/src/externalAPIs/ollama/ollama.types.ts) | Wire shape of an `/api/chat` reply, and the per-call settings `chat()` takes |
| [api/src/externalAPIs/ollama/ollama.module.ts](../api/src/externalAPIs/ollama/ollama.module.ts) | The NestJS bundle — usually imported via `AiModule`, not directly |
| [api/src/externalAPIs/ai/](../api/src/externalAPIs/ai/) | The shared seam: `AiProvider` interface, `AiProviderRegistry` (picks the engine), `AiModule`, and the shared `prompts.constants.ts` |
| [api/src/externalAPIs/helper/parseJson.ts](../api/src/externalAPIs/helper/parseJson.ts) | The JSON extractor both engines share |
| [api/src/externalAPIs/claude/claude.types.ts](../api/src/externalAPIs/claude/claude.types.ts) | `ClaudeUsage` — why it's Claude-only, and why Ollama rows leave it `NULL` |
| [web/src/components/job-assistance/SettingsModal.tsx](../web/src/components/job-assistance/SettingsModal.tsx) | The gear-icon window that switches the default engine, per device |
| [api/.env.example](../api/.env.example) | Every `OLLAMA_*` / `AI_PROVIDER` setting, annotated |
