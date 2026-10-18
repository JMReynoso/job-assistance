import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_BASE_URL } from './ollama.constants';

/**
 * Injection token + transport client for the Ollama HTTP API. Mirrors
 * perplexity.provider.ts: the client is built once, from config, in this one
 * place. Unlike Anthropic and Perplexity there is no key — Ollama is a process
 * on your own machine — so nothing here can fail for want of config.
 */
export const OLLAMA_CLIENT = Symbol('OLLAMA_CLIENT');

/** Thrown when Ollama replies with a non-2xx status. */
export class OllamaApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: string,
    ) {
        super(`Ollama API error ${status}`);
        this.name = 'OllamaApiError';
    }
}

export class OllamaClient {
    constructor(readonly baseUrl: string) {}

    /**
     * POSTs a JSON body and returns the parsed reply. Throws OllamaApiError on
     * a non-2xx; lets network errors and the TimeoutError bubble, so the
     * service can tell "Ollama said no" from "Ollama isn't running".
     */
    async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
        const response = await fetch(`${this.baseUrl}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
            throw new OllamaApiError(
                response.status,
                await response.text().catch(() => ''),
            );
        }

        return (await response.json()) as T;
    }
}

export const ollamaProvider: Provider = {
    provide: OLLAMA_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
        new OllamaClient(
            (config.get<string>('OLLAMA_BASE_URL') ?? DEFAULT_BASE_URL).replace(
                /\/+$/,
                '',
            ),
        ),
};
