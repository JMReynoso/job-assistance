import { ClaudeUsage } from '../claude/claude.types';

export type AiProviderName = 'claude' | 'ollama';

/**
 * What one generation call gives back.
 *
 * `usage` is optional and `cost` is 0 for a local run: see {@link ClaudeUsage}
 * for why Ollama deliberately reports neither.
 */
export interface AiTextResult {
    /** The generated text (the drafted message). */
    content: string;
    /** Claude only — omitted entirely on an Ollama run. */
    usage?: ClaudeUsage;
    /** Estimated USD. Always 0 for Ollama. */
    cost: number;
}

export interface AiResumeResult {
    /** The tailored resume as a structured object (fed to the PDF template). */
    resume: Record<string, unknown>;
    usage?: ClaudeUsage;
    cost: number;
}

export interface AiMatchResult {
    /** Always a plain, clamped 0-100 integer — never prose, never out of range. */
    matchPercent: number;
    missingKeywords: string[];
    usage?: ClaudeUsage;
    cost: number;
}

/**
 * The five things this app needs an AI to do, plus a teardown hook. ClaudeService
 * and OllamaService both implement it, so GeneratedContentService can swap
 * engines per request without knowing which one it got — the same discipline
 * the repositories use to hide TypeORM: one seam per external system.
 */
export interface AiProvider {
    readonly name: AiProviderName;

    draftOutreachMessage(summary: string): Promise<AiTextResult>;

    draftFollowUpMessage(summary: string): Promise<AiTextResult>;

    draftResume(
        masterResume: string,
        jobPosting: string,
        companyWebsite: string,
        companySummary?: string,
    ): Promise<AiResumeResult>;

    scoreResumeMatch(
        tailoredResume: Record<string, unknown>,
        jobDescription: string,
    ): Promise<AiMatchResult>;

    regenerateResume(
        tailoredResume: Record<string, unknown>,
        jobDescription: string,
        keywords: string[],
    ): Promise<AiResumeResult>;

    /**
     * Called once when a run finishes, successfully or not. Claude's is a
     * no-op — its model isn't on your hardware. Ollama's unloads the weights
     * from RAM/VRAM instead of letting them sit there for keep_alive.
     *
     * Must never throw: freeing memory is housekeeping, and a failure here
     * must not turn a successful run into a failed request.
     */
    release(): Promise<void>;
}
