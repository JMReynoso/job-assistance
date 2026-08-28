import type {
  ApiCompanyResearch,
  ApiContact,
  ApiGeneratedContent,
  ApiJob,
  ApiMissingKeyword,
} from "@/lib/api/types";

/**
 * Canonical builders for the shapes the API puts on the wire, mirroring
 * jobs.mock.ts's one-builder-per-shape philosophy: a field rename only has to
 * be fixed here.
 */

export function buildApiJob(overrides: Partial<ApiJob> = {}): ApiJob {
  return {
    id: 1,
    companyName: "Willow & Oak",
    jobPostingURL: "https://boards.greenhouse.io/willowoak/jobs/1",
    companyPage: "https://willowoak.co",
    companyLinkedIn: "https://www.linkedin.com/company/willowoak",
    extraURLs: null,
    status: "applied",
    dateApplied: "2026-07-03",
    dateLastContacted: "2026-07-09",
    jobDescription: "We are looking for a Senior Backend Engineer with Node.js…",
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-09T10:00:00.000Z",
    ...overrides,
  };
}

export function buildApiMissingKeyword(overrides: Partial<ApiMissingKeyword> = {}): ApiMissingKeyword {
  return {
    id: 41,
    keyword: "Kubernetes",
    include: false,
    ...overrides,
  };
}

export function buildApiContact(overrides: Partial<ApiContact> = {}): ApiContact {
  return {
    id: 11,
    jobId: 1,
    email: "dana@willowoak.co",
    firstName: "Dana",
    lastName: "Reyes",
    position: "Recruiter",
    linkedin: "linkedin.com/in/danareyes",
    confidence: 94,
    type: "personal",
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-03T10:00:00.000Z",
    ...overrides,
  };
}

export function buildApiCompanyResearch(
  overrides: Partial<ApiCompanyResearch> = {},
): ApiCompanyResearch {
  return {
    id: 21,
    jobId: 1,
    company: "Willow & Oak",
    summary: "Founded 2011, roughly 400 staff.",
    urls: ["https://willowoak.co"],
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-03T10:00:00.000Z",
    ...overrides,
  };
}

export function buildApiGeneratedContent(
  overrides: Partial<ApiGeneratedContent> = {},
): ApiGeneratedContent {
  return {
    id: 31,
    jobId: 1,
    outreachMessage: "Hi Dana, following up on...",
    followupMessage: "Just checking in...",
    tailoredResume: "Jane_Doe_Willow_Oak_1.pdf",
    jdMatchPercent: 72,
    missingKeywords: [buildApiMissingKeyword()],
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-03T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * A by-job response: either one value used for every job, or a function of the
 * jobId when a test needs each job to answer differently.
 */
type ByJob<T> = T | ((jobId: number) => T);

function resolveByJob<T>(value: ByJob<T>, jobId: number): T {
  return typeof value === "function" ? (value as (id: number) => T)(jobId) : value;
}

export interface MockApiOptions {
  jobs?: ApiJob[];
  contacts?: ByJob<ApiContact[]>;
  research?: ByJob<ApiCompanyResearch | null>;
  content?: ByJob<ApiGeneratedContent | null>;
  /** Response for POST /generated-content/regenerate. */
  regenerate?: ApiGeneratedContent;
  /**
   * Substring of a path that should fail, e.g. "/jobs" or "/contacts". Use
   * "/detail" to force PATCH /jobs/:id/detail specifically without also
   * failing the plain GET /jobs/:id fetch.
   */
  failOn?: string;
  /** Status for the failing route; 0 simulates never reaching the server. */
  failStatus?: number;
}

/**
 * Installs a `global.fetch` stub that routes on URL path. Returns the mock so
 * tests can assert on call counts and ordering.
 */
export function mockApi(options: MockApiOptions = {}): jest.Mock {
  const {
    jobs = [buildApiJob()],
    contacts = [buildApiContact()],
    research = buildApiCompanyResearch(),
    content = buildApiGeneratedContent(),
    regenerate = buildApiGeneratedContent({ jdMatchPercent: 88 }),
    failOn,
    failStatus = 500,
  } = options;

  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (failOn && url.includes(failOn)) {
      if (failStatus === 0) throw new TypeError("Failed to fetch");
      return { ok: false, status: failStatus, json: async () => ({}) } as Response;
    }

    if (url.includes("/generated-content/regenerate")) {
      return { ok: true, status: 201, json: async () => regenerate } as Response;
    }

    const detailMatch = url.match(/\/jobs\/(\d+)\/detail$/);
    if (detailMatch) {
      const jobId = Number(detailMatch[1]);
      const patch = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const base = jobs.find((j) => j.id === jobId) ?? jobs[0];
      const res = resolveByJob(research, jobId);
      const gen = resolveByJob(content, jobId);
      const { notes, outreachMessage, followupMessage, includedKeywords, ...jobFields } = patch;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          job: { ...base, ...jobFields },
          contacts: resolveByJob(contacts, jobId),
          research: res && notes !== undefined ? { ...res, summary: notes } : res,
          content:
            gen &&
            {
              ...gen,
              ...(outreachMessage !== undefined ? { outreachMessage } : {}),
              ...(followupMessage !== undefined ? { followupMessage } : {}),
              missingKeywords: gen.missingKeywords.map((k) => ({
                ...k,
                include: Array.isArray(includedKeywords)
                  ? includedKeywords.includes(k.keyword)
                  : k.include,
              })),
            },
        }),
      } as Response;
    }

    // Every by-job route ends in the job id, so one parse serves all three.
    const jobId = Number(url.slice(url.lastIndexOf("/") + 1));

    const body = (() => {
      if (url.includes("/contacts/by-job/")) return resolveByJob(contacts, jobId);
      if (url.includes("/company-research/by-job/")) return resolveByJob(research, jobId);
      if (url.includes("/generated-content/by-job/")) return resolveByJob(content, jobId);
      // Order matters: the by-job paths above also contain "/jobs" in the
      // base URL only, so this is safe as the fallthrough. Look the row up by
      // id rather than always answering with jobs[0] — otherwise opening the
      // second row merges in the first row's company.
      if (url.match(/\/jobs\/\d+$/)) return jobs.find((j) => j.id === jobId) ?? jobs[0];
      return jobs;
    })();

    return { ok: true, status: 200, json: async () => body } as Response;
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
