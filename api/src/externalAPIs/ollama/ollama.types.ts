/**
 * Types for OllamaService: the wire shape of an /api/chat reply and the
 * per-call settings its chat() engine takes. Tuning constants live in
 * ollama.constants.ts; the shared result types are in
 * ../ai/ai-provider.interface.ts.
 */

/** Ollama's non-streaming /api/chat reply — only the fields we read. */
export interface OllamaChatResponse {
    /**
     * `thinking` is separate from `content`, so a reasoning model's scratch
     * work never reaches the parser. Some models leak it into `content`
     * anyway, which is why parseJson still strips <think> blocks.
     */
    message?: { role: string; content?: string; thinking?: string };
    /** Why generation stopped — 'stop', 'length', 'load', 'unload'. */
    done_reason?: string;
    /** Prompt tokens. Logged for timing; never stored (see ClaudeUsage). */
    prompt_eval_count?: number;
    /** Generated tokens. Logged, never stored. */
    eval_count?: number;
}

/** One call's worth of settings, handed to OllamaService's chat() engine. */
export interface ChatOptions {
    system: string;
    user: string;
    /**
     * A JSON schema forces an exact shape; 'json' only forces valid JSON;
     * omitted returns free text (what the two message methods want).
     */
    format?: object | 'json';
    /** Context window. Too small truncates the input silently — see constants. */
    numCtx: number;
    /** Output ceiling, the local equivalent of Claude's max_tokens. */
    numPredict: number;
    temperature: number;
    timeoutMs: number;
    /** Prefix for this call's log line, e.g. 'draftResume'. */
    logLabel: string;
}
