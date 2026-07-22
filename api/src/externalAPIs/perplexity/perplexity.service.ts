import {
    Inject,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import {
    PERPLEXITY_CLIENT,
    PerplexityApiError,
    PerplexityClient,
} from './perplexity.provider';

/**
 * The one place that turns app requests into Perplexity Sonar research calls.
 * Talks to the API only through the injected PerplexityClient (built in
 * perplexity.provider), exactly as ClaudeService talks to Claude only through
 * the Anthropic client — one seam per external system, so prompts/params and
 * error mapping live here.
 *
 * `research()` fans out two focused Sonar Pro searches (one per angle below),
 * runs them in parallel, and returns a combined 5-bullets-per-angle `summary`
 * plus a merged/de-duped `urls` list.
 *
 * Docs: https://docs.perplexity.ai/api-reference/chat-completions-post
 */

/** Sonar model choices, cheapest/fastest → most thorough/slowest. */
export type PerplexityModel =
    'sonar' | 'sonar-pro' | 'sonar-reasoning-pro' | 'sonar-deep-research';

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
    /** How many of the angles surfaced this URL (1–3). Higher = more central. */
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
     * (company-product-funding, then eng-culture-stack), joined by
     * {@link SUMMARY_ANGLE_SEPARATOR}. This is what gets stored and later fed to a
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
     * this is the top-N). Caps how many pages flow into the merge — and, in turn,
     * downstream to Claude. Defaults to {@link DEFAULT_MAX_SOURCES_PER_ANGLE}.
     * `verifyUrls` are unaffected: they're still always present in the output.
     */
    maxSourcesPerAngle?: number;
    /**
     * Hard ceiling on each angle's written report length, in completion tokens
     * (the API's `max_tokens`). Combined with a "be concise" instruction so
     * reports usually stop naturally well under this. Lower = cheaper + shorter.
     * Defaults to {@link DEFAULT_MAX_TOKENS}.
     */
    maxTokens?: number;
    /** Abort each angle after this many ms. Defaults to 2 minutes. */
    timeoutMs?: number;
}

/** One research angle: a label for logs + the focus injected into the prompt. */
interface ResearchAngle {
    label: string;
    focus: string;
}

/** The two angles `research()` fans a company out into. */
const RESEARCH_ANGLES: ResearchAngle[] = [
    {
        label: 'company-product-funding',
        focus: 'what the company does and its mission, its main products, and its funding / financials',
    },
    {
        label: 'eng-culture-stack',
        focus: 'its engineering culture, the software / tech stack it uses, and its engineering blog',
    },
];

const RESEARCHER_SYSTEM =
    'You are a meticulous company researcher helping a software engineer prepare ' +
    'a job application. State only facts you can cite; if unsure, say so. Prefer ' +
    'primary sources (the company site, engineering blog, reputable news).';

/**
 * Default per-angle source cap. Two angles → at most this many × 2 sources
 * before de-duping, keeping the stored `urls` list bounded.
 */
const DEFAULT_MAX_SOURCES_PER_ANGLE = 10;

/**
 * Default hard ceiling on each angle's summary length (completion tokens). Each
 * angle returns a 5-bullet summary, so this bounds worst-case output cost while
 * leaving the bullets room to breathe.
 */
const DEFAULT_MAX_TOKENS = 1500;

/**
 * Joins the two angles' summaries into the single `summary` field: four newlines,
 * a 10-dash rule, four newlines. Used only *between* angles — not before the
 * first or after the last.
 */
const SUMMARY_ANGLE_SEPARATOR = '\n\n\n\n----------\n\n\n\n';

interface SonarUsage {
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

interface SonarResponse {
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
interface AngleResult {
    angle: string;
    content: string;
    sources: PerplexitySource[];
    usage?: SonarUsage;
}

@Injectable()
export class PerplexityService {
    private readonly logger = new Logger(PerplexityService.name);

    constructor(
        @Inject(PERPLEXITY_CLIENT) private readonly client: PerplexityClient,
    ) {}

    /**
     * Researches a company across two angles (company/product/funding and
     * engineering culture/stack) with parallel Sonar Pro calls. Each angle returns
     * a 5-bullet summary; the two are combined into one `summary` block, and the
     * angles' sources are merged into one deduped, ranked `urls` list.
     */
    async research(
        company: string,
        options: CompanyResearchOptions = {},
    ): Promise<CompanyResearchResult> {
        const system = options.system ?? RESEARCHER_SYSTEM;

        // De-dupe the trusted anchors up front so no angle is ever asked to crawl
        // the same page twice, then thread the cleaned list through every angle and
        // the source merge so both see the exact same set.
        const verifyUrls = this.dedupeUrls(options.verifyUrls);
        const opts: CompanyResearchOptions = { ...options, verifyUrls };

        const settled = await Promise.allSettled(
            RESEARCH_ANGLES.map((angle) =>
                this.runAngle(company, angle, system, opts),
            ),
        );

        const fulfilled = settled
            .filter(
                (s): s is PromiseFulfilledResult<AngleResult> =>
                    s.status === 'fulfilled',
            )
            .map((s) => s.value);

        // Log any angle that failed, but don't sink the whole run over one miss.
        settled.forEach((s, i) => {
            if (s.status === 'rejected') {
                this.logger.warn(
                    `Perplexity angle "${RESEARCH_ANGLES[i].label}" failed: ${String(s.reason)}`,
                );
            }
        });

        if (fulfilled.length === 0) {
            // All three failed — surface the first failure as a clean HTTP error.
            const firstRejection = settled.find(
                (s): s is PromiseRejectedResult => s.status === 'rejected',
            );

            throw this.toServiceError(firstRejection?.reason);
        }

        const sources = this.mergeSources(fulfilled, verifyUrls);
        const usage = this.aggregateUsage(fulfilled);

        // Combine the angles' summaries in angle order, dropping any empty ones so
        // we never emit a bare separator with nothing around it.
        const summary = fulfilled
            .map((r) => r.content.trim())
            .filter(Boolean)
            .join(SUMMARY_ANGLE_SEPARATOR);

        this.logger.log(
            `Perplexity company research "${company}" — angles=${fulfilled.length}/${RESEARCH_ANGLES.length} ` +
                `sources=${sources.length} cost=$${usage.totalCost.toFixed(4)}`,
        );

        return {
            summary,
            urls: sources.map((s) => s.url),
            usage,
        };
    }

    /** Runs a single Sonar call for one angle and returns its raw result. */
    private async runAngle(
        company: string,
        angle: ResearchAngle,
        system: string,
        options: CompanyResearchOptions,
    ): Promise<AngleResult> {
        // Trusted anchors go in the prompt (not the domain filter) so research
        // stays broad while the model still cross-checks against them.
        const verify = options.verifyUrls?.length
            ? ` Cross-check your findings against these official company pages and flag ` +
              `any discrepancies: ${options.verifyUrls.join(', ')}.`
            : '';

        const body: Record<string, unknown> = {
            model: options.model ?? 'sonar-pro',
            // Cap the report length. A hard ceiling on completion tokens keeps
            // worst-case output cost bounded; the prompt asks for a concise
            // report so it normally stops well below this.
            max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
            web_search_options: {
                search_context_size: options.contextSize ?? 'medium',
            },
            messages: [
                { role: 'system', content: system },
                {
                    role: 'user',
                    content:
                        `Research ${company} for a software engineer preparing to apply. ` +
                        `Focus on ${angle.focus}. Summarize your findings as EXACTLY 5 very detailed ` +
                        `bullet points — specific, citable facts over prose. ` +
                        `verify your findings against the following URLs to reduce inaccuracies: ` +
                        verify,
                },
            ],
        };
        if (options.domains) body.search_domain_filter = options.domains;
        if (options.recency) body.search_recency_filter = options.recency;

        const data = await this.client.post<SonarResponse>(
            // '/chat/completions' is the OpenAI-compatible alias of '/v1/sonar'.
            'chat/completions',
            body,
            options.timeoutMs ?? 120_000,
        );
        this.logUsage(data.model, data.usage, angle.label);

        // Sonar returns sources ranked by relevance, so slicing keeps the best
        // ones. This is the only real lever on source count — the API has no
        // "max citations" knob — and it bounds what flows into the merge.
        const cap = options.maxSourcesPerAngle ?? DEFAULT_MAX_SOURCES_PER_ANGLE;

        return {
            angle: angle.label,
            content: data.choices[0]?.message?.content ?? '',
            sources: (data.search_results ?? []).slice(0, cap),
            usage: data.usage,
        };
    }

    /**
     * Merges every angle's sources into one list: de-dupes by normalized URL,
     * counts how many angles cited each (`hits`), and ranks by hits then by the
     * best position any angle gave it.
     *
     * Any `verifyUrls` the caller passed are folded in too: if an angle already
     * cited one it's just flagged `verified`; otherwise it's appended as a
     * `hits: 0` source so the trusted anchor is always present in the output
     * (and in the derived `urls`), even when no angle happened to surface it.
     */
    private mergeSources(
        results: AngleResult[],
        verifyUrls: string[] = [],
    ): RankedSource[] {
        const merged = new Map<string, RankedSource>();
        const bestPos = new Map<string, number>();

        for (const result of results) {
            result.sources.forEach((src, index) => {
                const key = this.dedupeKey(src.url);
                const existing = merged.get(key);
                if (existing) {
                    existing.hits += 1;
                    if (!existing.snippet && src.snippet)
                        existing.snippet = src.snippet;
                    bestPos.set(
                        key,
                        Math.min(bestPos.get(key) ?? index, index),
                    );
                } else {
                    merged.set(key, { ...src, hits: 1 });
                    bestPos.set(key, index);
                }
            });
        }

        for (const url of verifyUrls) {
            const key = this.dedupeKey(url);
            const existing = merged.get(key);
            if (existing) {
                existing.verified = true;
            } else {
                merged.set(key, {
                    title: this.hostnameOf(url),
                    url,
                    date: null,
                    last_updated: null,
                    hits: 0,
                    verified: true,
                });
                // No angle cited it, so it has no natural position — sort it last
                // among any hits:0 ties.
                bestPos.set(key, Number.MAX_SAFE_INTEGER);
            }
        }

        return [...merged.entries()]
            .sort(
                ([ka, a], [kb, b]) =>
                    b.hits - a.hits ||
                    (bestPos.get(ka) ?? 0) - (bestPos.get(kb) ?? 0),
            )
            .map(([, source]) => source);
    }

    /**
     * De-dupes a list of URLs by normalized identity (same page = same crawl),
     * preserving order and the original URL string of the first occurrence.
     * Blank entries are dropped. Uses the same {@link dedupeKey} as the source
     * merge, so '/about', '/about/' and '/about#team' collapse to one crawl.
     */
    private dedupeUrls(urls: string[] = []): string[] {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const url of urls) {
            if (!url?.trim()) continue;
            const key = this.dedupeKey(url);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(url);
        }
        return out;
    }

    /** Best-effort display title for a bare URL: its hostname, else the URL. */
    private hostnameOf(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return url.trim();
        }
    }

    /**
     * Normalizes a URL for de-duplication: drops the fragment and any trailing
     * slash and lowercases it, so '/about', '/about/' and '/about#team' collapse.
     * Only the grouping key is normalized — the original URL is kept for output.
     */
    private dedupeKey(url: string): string {
        try {
            const parsed = new URL(url);
            parsed.hash = '';
            parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
            return parsed.toString().toLowerCase();
        } catch {
            return url.trim().toLowerCase();
        }
    }

    /** Sums token counts and Perplexity's reported cost across the angle calls. */
    private aggregateUsage(
        results: AngleResult[],
    ): CompanyResearchResult['usage'] {
        return results.reduce(
            (acc, { usage }) => {
                if (usage) {
                    acc.totalCost += usage.cost?.total_cost ?? 0;
                    acc.searches += usage.num_search_queries ?? 0;
                    acc.promptTokens += usage.prompt_tokens ?? 0;
                    acc.completionTokens += usage.completion_tokens ?? 0;
                }
                return acc;
            },
            { totalCost: 0, searches: 0, promptTokens: 0, completionTokens: 0 },
        );
    }

    /** Maps a raw Sonar failure to a clean HTTP error (used when all angles fail). */
    private toServiceError(error: unknown): ServiceUnavailableException {
        if (error instanceof PerplexityApiError) {
            if (error.status === 429) {
                this.logger.warn('Perplexity rate limited the request');
                return new ServiceUnavailableException(
                    'Research service is busy, please try again shortly',
                );
            }
            this.logger.error(
                `Perplexity returned ${error.status}: ${error.body.slice(0, 500)}`,
            );
            return new ServiceUnavailableException(
                'Research service returned an error',
            );
        }
        if (
            error instanceof Error &&
            (error.name === 'TimeoutError' || error.name === 'AbortError')
        ) {
            this.logger.error('Perplexity research request timed out');
            return new ServiceUnavailableException(
                'Research is taking too long, please try again',
            );
        }
        this.logger.error('Perplexity request failed to send', error as Error);
        return new ServiceUnavailableException(
            'Research service is unreachable, please try again shortly',
        );
    }

    /**
     * Emits a one-line record of what an angle call consumed and cost. Perplexity
     * reports the billed amount directly in `usage.cost.total_cost`, so this logs
     * the real charge (no rate math) plus the token/search counts behind it.
     */
    private logUsage(
        model: string,
        usage: SonarUsage | undefined,
        angle: string,
    ): void {
        if (!usage) return;

        const parts = [
            `angle=${angle}`,
            `model=${model}`,
            `searches=${usage.num_search_queries ?? 0}`,
            `prompt=${usage.prompt_tokens}`,
            `completion=${usage.completion_tokens}`,
        ];
        if (usage.reasoning_tokens)
            parts.push(`reasoning=${usage.reasoning_tokens}`);
        if (usage.citation_tokens)
            parts.push(`citation=${usage.citation_tokens}`);

        const cost = usage.cost?.total_cost;
        parts.push(
            cost !== undefined ? `cost=$${cost.toFixed(4)}` : 'cost=n/a',
        );

        this.logger.log(`Perplexity usage — ${parts.join(' ')}`);
    }
}
