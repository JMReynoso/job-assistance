/**
 * The shapes the API actually puts on the wire.
 *
 * Hand-written mirrors of the backend entities. The API has no
 * ClassSerializerInterceptor and no response DTOs — controllers return TypeORM
 * entities and Fastify stringifies them as-is — so nullable columns arrive as
 * `null`, not as an absent key. Hence `| null` rather than `?` throughout.
 *
 * Token-accounting columns (`*Usage`, `*Cost`) are deliberately omitted: the
 * frontend has no use for them, and listing them invites someone to render them.
 */

export type ApiStatus =
  | "not_applied"
  | "applied"
  | "phone_screening"
  | "interviewing"
  | "offer"
  | "rejected"
  | "ghosted";

export interface ApiJob {
  id: number;
  companyName: string;
  jobPostingUrl: string;
  companyPageUrl: string;
  companyLinkedInUrl: string;
  extraUrls: string | null;
  status: ApiStatus;
  /** 'YYYY-MM-DD'. NOT NULL on the column — every job has one from creation. */
  dateApplied: string;
  dateLastContacted: string;
  jobDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMissingKeyword {
  id: number;
  keyword: string;
  include: boolean;
}

export interface ApiContact {
  id: number;
  jobId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  /** Only populated for contacts looked up after the linkedin migration. */
  linkedin: string | null;
  /** 0–100 deliverability score from Hunter. */
  confidence: number;
  type: "personal" | "generic";
  createdAt: string;
  updatedAt: string;
}

export interface ApiCompanyResearch {
  id: number;
  jobId: number;
  company: string;
  summary: string;
  urls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiGeneratedContent {
  id: number;
  jobId: number;
  outreachMessage: string | null;
  followupMessage: string | null;
  /** The PDF's file name, not its contents. No route serves the bytes yet. */
  tailoredResume: string | null;
  /** 0-100, or null when the resume hasn't been scored yet. */
  jdMatchPercent: number | null;
  missingKeywords: ApiMissingKeyword[];
  createdAt: string;
  updatedAt: string;
}

/**
 * The job detail window's Save payload — one PATCH across three tables.
 * Mirrors the API's UpdateJobDetailDto: every field optional, and an omitted
 * field means "leave this alone" rather than "clear it".
 */
export interface ApiJobDetailPatch {
  companyName?: string;
  status?: ApiStatus;
  dateApplied?: string;
  dateLastContacted?: string;
  jobPostingUrl?: string;
  companyPageUrl?: string;
  /** company_research.summary. */
  notes?: string;
  outreachMessage?: string;
  followupMessage?: string;
  /** The complete set of checked chips; [] unchecks everything. */
  includedKeywords?: string[];
}

/** Body for `POST /jobs`. Mirrors CreateJobDto. */
export interface ApiCreateJob {
  companyName: string;
  jobPostingUrl: string;
  companyPageUrl: string;
  companyLinkedInUrl: string;
  /**
   * A single URL — `jobs.extraUrls` is one `@IsUrl()` text column, unlike
   * ApiCreateCompanyResearch's same-named field, which is a list.
   */
  extraUrls?: string;
  jobDescription?: string;
}

/** Body for `POST /company-research`. Mirrors CreateCompanyResearchDto. */
export interface ApiCreateCompanyResearch {
  jobId: number;
  companyName: string;
  jobPostingUrl: string;
  companyPageUrl: string;
  companyLinkedInUrl: string;
  /** One URL per entry; the DTO validates each with `@IsUrl()`. */
  extraUrls?: string[];
}

/** Body for `POST /generated-content`. Mirrors CreateGeneratedContentDto. */
export interface ApiCreateGeneratedContent {
  jobId: number;
  /** The job posting *text*, not its URL — Claude can't open a link. */
  jobPosting: string;
  companyWebsite: string;
  companyName?: string;
}

/** Body for `POST /contacts` — a request to *run* a Hunter lookup. */
export interface ApiFindContacts {
  jobId: number;
  companyPageUrl: string;
  /** 1–100; each costs a Hunter credit. Omitted, the API uses 10. */
  limit?: number;
}
