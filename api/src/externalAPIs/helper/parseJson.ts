import { Logger, ServiceUnavailableException } from '@nestjs/common';

const logger = new Logger('ParseJson');

/**
 * Pulls a JSON object out of a model's reply, whichever engine produced it.
 *
 * Claude usually wraps JSON in a ```json … ``` fence even when asked for raw
 * JSON. Local models go further: a sentence before or after it, or a leaked
 * <think> block inside the content. So drop the thinking, drop the fence, then
 * scan from the first '{' to its *true* closing brace — tracking strings and
 * escapes, so a '}' inside a value can't end the scan early — and parse that.
 *
 * Throws the same ServiceUnavailableException the Claude-only parser did, so
 * callers' error contracts are unchanged.
 */
export function extractJsonObject(
    raw: string,
    logLabel: string,
): Record<string, unknown> {
    const parsed = tryExtractJsonObject(raw);
    if (parsed) {
        return parsed;
    }

    logger.error(`${logLabel} returned malformed JSON: ${raw.slice(0, 200)}`);
    throw new ServiceUnavailableException(
        'AI service returned malformed data, please try again',
    );
}

/**
 * The same extraction, returning null instead of throwing — what a caller with
 * a repair-and-retry pass needs (see OllamaService.chatForJson).
 */
export function tryExtractJsonObject(
    raw: string,
): Record<string, unknown> | null {
    const text = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    const candidate = sliceOutermostObject(text) ?? text;

    try {
        const value: unknown = JSON.parse(candidate);
        // A bare array or string parses fine but isn't what any caller wants.
        return value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

/** The substring from the first '{' to its matching '}', or null if unbalanced. */
function sliceOutermostObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (inString && char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) {
            continue;
        }

        if (char === '{') {
            depth++;
        } else if (char === '}' && --depth === 0) {
            return text.slice(start, i + 1);
        }
    }

    return null;
}
