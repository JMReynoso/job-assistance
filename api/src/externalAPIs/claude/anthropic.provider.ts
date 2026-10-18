import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Injection token for the shared Anthropic SDK client. Prefer injecting
 * ClaudeService over this token directly — the raw client is only exposed so
 * the SDK is constructed once, from config, in a single place.
 */
export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

export const anthropicProvider: Provider = {
    provide: ANTHROPIC_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService): Anthropic | null => {
        const apiKey = config.get<string>('ANTHROPIC_API_KEY');
        // Null rather than a throw. This module loads unconditionally, so
        // throwing here stops an Ollama-only setup from booting at all.
        // ClaudeService turns the null into a clear error on first use —
        // fail-fast moves from boot to the moment it actually matters.
        return apiKey ? new Anthropic({ apiKey }) : null;
    },
};
