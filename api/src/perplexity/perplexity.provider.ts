import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Injection token + transport client for the Perplexity Search API. Mirrors
 * anthropic.provider.ts: the client is built once, from config, in this single
 * place, and PerplexityService injects it via the token below. Unlike Anthropic
 * there's no npm SDK, so the thin `fetch` wrapper lives here too.
 *
 * Prefer injecting PerplexityService over this token directly — the raw client
 * is only exposed so it's constructed once, from config, in a single place.
 */
export const PERPLEXITY_CLIENT = Symbol('PERPLEXITY_CLIENT');

/** Thrown when Perplexity replies with a non-2xx status. */
export class PerplexityApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Perplexity API error ${status}`);
    this.name = 'PerplexityApiError';
  }
}

/** Thin transport wrapper around the Perplexity HTTP API (the SDK we don't have). */
export class PerplexityClient {
  private readonly baseUrl = 'https://api.perplexity.ai';

  constructor(private readonly apiKey: string) {}

  /**
   * POSTs a JSON body to the given path and returns the parsed response.
   * Throws PerplexityApiError on a non-2xx reply; lets network errors (and the
   * TimeoutError from `timeoutMs`) bubble so the service can tell "API said no"
   * from "couldn't reach the API" apart. `timeoutMs` matters for the slow
   * sonar-deep-research model, whose calls can run for minutes.
   */
  async post<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });

    if (!response.ok) {
      throw new PerplexityApiError(
        response.status,
        await response.text().catch(() => ''),
      );
    }

    return (await response.json()) as T;
  }
}

export const perplexityProvider: Provider = {
  provide: PERPLEXITY_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    // Throws when this module is first loaded if the key is missing, so a
    // misconfigured deployment fails fast rather than on the first request.
    new PerplexityClient(config.getOrThrow<string>('PERPLEXITY_API_KEY')),
};
