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
 * The one place that turns app requests into Perplexity searches. Talks to the
 * API only through the injected PerplexityClient (built in perplexity.provider),
 * exactly as ClaudeService talks to Claude only through the Anthropic client —
 * one seam per external system, so prompts/params and error mapping live here.
 *
 * Docs: https://docs.perplexity.ai/docs/search/quickstart
 */

/** A single web result returned by Perplexity. */
export interface PerplexitySearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Publication date (YYYY-MM-DD) if Perplexity could determine one. */
  date: string | null;
  /** Date the page was last updated (YYYY-MM-DD), if known. */
  last_updated: string | null;
}

/** Optional knobs for a search. Perplexity's own defaults apply when omitted. */
export interface PerplexitySearchOptions {
  /** How many results to return (1–20). Defaults to 10. */
  maxResults?: number;
  /** ISO 3166-1 alpha-2 country code to bias results, e.g. 'US'. */
  country?: string;
  /**
   * Restrict (or, with a leading '-', exclude) specific domains. Max 20.
   * e.g. ['techcrunch.com', '-pinterest.com'].
   */
  domains?: string[];
  /** How much page content Perplexity reads per result. Defaults to 'high'. */
  contextSize?: 'low' | 'medium' | 'high';
}

interface PerplexitySearchResponse {
  id: string;
  results: PerplexitySearchResult[];
  server_time: number | null;
}

@Injectable()
export class PerplexityService {
  private readonly logger = new Logger(PerplexityService.name);

  constructor(
    @Inject(PERPLEXITY_CLIENT) private readonly client: PerplexityClient,
  ) {}

  /**
   * Runs a web search and returns the matching results, most relevant first.
   * Pass a single query string, or an array of up to 5 queries to batch them.
   */
  async search(
    query: string | string[],
    options: PerplexitySearchOptions = {},
  ): Promise<PerplexitySearchResult[]> {
    const body: Record<string, unknown> = { query };
    if (options.maxResults !== undefined) body.max_results = options.maxResults;
    if (options.country) body.country = options.country;
    if (options.domains) body.search_domain_filter = options.domains;
    if (options.contextSize) body.search_context_size = options.contextSize;

    try {
      const data = await this.client.post<PerplexitySearchResponse>(
        'search',
        body,
      );
      return data.results ?? [];
    } catch (error) {
      if (error instanceof PerplexityApiError) {
        if (error.status === 429) {
          this.logger.warn('Perplexity rate limited the request');
          throw new ServiceUnavailableException(
            'Search service is busy, please try again shortly',
          );
        }
        this.logger.error(
          `Perplexity returned ${error.status}: ${error.body.slice(0, 500)}`,
        );
        throw new ServiceUnavailableException(
          'Search service returned an error',
        );
      }
      // Network-level failure (DNS, timeout, connection refused).
      this.logger.error('Perplexity request failed to send', error as Error);
      throw new ServiceUnavailableException(
        'Search service is unreachable, please try again shortly',
      );
    }
  }
}
