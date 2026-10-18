import Anthropic from '@anthropic-ai/sdk';

/**
 * Token usage exactly as the Anthropic API reports it.
 *
 * Claude-only on purpose. Ollama runs on your own machine and bills nothing,
 * so an Ollama-generated row leaves every *Usage column NULL rather than
 * filling this shape with local counts — a token count sitting in a column
 * named after a receipt reads as if money was spent. Check
 * `generated_content.provider` to tell "free" from "not recorded".
 */
export type ClaudeUsage = Anthropic.Message['usage'];
