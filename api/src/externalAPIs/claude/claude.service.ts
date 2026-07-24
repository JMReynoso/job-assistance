import {
    Inject,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_CLIENT } from './anthropic.provider';
import {
    COVER_LETTER_SYSTEM,
    FOLLOWUP_SYSTEM,
    OUTREACH_SYSTEM,
    MESSAGE_MODEL,
} from './claude.constants';
import { costFromUsage } from './claude.pricing';

/** Model used for the resume draft; priced in {@link costFromUsage}. */
const RESUME_MODEL = 'claude-opus-4-8';

/**
 * The one place that talks to the Claude API. Domain services depend on these
 * methods, never on the Anthropic SDK directly — so param wiring and error mapping
 * live here (the prompts live in claude.constants.ts). Same discipline the
 * repositories use to hide TypeORM: one seam per external system.
 */

/** Text Claude produced, plus what the call cost. */
export interface ClaudeTextResult {
    /** The generated text (the drafted message). */
    content: string;
    /** Token usage for the call — for cost tracking. */
    usage: Anthropic.Message['usage'];
    /** Estimated USD cost of the call, derived from `usage`. */
    cost: number;
}

/** Parsed resume JSON Claude produced, plus what the call cost. */
export interface ClaudeResumeResult {
    /** The tailored resume as a structured object (fed to the PDF template). */
    resume: Record<string, unknown>;
    /** Token usage for the call — for cost tracking. */
    usage: Anthropic.Message['usage'];
    /** Estimated USD cost of the call, derived from `usage`. */
    cost: number;
}

// Output ceiling for a drafted message. With the company summary (~3k tokens) as
// input, 1200 output tokens keeps a single message well under $0.04 even at
// Sonnet 5's post-intro rates ($3/M in, $15/M out ≈ $0.03), and lower today.
const MESSAGE_MAX_TOKENS = 1200;

@Injectable()
export class ClaudeService {
    private readonly logger = new Logger(ClaudeService.name);

    constructor(
        @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic,
    ) {}

    /**
     * Drafts a tailored resume from a master resume + job posting. This is an example of
     * the shape a Claude-backed method takes — copy it for real use cases.
     */
    async draftResume(
        masterResume: string,
        jobPosting: string,
        companyWebsite: string,
        companySummary?: string,
    ): Promise<ClaudeResumeResult> {
        try {
            const response = await this.anthropic.messages.create({
                model: RESUME_MODEL,
                max_tokens: 12000,
                // Let Claude decide how much to reason. Add
                // `output_config: { effort: 'high' }` to push quality further.
                thinking: { type: 'adaptive' },
                system: [
                    {
                        type: 'text',
                        text: COVER_LETTER_SYSTEM,
                        cache_control: { type: 'ephemeral' },
                    },
                ],
                messages: [
                    {
                        role: 'user',
                        content: `MASTER RESUME:\n${masterResume}\n\n
              JOB POSTING:\n${jobPosting}\n\n
              COMPANY WEBSITE:\n${companyWebsite}\n\n
              COMPANY SUMMARY:\n${companySummary || 'None'}\n\n
              Return a one-page resume in json format.`,
                    },
                ],
            });

            const text = response.content
                .filter(
                    (block): block is Anthropic.TextBlock =>
                        block.type === 'text',
                )
                .map((block) => block.text)
                .join('')
                .trim();

            // Claude often wraps JSON in a ```json … ``` fence even when asked
            // for raw JSON, so strip that before parsing.
            const json = text
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/, '')
                .trim();

            try {
                return {
                    resume: JSON.parse(json) as Record<string, unknown>,
                    usage: response.usage,
                    cost: costFromUsage(RESUME_MODEL, response.usage),
                };
            } catch {
                this.logger.error(
                    `Expected a JSON resume from Claude but parsing failed: ${text.slice(0, 200)}`,
                );
                throw new ServiceUnavailableException(
                    'AI service returned malformed data, please try again',
                );
            }
        } catch (error) {
            if (error instanceof Anthropic.RateLimitError) {
                this.logger.warn('Anthropic rate limited the request');
                throw new ServiceUnavailableException(
                    'AI service is busy, please try again shortly',
                );
            }
            throw error;
        }
    }

    /**
     * Drafts a warm outreach message to a recruiter or hiring manager, personalized
     * from the company research `summary` (the stored PerplexityService output),
     * following Justin's fixed template. Focuses on the company's mission, stack, and
     * blogs and how Justin would fit in.
     */
    async draftOutreachMessage(summary: string): Promise<ClaudeTextResult> {
        return this.draftMessage({
            system: OUTREACH_SYSTEM,
            summary,
            logLabel: 'Outreach message',
        });
    }

    /**
     * Drafts a warm-but-corporate follow-up message, personalized from the company
     * research `summary`. Same focus as the outreach message: mission, stack, blogs,
     * and fit.
     */
    async draftFollowUpMessage(summary: string): Promise<ClaudeTextResult> {
        return this.draftMessage({
            system: FOLLOWUP_SYSTEM,
            summary,
            logLabel: 'Follow-up message',
        });
    }

    /**
     * Shared engine behind draftOutreachMessage / draftFollowUpMessage. Takes the
     * company research summary as context (no web_fetch — the research is already
     * done) and drafts a message with Sonnet at medium effort, capped so a single
     * message stays under the ~$0.04 budget. Callers differ only in system prompt
     * and log label.
     */
    private async draftMessage(opts: {
        system: string;
        summary: string;
        logLabel: string;
    }): Promise<ClaudeTextResult> {
        try {
            const response = await this.anthropic.messages.create({
                model: MESSAGE_MODEL,
                max_tokens: MESSAGE_MAX_TOKENS,
                // Let Claude decide how much to reason; a short message needs little.
                thinking: { type: 'adaptive' },
                // Medium effort — warm, personal quality without paying for deep
                // deliberation the task doesn't need.
                output_config: { effort: 'medium' },
                system: [
                    {
                        type: 'text',
                        text: opts.system,
                        cache_control: { type: 'ephemeral' },
                    },
                ],
                messages: [
                    {
                        role: 'user',
                        content: `Here is the company research summary to work from:\n\n${opts.summary}`,
                    },
                ],
            });

            const content = response.content
                .filter(
                    (block): block is Anthropic.TextBlock =>
                        block.type === 'text',
                )
                .map((block) => block.text)
                .join('')
                .trim();

            this.logger.log(
                `${opts.logLabel} (claude) — in=${response.usage.input_tokens} ` +
                    `out=${response.usage.output_tokens}`,
            );

            return {
                content,
                usage: response.usage,
                cost: costFromUsage(MESSAGE_MODEL, response.usage),
            };
        } catch (error) {
            if (error instanceof Anthropic.RateLimitError) {
                this.logger.warn('Anthropic rate limited the request');
                throw new ServiceUnavailableException(
                    'AI service is busy, please try again shortly',
                );
            }
            throw error;
        }
    }
}
