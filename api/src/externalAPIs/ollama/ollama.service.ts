import {
    Inject,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    AiMatchResult,
    AiProvider,
    AiProviderName,
    AiResumeResult,
    AiTextResult,
} from '../ai/ai-provider.interface';
import {
    COVER_LETTER_SYSTEM,
    FOLLOWUP_SYSTEM,
    JD_MATCH_SYSTEM,
    OUTREACH_SYSTEM,
    RESUME_REGENERATE_SYSTEM,
} from '../ai/prompts.constants';
import { tryExtractJsonObject } from '../helper/parseJson';
import {
    DEFAULT_MODEL,
    JSON_TEMPERATURE,
    KEEP_ALIVE,
    MATCH_NUM_PREDICT,
    MATCH_SCHEMA,
    MESSAGE_NUM_CTX,
    MESSAGE_NUM_PREDICT,
    MESSAGE_TEMPERATURE,
    MESSAGE_TIMEOUT_MS,
    RELEASE_TIMEOUT_MS,
    RESUME_NUM_CTX,
    RESUME_NUM_PREDICT,
    RESUME_TIMEOUT_MS,
} from './ollama.constants';
import { OLLAMA_CLIENT, OllamaApiError, OllamaClient } from './ollama.provider';
import { ChatOptions, OllamaChatResponse } from './ollama.types';

/**
 * The free, local counterpart to ClaudeService: the same five methods against
 * a Qwen model running in Ollama on your own machine. Implements AiProvider,
 * so GeneratedContentService can use either engine without knowing which.
 *
 * The prompts are the shared ones — the models differ, the instructions don't.
 * What differs is *enforcement*: Claude gets output_config.format, Ollama gets
 * `format`, a grammar-constrained decode that makes an off-shape reply
 * impossible rather than merely unlikely.
 *
 * Never reports token usage. See ClaudeUsage for why.
 *
 * Config (env, all optional):
 *   OLLAMA_BASE_URL   — default http://host.docker.internal:11434
 *   OLLAMA_MODEL      — default qwen3.5:27b
 *   OLLAMA_NUM_CTX    — default 32768 for resume/match calls
 *   OLLAMA_TIMEOUT_MS — default 900000 (15 min) for resume calls
 *   OLLAMA_THINK      — 'true' lets the model reason first: better, much slower
 *   OLLAMA_KEEP_WARM  — 'true' skips the post-run unload (see release())
 */
@Injectable()
export class OllamaService implements AiProvider {
    readonly name: AiProviderName = 'ollama';

    private readonly logger = new Logger(OllamaService.name);
    private readonly model: string;
    private readonly think: boolean;
    private readonly keepWarm: boolean;
    private readonly resumeNumCtx: number;
    private readonly resumeTimeoutMs: number;

    constructor(
        @Inject(OLLAMA_CLIENT) private readonly client: OllamaClient,
        private readonly config: ConfigService,
    ) {
        this.model = this.config.get<string>('OLLAMA_MODEL') ?? DEFAULT_MODEL;
        this.think = this.config.get<string>('OLLAMA_THINK') === 'true';
        this.keepWarm = this.config.get<string>('OLLAMA_KEEP_WARM') === 'true';
        this.resumeNumCtx =
            Number(this.config.get<string>('OLLAMA_NUM_CTX')) || RESUME_NUM_CTX;
        this.resumeTimeoutMs =
            Number(this.config.get<string>('OLLAMA_TIMEOUT_MS')) ||
            RESUME_TIMEOUT_MS;
    }

    /** Warm outreach message, personalized from the company research summary. */
    async draftOutreachMessage(summary: string): Promise<AiTextResult> {
        return this.draftMessage(OUTREACH_SYSTEM, summary, 'Outreach message');
    }

    /** Warm-but-corporate follow-up, personalized from the same summary. */
    async draftFollowUpMessage(summary: string): Promise<AiTextResult> {
        return this.draftMessage(FOLLOWUP_SYSTEM, summary, 'Follow-up message');
    }

    /**
     * Shared engine behind the two message methods. Returns the finished
     * message as a plain string — no `format`, because a drafted message is
     * prose, not JSON. Callers differ only in system prompt and log label.
     */
    private async draftMessage(
        system: string,
        summary: string,
        logLabel: string,
    ): Promise<AiTextResult> {
        const content = await this.chat({
            system,
            user: `Here is the company research summary to work from:\n\n${summary}`,
            numCtx: MESSAGE_NUM_CTX,
            numPredict: MESSAGE_NUM_PREDICT,
            temperature: MESSAGE_TEMPERATURE,
            timeoutMs: MESSAGE_TIMEOUT_MS,
            logLabel,
        });

        return { content, cost: 0 };
    }

    /** Drafts a tailored resume from the master resume + job posting, as JSON. */
    async draftResume(
        masterResume: string,
        jobPosting: string,
        companyWebsite: string,
        companySummary?: string,
    ): Promise<AiResumeResult> {
        const resume = await this.chatForJson({
            system: COVER_LETTER_SYSTEM,
            user:
                `MASTER RESUME:\n${masterResume}\n\n` +
                `JOB POSTING:\n${jobPosting}\n\n` +
                `COMPANY WEBSITE:\n${companyWebsite}\n\n` +
                `COMPANY SUMMARY:\n${companySummary || 'None'}\n\n` +
                `Return a one-page resume as raw JSON, reusing the master resume's exact key names.`,
            format: 'json',
            numCtx: this.resumeNumCtx,
            numPredict: RESUME_NUM_PREDICT,
            temperature: JSON_TEMPERATURE,
            timeoutMs: this.resumeTimeoutMs,
            logLabel: 'draftResume',
        });

        return { resume, cost: 0 };
    }

    /**
     * Rewrites an existing tailored resume to work in the keywords the user
     * checked. Takes the saved resume JSON rather than the master CV — this is
     * a revision of work already done, not a fresh tailoring pass.
     */
    async regenerateResume(
        tailoredResume: Record<string, unknown>,
        jobDescription: string,
        keywords: string[],
    ): Promise<AiResumeResult> {
        const resume = await this.chatForJson({
            system: RESUME_REGENERATE_SYSTEM,
            user:
                `CURRENT TAILORED RESUME (JSON):\n${JSON.stringify(tailoredResume)}\n\n` +
                `JOB DESCRIPTION:\n${jobDescription}\n\n` +
                `KEYWORDS TO WORK IN:\n${keywords.map((k) => `- ${k}`).join('\n')}\n\n` +
                `Return the revised resume as raw JSON in the same shape, with the same key names.`,
            format: 'json',
            numCtx: this.resumeNumCtx,
            numPredict: RESUME_NUM_PREDICT,
            temperature: JSON_TEMPERATURE,
            timeoutMs: this.resumeTimeoutMs,
            logLabel: 'regenerateResume',
        });

        return { resume, cost: 0 };
    }

    /**
     * Scores a tailored resume against a job description and reports the
     * keywords it is missing. The schema is compiled into a decoding grammar,
     * so the model physically cannot answer with prose — no fence-stripping,
     * no malformed-JSON failure mode, exactly like the Claude path.
     */
    async scoreResumeMatch(
        tailoredResume: Record<string, unknown>,
        jobDescription: string,
    ): Promise<AiMatchResult> {
        const parsed = await this.chatForJson({
            system: JD_MATCH_SYSTEM,
            user:
                `TAILORED RESUME (JSON):\n${JSON.stringify(tailoredResume)}\n\n` +
                `JOB DESCRIPTION:\n${jobDescription}`,
            format: MATCH_SCHEMA,
            numCtx: this.resumeNumCtx,
            numPredict: MATCH_NUM_PREDICT,
            temperature: JSON_TEMPERATURE,
            timeoutMs: MESSAGE_TIMEOUT_MS,
            logLabel: 'JD match',
        });

        const percent = Number(parsed.matchPercent);

        return {
            // A plain integer leaves this method, always. The grammar bounds
            // it, but a percentage that renders as "-3%" or "140%" is worse
            // than one that is merely wrong.
            matchPercent: Number.isFinite(percent)
                ? Math.max(0, Math.min(100, Math.round(percent)))
                : 0,
            missingKeywords: Array.isArray(parsed.missingKeywords)
                ? parsed.missingKeywords.filter(
                      (k): k is string => typeof k === 'string',
                  )
                : [],
            cost: 0,
        };
    }

    /**
     * Unloads the model from RAM/VRAM. Ollama otherwise keeps the weights
     * resident for KEEP_ALIVE after the last call — ~17GB of your machine
     * pinned for minutes after the job is already finished. `keep_alive: 0`
     * tells it to drop them now.
     *
     * Best-effort by design: a run whose real work succeeded must not fail
     * because housekeeping did, and Ollama's own timer is the backstop.
     * OLLAMA_KEEP_WARM=true skips it, for adding several jobs back to back.
     */
    async release(): Promise<void> {
        if (this.keepWarm) {
            return;
        }

        try {
            await this.client.post(
                'api/chat',
                { model: this.model, messages: [], keep_alive: 0 },
                RELEASE_TIMEOUT_MS,
            );
            this.logger.log(`Unloaded ${this.model} from memory`);
        } catch (error) {
            this.logger.warn(
                `Could not unload ${this.model}, leaving it to keep_alive: ${String(error)}`,
            );
        }
    }

    /**
     * A JSON-returning call, with one repair attempt. Local models produce an
     * unparseable reply often enough that retrying once is far cheaper than
     * failing a pipeline stage the user has already waited minutes for.
     */
    private async chatForJson(
        opts: ChatOptions,
    ): Promise<Record<string, unknown>> {
        const first = await this.chat(opts);
        const parsed = tryExtractJsonObject(first);
        if (parsed) {
            return parsed;
        }

        this.logger.warn(
            `${opts.logLabel} returned malformed JSON, retrying once: ${first.slice(0, 200)}`,
        );

        const repaired = await this.chat({
            ...opts,
            user:
                `${opts.user}\n\n---\n\nYour previous reply was not valid JSON:\n` +
                `${first.slice(0, 2000)}\n\n` +
                `Return ONLY the JSON object. No prose, no markdown fence, no explanation.`,
        });

        const retried = tryExtractJsonObject(repaired);
        if (retried) {
            return retried;
        }

        this.logger.error(
            `${opts.logLabel} returned malformed JSON twice: ${repaired.slice(0, 200)}`,
        );
        throw new ServiceUnavailableException(
            'Local AI returned malformed data, please try again',
        );
    }

    /** One non-streaming /api/chat call, mapped to its text. */
    private async chat(opts: ChatOptions): Promise<string> {
        const body: Record<string, unknown> = {
            model: this.model,
            // /api/chat streams by DEFAULT. Without this you get a sequence of
            // NDJSON fragments, not one response object.
            stream: false,
            keep_alive: KEEP_ALIVE,
            think: this.think,
            messages: [
                { role: 'system', content: opts.system },
                { role: 'user', content: opts.user },
            ],
            options: {
                num_ctx: opts.numCtx,
                num_predict: opts.numPredict,
                temperature: opts.temperature,
            },
        };
        if (opts.format) {
            body.format = opts.format;
        }

        const started = Date.now();
        const data = await this.send(body, opts.timeoutMs);
        const content = (data.message?.content ?? '').trim();

        this.logger.log(
            `${opts.logLabel} (ollama/${this.model}) — ` +
                `in=${data.prompt_eval_count ?? 0} out=${data.eval_count ?? 0} ` +
                `${Math.round((Date.now() - started) / 1000)}s`,
        );

        if (!content) {
            this.logger.error(
                `${opts.logLabel} returned an empty reply ` +
                    `(done_reason=${data.done_reason ?? 'unknown'})`,
            );
            throw new ServiceUnavailableException(
                'Local AI returned an empty response, please try again',
            );
        }

        return content;
    }

    /**
     * Sends the request, mapping every failure to a clean HTTP error. The one
     * retry here is for `think`: qwen3.5 supports it, but OLLAMA_MODEL can
     * point at anything, and a model without reasoning rejects the field.
     */
    private async send(
        body: Record<string, unknown>,
        timeoutMs: number,
    ): Promise<OllamaChatResponse> {
        try {
            return await this.client.post<OllamaChatResponse>(
                'api/chat',
                body,
                timeoutMs,
            );
        } catch (error) {
            if (!this.isThinkUnsupported(error)) {
                throw this.toServiceError(error);
            }

            this.logger.warn(
                `${this.model} does not support "think" — retrying without it`,
            );
            delete body.think;

            try {
                return await this.client.post<OllamaChatResponse>(
                    'api/chat',
                    body,
                    timeoutMs,
                );
            } catch (retryError) {
                throw this.toServiceError(retryError);
            }
        }
    }

    /** True when Ollama refused the request because the model can't reason. */
    private isThinkUnsupported(error: unknown): boolean {
        return (
            error instanceof OllamaApiError &&
            error.status === 400 &&
            /think/i.test(error.body)
        );
    }

    /**
     * Maps a raw Ollama failure to a clean HTTP error. Every message names the
     * fix, because every one of these is something the user can put right on
     * their own machine with a single command.
     */
    private toServiceError(error: unknown): ServiceUnavailableException {
        if (error instanceof OllamaApiError) {
            if (error.status === 404) {
                this.logger.error(`Ollama has no model "${this.model}"`);
                return new ServiceUnavailableException(
                    `Local AI model "${this.model}" is not pulled — run: ollama pull ${this.model}`,
                );
            }
            this.logger.error(
                `Ollama returned ${error.status}: ${error.body.slice(0, 500)}`,
            );
            return new ServiceUnavailableException(
                'Local AI returned an error, please try again',
            );
        }

        if (
            error instanceof Error &&
            (error.name === 'TimeoutError' || error.name === 'AbortError')
        ) {
            this.logger.error(`Ollama request timed out on ${this.model}`);
            return new ServiceUnavailableException(
                'Local AI is taking too long — try a smaller OLLAMA_MODEL or raise OLLAMA_TIMEOUT_MS',
            );
        }

        this.logger.error('Ollama request failed to send', error as Error);
        return new ServiceUnavailableException(
            `Local AI (Ollama) is unreachable at ${this.client.baseUrl} — is "ollama serve" running?`,
        );
    }
}
