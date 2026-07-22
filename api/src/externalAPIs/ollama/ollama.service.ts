import {
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    FOLLOWUP_SYSTEM,
    OUTREACH_SYSTEM,
} from '../claude/claude.constants';

/** Text the local model produced. No usage/cost — Ollama runs on your machine. */
export interface OllamaTextResult {
    content: string;
}

/** Minimal shape of Ollama's non-streaming /api/chat response. */
interface OllamaChatResponse {
    message?: { role: string; content: string };
    prompt_eval_count?: number;
    eval_count?: number;
}

/**
 * A free, local alternative to ClaudeService for drafting the outreach and
 * follow-up messages: queries a Qwen model running in Ollama. Same prompts and
 * method shape as ClaudeService, so callers can swap between the two when they'd
 * rather not spend money on Claude.
 *
 * Config (via env, sensible defaults):
 *   OLLAMA_BASE_URL — default http://host.docker.internal:11434 (host's Ollama
 *                     from inside the dev container; use http://localhost:11434
 *                     when running the API outside Docker).
 *   OLLAMA_MODEL    — default 'qwen3' (any pulled Qwen tag, e.g. 'qwen2.5').
 */
@Injectable()
export class OllamaService {
    private readonly logger = new Logger(OllamaService.name);
    private readonly baseUrl: string;
    private readonly model: string;

    constructor(private readonly config: ConfigService) {
        this.baseUrl = (
            this.config.get<string>('OLLAMA_BASE_URL') ??
            'http://host.docker.internal:11434'
        ).replace(/\/+$/, '');
        this.model = this.config.get<string>('OLLAMA_MODEL') ?? 'qwen3';
    }

    /** Warm outreach message, personalized from the company research summary.
    async draftOutreachMessage(summary: string): Promise<OllamaTextResult> {
        return this.draftMessage(OUTREACH_SYSTEM, summary, 'Outreach message');
    }
    */

    /** Warm-but-corporate follow-up message, personalized from the summary. 
    async draftFollowUpMessage(summary: string): Promise<OllamaTextResult> {
        return this.draftMessage(FOLLOWUP_SYSTEM, summary, 'Follow-up message');
    }
    */

    /** Shared engine: one non-streaming chat call to Ollama, mapped to a result. 
    private async draftMessage(
        system: string,
        summary: string,
        logLabel: string,
    ): Promise<OllamaTextResult> | any{
        // Local generation on a large model can be slow; give it room.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);

        return { content: '' };
    }

    */
}
