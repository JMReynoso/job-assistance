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
    jobPostingUrl: "https://boards.greenhouse.io/willowoak/jobs/1",
    companyPageUrl: "https://willowoak.co",
    companyLinkedInUrl: "https://www.linkedin.com/company/willowoak",
    extraUrls: null,
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
    provider: "claude",
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
  /** Response for POST /jobs; the posted body is echoed over it. */
  createdJob?: ApiJob;
  /**
   * Substring of a path that should fail, e.g. "/jobs" or "/contacts",
   * optionally prefixed with an HTTP method: "GET /detail" fails only the
   * Job Detail load, "PATCH /detail" only the save. A bare path matches any
   * method — so a bare "/detail" fails the load *and* the save, which is
   * rarely what a test means.
   */
  failOn?: string;
  /** Status for the failing route; 0 simulates never reaching the server. */
  failStatus?: number;
  /**
   * Substring of a path whose request never settles — for testing cancel.
   * Takes the same optional method prefix as {@link MockApiOptions.failOn}.
   */
  hangOn?: string;
}

const METHOD_PREFIX = /^(GET|POST|PATCH|PUT|DELETE) (.+)$/;

/**
 * Whether a failOn / hangOn option targets this request. "GET /detail" must
 * match on method and path; a bare "/detail" matches the path under any method.
 */
function targets(option: string | undefined, method: string, url: string): boolean {
  if (!option) return false;
  const prefixed = METHOD_PREFIX.exec(option);
  return prefixed ? method === prefixed[1] && url.includes(prefixed[2]) : url.includes(option);
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
    createdJob = buildApiJob({ id: 99 }),
    failOn,
    failStatus = 500,
    hangOn,
  } = options;

  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (targets(failOn, method, url)) {
      if (failStatus === 0) throw new TypeError("Failed to fetch");
      return { ok: false, status: failStatus, json: async () => ({}) } as Response;
    }

    if (targets(hangOn, method, url)) return new Promise<Response>(() => {});

    const sent = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    if (url.includes("/generated-content/regenerate")) {
      return { ok: true, status: 201, json: async () => regenerate } as Response;
    }

    if (method === "POST") {
      const jobId = Number(sent.jobId);
      if (url.endsWith("/jobs")) {
        return { ok: true, status: 201, json: async () => ({ ...createdJob, ...sent }) } as Response;
      }
      if (url.endsWith("/company-research")) {
        const row = resolveByJob(research, jobId) ?? buildApiCompanyResearch({ jobId });
        return { ok: true, status: 201, json: async () => row } as Response;
      }
      if (url.endsWith("/generated-content")) {
        const row = resolveByJob(content, jobId) ?? buildApiGeneratedContent({ jobId });
        return { ok: true, status: 201, json: async () => row } as Response;
      }
      if (url.endsWith("/contacts")) {
        return { ok: true, status: 201, json: async () => resolveByJob(contacts, jobId) } as Response;
      }
    }

    if (method === "DELETE") {
      return { ok: true, status: 204, json: async () => null } as Response;
    }

    const detailMatch = url.match(/\/jobs\/(\d+)\/detail$/);
    if (detailMatch) {
      const jobId = Number(detailMatch[1]);

      // Look the row up by id rather than always answering with jobs[0] —
      // otherwise opening the second row merges in the first row's company.
      const detailFor = (patch: Record<string, unknown>) => {
        const base = jobs.find((j) => j.id === jobId) ?? jobs[0];
        const res = resolveByJob(research, jobId);
        const gen = resolveByJob(content, jobId);
        const { notes, outreachMessage, followupMessage, includedKeywords, ...jobFields } = patch;

        return {
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
        };
      };

      // GET is the open: the fixtures as they stand. PATCH is the save: the
      // same fixtures with the posted edits applied, as the server echoes them.
      const detail = method === "PATCH" ? detailFor(sent) : detailFor({});
      return { ok: true, status: 200, json: async () => detail } as Response;
    }

    return { ok: true, status: 200, json: async () => jobs } as Response;
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
