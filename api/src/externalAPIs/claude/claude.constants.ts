/**
 * Which Claude model runs which call. The prompts they run moved to
 * ../ai/prompts.constants.ts when Ollama became a real second engine.
 */

/** Message drafting — a short, warm message doesn't need the top-tier model. */
export const MESSAGE_MODEL = 'claude-sonnet-5';

/** The resume draft: rewriting a whole CV *and* returning valid JSON. */
export const RESUME_MODEL = 'claude-opus-4-8';

/**
 * JD-match scoring and resume regeneration. Opus-tier for the same reason
 * RESUME_MODEL is: the percentage is user-facing and the rewrite has to stay
 * truthful. Same $5/$25 rates, so it costs no more per token.
 */
export const MATCH_MODEL = 'claude-opus-5';
