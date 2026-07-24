import Anthropic from '@anthropic-ai/sdk';

/**
 * Per-call cost estimation for Claude API usage, in USD.
 *
 * The API splits token counts across buckets that bill at different rates:
 * fresh input at the base rate, cache reads at 0.1x, cache writes at 1.25x
 * (5-minute TTL) or 2x (1-hour TTL), and output — which already includes
 * thinking tokens — at the output rate. All rates are USD per 1,000,000 tokens.
 * Keep these in sync with https://platform.claude.com/docs/en/pricing.
 */

/** USD per 1,000,000 tokens. */
interface ModelRates {
    input: number;
    output: number;
}

// Cache pricing multipliers, relative to the model's base input rate.
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_5M_MULTIPLIER = 1.25;
const CACHE_WRITE_1H_MULTIPLIER = 2;

// Claude Sonnet 5 launched with introductory pricing through 2026-08-31;
// standard rates apply from 2026-09-01 onward.
const SONNET_5_INTRO_END = new Date('2026-09-01T00:00:00Z');
const SONNET_5_INTRO: ModelRates = { input: 2, output: 10 };
const SONNET_5_STANDARD: ModelRates = { input: 3, output: 15 };

/**
 * Effective per-1M-token rates for a model, or undefined if the model isn't
 * priced here. Add a case whenever a new model is introduced — an unpriced
 * model yields a cost of 0 (see {@link costFromUsage}) so a missing rate never
 * fails an already-successful, already-billed generation.
 */
function ratesFor(model: string, now: Date): ModelRates | undefined {
    switch (model) {
        case 'claude-opus-4-8':
            return { input: 5, output: 25 };
        case 'claude-sonnet-5':
            return now < SONNET_5_INTRO_END
                ? SONNET_5_INTRO
                : SONNET_5_STANDARD;
        default:
            return undefined;
    }
}

/**
 * Estimates the USD cost of a single Claude call from its usage block. Returns
 * full precision (costs are fractions of a cent) — round only for display.
 */
export function costFromUsage(
    model: string,
    usage: Anthropic.Message['usage'],
    now: Date = new Date(),
): number {
    const rates = ratesFor(model, now);
    if (!rates) {
        return 0;
    }

    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const cacheWrite5mTokens =
        usage.cache_creation?.ephemeral_5m_input_tokens ?? 0;
    const cacheWrite1hTokens =
        usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;

    const inputCost =
        usage.input_tokens * rates.input +
        cacheReadTokens * rates.input * CACHE_READ_MULTIPLIER +
        cacheWrite5mTokens * rates.input * CACHE_WRITE_5M_MULTIPLIER +
        cacheWrite1hTokens * rates.input * CACHE_WRITE_1H_MULTIPLIER;

    // output_tokens already includes thinking tokens — don't add them again.
    const outputCost = usage.output_tokens * rates.output;

    return (inputCost + outputCost) / 1_000_000;
}
