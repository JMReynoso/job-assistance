/**
 * Config defaults and per-call tuning for the local engine. The prompts are
 * shared (../ai/prompts.constants.ts); only the knobs that exist *because*
 * this model runs on your machine live here.
 */

/** Any pulled tag works — override with OLLAMA_MODEL. */
export const DEFAULT_MODEL = 'qwen3.5:27b';

/**
 * The host's Ollama as seen from inside the dev container. Running the API
 * outside Docker? Set OLLAMA_BASE_URL=http://localhost:11434.
 */
export const DEFAULT_BASE_URL = 'http://host.docker.internal:11434';

/**
 * Context window, in tokens. THE setting to get right: Ollama's own default is
 * small, and anything past it is silently truncated — you get a plausible
 * resume tailored against half a job description, with no error anywhere. The
 * master CV + job description + company summary comfortably exceed 8k.
 */
export const RESUME_NUM_CTX = 32768;
export const MESSAGE_NUM_CTX = 8192;

/** Output ceilings — the local equivalent of Claude's max_tokens. */
export const MESSAGE_NUM_PREDICT = 1200;
export const RESUME_NUM_PREDICT = 12000;
export const MATCH_NUM_PREDICT = 2000;

/** Low but not zero: JSON wants determinism, a warm message wants some life. */
export const JSON_TEMPERATURE = 0.2;
export const MESSAGE_TEMPERATURE = 0.7;

/** Local generation is slow — a 27B model drafting a full resume is minutes. */
export const RESUME_TIMEOUT_MS = 900_000; // 15 min
export const MESSAGE_TIMEOUT_MS = 300_000; // 5 min

/** Unloading is a tiny request; it should never hold a response open. */
export const RELEASE_TIMEOUT_MS = 30_000;

/**
 * How long Ollama keeps the model resident after a call. Deliberately short:
 * just enough to bridge the gaps between the four sequential calls of one run,
 * so the weights load once instead of four times. We don't wait this out —
 * release() unloads explicitly the moment the run ends.
 */
export const KEEP_ALIVE = '5m';

/**
 * The JD-match shape. Ollama compiles a JSON schema into a decoding grammar,
 * so an off-shape reply is impossible rather than merely unlikely — the local
 * equivalent of Claude's output_config.format, and the same schema it sends.
 */
export const MATCH_SCHEMA = {
    type: 'object',
    properties: {
        matchPercent: { type: 'integer', minimum: 0, maximum: 100 },
        missingKeywords: { type: 'array', items: { type: 'string' } },
    },
    required: ['matchPercent', 'missingKeywords'],
    additionalProperties: false,
};
