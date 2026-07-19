import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Injection token + transport client for the Hunter.io API. Mirrors
 * anthropic.provider.ts: the client is built once, from config, in this single
 * place, and HunterService injects it via the token below. Unlike Anthropic
 * there's no npm SDK, so the thin `fetch` wrapper lives here too.
 *
 * Prefer injecting HunterService over this token directly — the raw client is
 * only exposed so it's constructed once, from config, in a single place.
 */
export const HUNTER_CLIENT = Symbol('HUNTER_CLIENT');

/** Thrown when Hunter replies with a non-2xx status. */
export class HunterApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: string,
    ) {
        super(`Hunter API error ${status}`);
        this.name = 'HunterApiError';
    }
}

/** Thin transport wrapper around the Hunter.io HTTP API (the SDK we don't have). */
export class HunterClient {
    private readonly baseUrl = 'https://api.hunter.io/v2';

    constructor(private readonly apiKey: string) {}

    /**
     * GETs the given path with the supplied query params, appends the API key,
     * and returns Hunter's unwrapped `data` payload. Throws HunterApiError on a
     * non-2xx reply; lets network errors bubble.
     */
    async get<T>(path: string, params: URLSearchParams): Promise<T> {
        // Appended last and never logged, so the key can't leak into logs.
        params.set('api_key', this.apiKey);

        const response = await fetch(
            `${this.baseUrl}/${path}?${params.toString()}`,
        );

        if (!response.ok) {
            throw new HunterApiError(
                response.status,
                await response.text().catch(() => ''),
            );
        }

        const body = (await response.json()) as { data: T };
        return body.data;
    }
}

export const hunterProvider: Provider = {
    provide: HUNTER_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
        // Throws when this module is first loaded if the key is missing, so a
        // misconfigured deployment fails fast rather than on the first request.
        new HunterClient(config.getOrThrow<string>('HUNTER_API_KEY')),
};
