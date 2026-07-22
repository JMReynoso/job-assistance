/**
 * Types for PerplexityService: the public result/option shapes and the internal
 * Sonar request/response shapes. Tuning constants live in perplexity.constants.ts.
 */

/** Sonar model choices, cheapest/fastest → most thorough/slowest. */
export type PerplexityModel =
    | 'sonar'
    | 'sonar-pro'
    | 'sonar-reasoning-pro'
    | 'sonar-deep-research';

/** A source Perplexity consulted while researching. */
export interface PerplexitySource {
    title: string;
    url: string;
    date: string | null;
    last_updated: string | null;
    snippet?: string;
}

/** A source merged across the research angles, with a relevance signal. */
export interface RankedSource extends PerplexitySource {
    /** How many of the angles surfaced this URL (1–2). Higher = more central. */
    hits: number;
    /**
     * True when this URL is one of the caller's `verifyUrls` — a trusted anchor
     * (company site, LinkedIn, job posting) they passed in. Set whether or not an
     * angle independently cited it, so consumers can weight these higher.
     */
    verified?: boolean;
}

/** The result of researching one company across both angles. */
export interface CompanyResearchResult {
    /**
     * The two angles' 5-bullet summaries combined into one block, in angle order
     * (company-product-funding, then eng-culture-stack), joined by the
     * SUMMARY_ANGLE_SEPARATOR constant. This is what gets stored and later fed to a
     * message-drafting model (Claude / Ollama).
     */
    summary: string;
    /** Deduped source URLs across both angles, in ranked order. */
    urls: string[];
    /** Combined usage/cost across the angle calls. */
    usage: {
        totalCost: number;
        searches: number;
        promptTokens: number;
        completionTokens: number;
    };
}

/** Optional knobs for a research call. Sensible defaults apply when omitted. */
export interface CompanyResearchOptions {
    /** Which Sonar model each angle uses. Defaults to 'sonar-pro'. */
    model?: PerplexityModel;
    /** Override the default researcher persona / rules. */
    system?: string;
    /**
     * Restrict (or, with a leading '-', exclude) specific domains. Max 20.
     * Applied to every angle.
     */
    domains?: string[];
    /** Only consider pages newer than this window. */
    recency?: 'hour' | 'day' | 'week' | 'month' | 'year';
    /** Search context depth per angle. Defaults to 'medium'. */
    contextSize?: 'low' | 'medium' | 'high';
    /**
     * Official company URLs (site, LinkedIn, etc.) to verify findings against.
     * Injected into each angle's prompt so the model cross-checks its claims and
     * flags discrepancies. Unlike `domains`, this does NOT restrict the search —
     * research stays broad, these are just trusted anchors.
     */
    verifyUrls?: string[];
    /**
     * Keep at most this many sources from EACH angle (they come back ranked, so
     * this is the top-N). Caps how many URLs flow into the merge. Defaults to the
     * DEFAULT_MAX_SOURCES_PER_ANGLE constant. `verifyUrls` are unaffected: they're
     * still always present in the output.
     */
    maxSourcesPerAngle?: number;
    /**
     * Hard ceiling on each angle's summary length, in completion tokens (the API's
     * `max_tokens`). Each angle returns 5 bullet points, so this bounds worst-case
     * output cost. Lower = cheaper + shorter. Defaults to the DEFAULT_MAX_TOKENS
     * constant.
     */
    maxTokens?: number;
    /** Abort each angle after this many ms. Defaults to 2 minutes. */
    timeoutMs?: number;
}

/** One research angle: a label for logs + the focus injected into the prompt. */
export interface ResearchAngle {
    label: string;
    focus: string;
}

/** Perplexity's per-call usage/cost block, as returned by the Sonar API. */
export interface SonarUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
    citation_tokens?: number;
    num_search_queries?: number;
    search_context_size?: string;
    cost?: {
        input_tokens_cost: number;
        output_tokens_cost: number;
        reasoning_tokens_cost: number;
        request_cost: number;
        citation_tokens_cost: number;
        search_queries_cost: number;
        total_cost: number;
    };
}

/** The shape of a Sonar `chat/completions` response we read from. */
export interface SonarResponse {
    id: string;
    model: string;
    choices: {
        index: number;
        finish_reason: string;
        message: { role: string; content: string };
    }[];
    citations?: string[];
    search_results?: PerplexitySource[];
    usage?: SonarUsage;
}

/** One angle's raw result before merging. */
export interface AngleResult {
    angle: string;
    content: string;
    sources: PerplexitySource[];
    usage?: SonarUsage;
}
