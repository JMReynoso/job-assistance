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
  /** Capital URL — the entity's spelling, not a typo. */
  jobPostingURL: string;
  companyPage: string;
  companyLinkedIn: string;
  extraURLs: string | null;
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
  jobPostingURL?: string;
  companyPage?: string;
  /** company_research.summary. */
  notes?: string;
  outreachMessage?: string;
  followupMessage?: string;
  /** The complete set of checked chips; [] unchecks everything. */
  includedKeywords?: string[];
}
