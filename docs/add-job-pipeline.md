# The add-job pipeline — how "Add to tracker" gets a job onto the board

The counterpart to [job-detail-window.md](job-detail-window.md), which documents the read/save path for a job that already exists. This page covers the other half: what happens between filling out the quick-add form and a fully-researched, fully-tailored job landing in the tracker.

- For the tables and endpoints themselves, see [data-model.md](data-model.md).
- For how the API layers fit together, see [controllers-services-repositories.md](controllers-services-repositories.md).

---

## What clicking "Add to tracker" does

Five stages, run one after another, each a real API call:

```
 1. created    POST /jobs                    → the jobs row; every later call needs its id
 2. research   POST /company-research        → 2 live Perplexity searches
 3. tailoring  POST /generated-content        → 4 Claude or Ollama calls + a PDF render
 4. contact    POST /contacts                 → 1 Hunter.io domain search
 5. ready      GET ×4 (fetchJobDetail)        → no write — folds the finished job onto its tracker row
```

The progress modal beside the form renders one stepper node per stage. Unlike the modal's earlier prototype, every node's status now comes straight from a real response: a stage flips to `done` the moment its call returns 200/201, not on a timer.

## Which engine tailors the resume

Stage 3 can run on **Claude** (paid, faster, higher quality) or **Ollama** (free, local, slower) — a per-device preference set in the Settings window (the gear icon, top right of the nav bar), defaulting to the free local engine. `handleAddJob` in [JobAssistanceApp.tsx](../web/src/components/job-assistance/JobAssistanceApp.tsx) reads the current setting and passes it into `useCreateJob.start()`, which threads it through to `POST /generated-content` as `provider`. The row records which engine actually wrote it (`generated_content.provider`), and a resume regenerated later reuses that same engine by default — see [ollama-api.md](ollama-api.md) and [claude-api.md](claude-api.md) for the two engines themselves.

## Why the chain is sequential

A `Promise.all` across these calls would 404 nearly every time. From [data-model.md](data-model.md):

> The arrow matters: **`generated_content` can't be created until `company_research` exists** for that job — the drafting prompts have nothing to personalize from otherwise, so the endpoint 404s.

`POST /generated-content` looks up the job's newest `company_research` row itself and throws a 404 if there isn't one yet ([generated-content.service.ts:107-113](../api/src/entities/generatedContent/generated-content.service.ts#L107-L113)). `research` has to have already landed, not just been requested, before `tailoring` starts.

`contact` doesn't actually depend on `created`, `research`, or `tailoring` — a Hunter lookup only needs the company's domain. It stays in the chain anyway: the stepper's `activeStage()` returns the *first* running stage, so two stages running at once would mislabel the status line, and Hunter is the fastest of the three external calls in the set, so putting it last costs nothing.

## The pieces

| File | Job |
| --- | --- |
| [useCreateJob.ts](../web/src/hooks/useCreateJob.ts) | Owns the five-stage run: sequencing, retry-from-failure, cancel-and-delete, and the ids each stage creates |
| [lib/api/jobs.ts](../web/src/lib/api/jobs.ts) | `createJob()`, `createCompanyResearch()`, `createGeneratedContent()`, `findContacts()`, and the four `delete*()` undo calls |
| [lib/api/mappers.ts](../web/src/lib/api/mappers.ts) | `toCreateJob()`, `toCreateCompanyResearch()`, `toCreateGeneratedContent()`, `toFindContacts()`, `splitExtraLinks()` — the quick-add form's fields in the API's spelling |
| [new-job.ts](../web/src/lib/job-assistance/new-job.ts) | `missingAddFields()` — what the button is waiting on |
| [AddJobForm.tsx](../web/src/components/job-assistance/AddJobForm.tsx) | The quick-add form; disables the button and names what's missing until the form is ready |
| [JobProgressModal.tsx](../web/src/components/job-assistance/JobProgressModal.tsx) | The five-node stepper, the failed-stage error line, and cancel/retry/done |

## The one naming trap left after the Phase 1 rename

Every URL field is spelled `…Url` / `…Urls` consistently now (see [data-model.md](data-model.md#conventions-that-apply-to-every-entity)) — except that `extraUrls` means two different *types* depending on which endpoint it's sent to:

- `ApiCreateJob.extraUrls` — a single string. `jobs.extraUrls` is one `@IsUrl()` text column.
- `ApiCreateCompanyResearch.extraUrls` — a `string[]`. Perplexity takes a list of pages to cross-check against.

The quick-add form's "Extra links" textarea is one URL per line, split by `splitExtraLinks()`. `toCreateJob()` sends the result only when it's exactly one line — several lines would fail `@IsUrl()` on the `jobs` column and 400 the whole create — while `toCreateCompanyResearch()` sends the full array regardless of length.

## Required fields, and why the job description is one of them

`missingAddFields()` requires five fields before the button arms: company name, job posting link, company page, company LinkedIn, and job description.

The first four are `CreateJobDto`'s own required fields. The job description isn't required by the API at all — `POST /generated-content` will run without one, falling back to whatever's in `jobPostingUrl` — but that fallback is a URL, and no engine has a way to open a link. Requiring the description on the client means the four AI calls in the `tailoring` stage tailor a resume against real posting text instead of nothing, and the JD-match score means something.

Blankness is the only check performed. The API validates URLs with `@IsUrl()`, which accepts a bare `acme.com`, so a stricter client-side pattern would reject inputs the server is happy with.

## Retry resumes at the failed stage

`useCreateJob.retry()` re-enters the pipeline at whichever stage is `failed`, not at `created`. Re-running `created` would try to `POST /jobs` a second time for the same row; re-running `research` or `tailoring` after they already succeeded means paying for a second Perplexity or Claude call for output that's just going to be discarded. The ids each successful stage produced (`jobId`, `researchId`, `contentId`, `contactIds`) live in a ref that survives the failure, so later stages still have what they need.

## Cancel: what it deletes, in what order, and why the client does it by hand

[ConfirmCancelJobModal.tsx](../web/src/components/job-assistance/ConfirmCancelJobModal.tsx) promises that cancelling "discards … and everything generated so far." Nothing in the schema delivers that automatically — from [data-model.md](data-model.md#known-gaps-and-gotchas):

> **No foreign keys anywhere, except missing_keywords.** `jobId` is a plain `integer` with no foreign-key constraint on `company_research`, `generated_content`, or `contacts`.

So `useCreateJob.cancel()` deletes the rows itself, newest first: every contact, then the generated content (which cascades to `missing_keywords` — the schema's one real FK), then the company research, then the job. It's best-effort, via `Promise.allSettled` — a failed sub-delete isn't worth a second error dialog on top of the one the user just confirmed, and the row disappears from the tracker either way.

Cancelling aborts the browser's in-flight request, but that doesn't reach the server: whatever Perplexity or Claude call was already running there runs to completion regardless. That's exactly why the delete pass happens *after* the abort rather than instead of it — the row it creates needs to exist to be deleted.

## What still isn't wired

- **No server-side cancellation.** Aborting only stops the browser from waiting on the response; the API keeps working and keeps writing.
- **No progress within a stage.** The stepper reports whole stages, not partial work — `tailoring` can sit at "In progress" for minutes while four AI calls and a PDF render happen behind one node. On the local engine this is worse: four sequential Ollama generations plus a possible cold model load can run well past ten minutes, with nothing but the modal's engine label to explain why. See [ollama-api.md §9](ollama-api.md#9-speed-what-to-expect) for what drives that and the levers to shorten it.
- **`jobs.extraUrls` still holds only a single link**, per the naming trap above. Multiple extra links only ever reach `company_research.urls`.
