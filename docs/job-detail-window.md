# The job detail window — how one job gets assembled

The window that opens when you click **open** on a tracker row. This page covers what it fetches, how each field on screen traces back to a database column, and which parts of a job the UI does *not* surface.

- For the tables and endpoints themselves, see [data-model.md](data-model.md).
- For how the API layers fit together, see [controllers-services-repositories.md](controllers-services-repositories.md).

**The window is read-only against the backend, with one exception.** Every field in the form loads real data and Save commits to local React state only — nothing is persisted. **Regenerate Tailored Resume is different: it's the app's first wired write**, a real `POST /generated-content/regenerate` that updates the row in Postgres. See [What isn't wired](#what-isnt-wired) at the end.

---

## The pieces

| File | Job |
| --- | --- |
| [useJobTracker.ts](../web/src/hooks/useJobTracker.ts) | Owns the list, the open row, the draft, and every load state |
| [useRegenerateResume.ts](../web/src/hooks/useRegenerateResume.ts) | Owns the regenerate call, its (cosmetic) progress stages, and the abort |
| [lib/api/jobs.ts](../web/src/lib/api/jobs.ts) | `fetchJobs()`, `fetchJobDetail()` — the four requests — and `regenerateTailoredResume()` |
| [lib/api/client.ts](../web/src/lib/api/client.ts) | `apiGet()`, `apiPost()`, and `ApiError` |
| [lib/api/mappers.ts](../web/src/lib/api/mappers.ts) | Translates wire shapes → UI shapes. The only file that knows both |
| [lib/api/types.ts](../web/src/lib/api/types.ts) | Hand-written mirrors of the four entities as they arrive |
| [JobDetailModal.tsx](../web/src/components/job-assistance/JobDetailModal.tsx) | The window itself — pure presentation |
| [ContactsTable.tsx](../web/src/components/job-assistance/ContactsTable.tsx) | The contacts grid, read-only |
| [MissingKeywords.tsx](../web/src/components/job-assistance/MissingKeywords.tsx) | The horizontal keyword checkbox row |
| [RegenerateProgressModal.tsx](../web/src/components/job-assistance/RegenerateProgressModal.tsx) | Progress popup for a regenerate call, with a confirm-before-cancel step |

The split is deliberate: everything under `lib/api/` is pure functions with no React in them, so [web/tests/lib/api/](../web/tests/lib/api/) can test the whole boundary without rendering anything.

---

## A job is four rows in four tables

There is no single "job" record. A job in the UI sense is one `jobs` row plus whatever the three satellite tables have accumulated for it, joined on `jobId` in the client rather than in Postgres:

```
                        jobs (always exactly one)
                              │ jobId
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   contacts              company_research     generated_content
   0..n rows             0..1 surfaced        0..1 surfaced
   (Hunter)              (Perplexity)         (Claude)
   → contacts table      → Notes              → both message boxes
                                              → resume button
                                              → JD match % + keyword chips
```

**Only `jobs` is guaranteed.** A job you added a minute ago has no research, no content, and no contacts — that is its normal state, not a broken one. `company_research` and `generated_content` allow many rows per job; the by-job reads take the newest (`id DESC`) and the older ones stay as history the window never shows.

---

## The read path

Clicking **open** calls `openRow(id)` in [useJobTracker.ts](../web/src/hooks/useJobTracker.ts). It runs in two halves either side of the first `await`:

```
openRow(id)
│
├─ synchronous ── setOpenId, setDraft(copy of the list row), setDirty(false)
│                 → the window is already on screen with the list's data
│
├─ toJobId(id) === null ?  → status "idle", stop. Nothing to fetch.
│
└─ async ─────── fetchJobDetail(jobId)   status "loading"
                 │
                 ├─ GET /jobs/:id                        ─┐
                 ├─ GET /contacts/by-job/:jobId            │ Promise.all
                 ├─ GET /company-research/by-job/:jobId    │ (parallel)
                 └─ GET /generated-content/by-job/:jobId  ─┘
                 │
                 └─ mergeJobDetail(...) → setDraft        status "loaded"
```

The synchronous half matters: the window opens instantly with whatever the list already has and fills in as the response lands. The user never stares at an empty dialog.

### The four requests

| Request | Returns | When the job has none |
| --- | --- | --- |
| `GET /jobs/:id` | The job row | n/a — always exists |
| `GET /contacts/by-job/:jobId` | Contacts, most reachable first (`confidence DESC`, then `id`) | `200` + `[]` |
| `GET /company-research/by-job/:jobId` | Newest research row | `200` + `null` |
| `GET /generated-content/by-job/:jobId` | Newest generation run, plus its `missingKeywords` | `200` + `null` |

**None of these 404 for absence** — that contract is what makes the client rule trivially correct: *any non-`ok` response is a real error*. See [the by-job section of data-model.md](data-model.md#the-by-job-routes-never-404) for why, and for the null-vs-undefined trap on the API side.

`Promise.all`, not `allSettled`. The absence case is already handled by the contract above, so what's left for `allSettled` is partial *failure* — and for four requests to the same server in the same millisecond that is essentially all-or-nothing. One error state and one retry beats four threaded through the window.

Re-reading `/jobs/:id` when the list row already carries those fields is one redundant round-trip. It's kept because it is free (parallel) and means the window shows the truth even when the list is stale.

### `toJobId` — the persisted-or-not guard

`Job.id` is a **string** throughout the UI. A job created by `addToTracker()` has a UUID; a job from the API has its row id stringified. [`toJobId`](../web/src/lib/api/mappers.ts) is the one boundary that decides which is which:

```ts
Number.isInteger(parsed) && parsed > 0 ? parsed : null
```

`null` means "only exists locally", so `openRow` skips the fetch entirely. A locally-added job opens instantly with its own data and fires no request that could not have resolved — which falls out for free rather than needing a special case.

---

## Where every field comes from

`mergeJobDetail` folds the three satellite reads onto the mapped job. Everything below is what you see in the window, top to bottom:

| Field on screen | Source | Column |
| --- | --- | --- |
| Window title | `jobs` | `companyName` (falls back to "Job details") |
| Company name | `jobs` | `companyName` |
| Status | `jobs` | `status`, via `STATUS_FROM_API` |
| Date applied | `jobs` | `dateApplied` |
| Date last contacted | `jobs` | `dateLastContacted` |
| Job posting URL | `jobs` | `jobPostingURL` |
| Company URL | `jobs` | `companyPage` |
| Contacts → name | `contacts` | `firstName` + `lastName`, joined |
| Contacts → role | `contacts` | `position` |
| Contacts → email | `contacts` | `email` |
| Contacts → LinkedIn | `contacts` | `linkedin` |
| Contacts → confidence | `contacts` | `confidence` |
| Notes | `company_research` | `summary` |
| Job description | `jobs` | `jobDescription` |
| Recruiter/HM message | `generated_content` | `outreachMessage` |
| Follow-up message | `generated_content` | `followupMessage` |
| Get Tailored Resume (enabled?) | `generated_content` | `tailoredResume` — presence only |
| Job Description Match: X% (shown at all?) | `generated_content` | `jdMatchPercent` — hidden while `null`, i.e. before the first generation |
| Missing keyword chips | `missing_keywords` (via `generated_content.missingKeywords`) | `keyword` + `include`, one chip per row |
| Regenerate Tailored Resume (enabled?) | (derived) | enabled once at least one keyword chip is checked |

The job description textarea is the odd one out: unlike every other field on this list, editing it and clicking Save does **not** persist — same as everything else in the form (see [What isn't wired](#what-isnt-wired)). What *does* reach the backend is whatever `jobs.jobDescription` already held when the row was created or last `PATCH`ed directly; regenerating reads that stored value, not whatever is currently typed in the open window.

Three naming traps live in that table. The `jobs` entity spells it **`jobPostingURL`** (capital URL) while the UI uses `jobPostingUrl`; **`companyPage`** becomes `companyUrl`; and **Notes is research**, not a notes column — there is no free-text notes field anywhere in the schema.

### Status translation

`not_applied` ↔ `Interested` is the only pair that isn't a straight rename — the backend describes the application, the UI describes intent, but they're the same row state. `STATUS_TO_API` is derived from `STATUS_FROM_API` by inversion so the two directions cannot drift.

`toJobStatus` falls back to `"Interested"` for anything unrecognised. That fallback is **load-bearing, not padding**: `status` is an unconstrained `text` column, and [JobTableRow](../web/src/components/job-assistance/JobTableRow.tsx) does `STATUS_STYLES[job.status].bg` — an unmapped value throws on `undefined.bg` and unmounts the entire table.

### Every nullable field is coalesced to `""`

Each mapper ends in `?? ""`. These values bind to controlled `<input value>` / `<textarea value>`, and a `null` there flips the element to uncontrolled: React logs the "changing a controlled input to be uncontrolled" warning and the field silently stops tracking state. This is why [types.ts](../web/src/lib/api/types.ts) declares `| null` rather than `?` — there is no `ClassSerializerInterceptor` on the API, so nullable columns genuinely arrive as `null`, not as an absent key.

---

## What the window never shows

Present in the database, deliberately not surfaced:

| Column | Why not |
| --- | --- |
| `jobs.companyLinkedIn` | Mapped onto the draft, but no field renders it |
| `jobs.extraURLs` | Same — mapped, never rendered |
| `company_research.urls` | The sources behind the summary. Nowhere to put them yet |
| `company_research.company` | Duplicates `jobs.companyName` |
| `contacts.type` | `personal` vs `generic`; confidence is the more useful signal |
| `*Usage`, `*Cost`, `regenerateCount` on `generated_content` | Token accounting. Omitted from `ApiGeneratedContent` on purpose — listing them invites someone to render them |
| `createdAt` / `updatedAt` everywhere | Not interesting to the person applying |

`companyLinkedIn` and `extraURLs` are the two worth revisiting: they cost nothing to add to the grid, and they're already in the draft.

---

## Load states

`detailStatus` drives what the window renders above the form. It is one of four values:

| State | When | What renders |
| --- | --- | --- |
| `idle` | Locally-added job — nothing to fetch | No chrome at all |
| `loading` | Requests in flight | Spinner strip; **form disabled** |
| `loaded` | All four resolved | No chrome |
| `error` | Any request rejected | Error strip with **↻ Try again** |

### Editing is blocked during load, on purpose

The form body sits inside `<fieldset disabled={loading}>`. If the user could type while the fetch was in flight, the arriving merge would silently destroy their edits. There were three ways out — skip the merge when dirty (fields then never populate), merge only untouched fields (needs per-field dirty tracking), or make editing impossible until the data lands.

The third removes the conflict instead of resolving it. It needs no new state, and it is honest: the values on screen during `loading` are provisional. Since `dirty` cannot become `true`, the Save button is already disabled and correct with no extra work.

> A bare `<fieldset>` carries UA margin, padding, border, and `min-width: min-content` — the last of which **will break the two-column grid**. It needs `m-0 min-w-0 border-0 p-0`.

### Absence renders as nothing, not as a message

A `loaded` job with no research means `notes === ""`, and `TextAreaField` already shows its placeholder. `ContactsTable` already shows *"No contacts found for this job yet."* Both are quiet and correct with zero extra code. Resist adding "No research found" messaging — absence of research on a new job isn't news.

### Opening two rows quickly

`detailRequest` is a monotonic counter ref. Each `openRow` takes a ticket; a response whose ticket no longer matches is dropped on arrival. `closeNow()` bumps it too, so a late response cannot repopulate a window that's already shut, and the `prev.id === id` check inside the `setDraft` updater is the backstop.

A counter rather than `AbortController`: it's one line, it covers every supersession including close-and-reopen, and it avoids an `AbortError` landing in the `catch` and painting a false error banner. Cancelling in-flight network work isn't worth it for four small GETs.

---

## When it breaks

| Symptom | Cause |
| --- | --- |
| Every field blank, error strip | API unreachable → `ApiError` with `status: 0`. Check the `api` container is actually up |
| Error strip only in the browser, curl fine | CORS. `CORS_ORIGIN` must match the web origin exactly |
| Contact shows name and email but no LinkedIn | Row predates the `linkedin` migration. Existing rows don't backfill — re-run that job's `POST /contacts` |
| Notes empty on a job you researched | Research is keyed by `jobId`; check the row actually points at this job |
| Resume button greyed out | `generated_content.tailoredResume` is null for this job. No content run yet |
| Resume button enabled, nothing downloads | Expected — no route serves the PDF bytes. The button generates the local `.txt` stub |
| No match line, no keyword chips | `jdMatchPercent` is `null` — no generation has run for this job yet |
| Regenerate fails immediately with a 400 | The job has no `jobs.jobDescription` saved. `PATCH /jobs/:id` one in, then retry |
| Regenerate fails with a 404 about "predates saved resume JSON" | This row was created before the JD-match feature shipped, so it has no `tailoredResumeJson`. Run `POST /generated-content` again for this job first |

---

## What isn't wired

**Every write path except one.** The add form creates a local row and never `POST`s it; Save commits the draft to React state and never `PATCH`es; edited contacts go nowhere. Reload the page and every edit is gone — including anything typed into the job description textarea.

**Regenerate Tailored Resume is the exception.** Clicking it, with at least one keyword checked, fires a real `POST /generated-content/regenerate` — [useRegenerateResume.ts](../web/src/hooks/useRegenerateResume.ts) owns the call, [RegenerateProgressModal.tsx](../web/src/components/job-assistance/RegenerateProgressModal.tsx) shows a four-stage progress popup for it, and the response's `tailoredResume`/`jdMatchPercent` get folded back into the open row on success. Two things worth knowing about it:
- **The progress stages are cosmetic**, the same way the job-setup pipeline's are — the backend is one POST with no event stream, so the stepper paces a plausible timeline rather than reporting real server progress. It holds at the last stage until the response actually lands.
- **Cancelling only aborts the browser's request.** The confirm-before-cancel dialog says so: the Claude calls already in flight on the server finish regardless, and the row is still updated when they do. There is no server-side cancellation.

The contacts table is **read-only by design**, not by omission: those rows are lookup results owned by the contacts endpoint and refreshed by re-running the lookup, so a hand correction would be overwritten on the next run.

**There is no resume download.** `generated_content.tailoredResume` is a *file name*, and no route serves the bytes. The button only reflects whether one exists; clicking it generates the local `.txt` stub. Serving the real PDF needs a `GET /generated-content/by-job/:jobId/resume` that `basename()`s the stored value before joining it to the storage root — the column's values are inconsistent (the service writes a bare filename, the seed stores `resumes/…`), so a raw `join()` there is a path-traversal sink.
