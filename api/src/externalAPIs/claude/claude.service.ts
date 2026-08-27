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
    MATCH_MODEL,
    JD_MATCH_SYSTEM,
    RESUME_REGENERATE_SYSTEM,
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

/** JD match score Claude produced, plus what the call cost. */
export interface ClaudeMatchResult {
    matchPercent: number;
    missingKeywords: string[];
    usage: Anthropic.Message['usage'];
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

            return {
                resume: this.parseResumeJson(response, 'draftResume'),
                usage: response.usage,
                cost: costFromUsage(RESUME_MODEL, response.usage),
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

    /**
     * Scores a tailored resume against a job description and reports the
     * keywords it is missing. Uses output_config.format so the model cannot
     * answer with prose — the shape is enforced server-side, so unlike
     * draftResume/regenerateResume this needs no fence-stripping and cannot
     * hit the malformed-JSON failure mode.
     */
    async scoreResumeMatch(
        tailoredResume: Record<string, unknown>,
        jobDescription: string,
    ): Promise<ClaudeMatchResult> {
        try {
            const response = await this.anthropic.messages.create({
                model: MATCH_MODEL,
                max_tokens: 4000,
                thinking: { type: 'adaptive' },
                output_config: {
                    effort: 'medium',
                    format: {
                        type: 'json_schema',
                        schema: {
                            type: 'object',
                            properties: {
                                matchPercent: {
                                    type: 'integer',
                                    minimum: 0,
                                    maximum: 100,
                                },
                                missingKeywords: {
                                    type: 'array',
                                    items: { type: 'string' },
                                },
                            },
                            required: ['matchPercent', 'missingKeywords'],
                            additionalProperties: false,
                        },
                    },
                },
                system: [
                    {
                        type: 'text',
                        text: JD_MATCH_SYSTEM,
                        cache_control: { type: 'ephemeral' },
                    },
                ],
                messages: [
                    {
                        role: 'user',
                        content: `TAILORED RESUME (JSON):\n${JSON.stringify(tailoredResume)}\n\nJOB DESCRIPTION:\n${jobDescription}`,
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

            const parsed = JSON.parse(text) as {
                matchPercent: number;
                missingKeywords: string[];
            };

            return {
                // Clamp defensively: the schema bounds it, but a percentage
                // that renders as "-3%" or "140%" is worse than one that is
                // merely wrong.
                matchPercent: Math.max(
                    0,
                    Math.min(100, Math.round(parsed.matchPercent)),
                ),
                missingKeywords: parsed.missingKeywords ?? [],
                usage: response.usage,
                cost: costFromUsage(MATCH_MODEL, response.usage),
            };
        } catch (error) {
            if (error instanceof Anthropic.RateLimitError) {
                this.logger.warn(
                    'Anthropic rate limited the JD match request',
                );
                throw new ServiceUnavailableException(
                    'AI service is busy, please try again shortly',
                );
            }
            throw error;
        }
    }

    /**
     * Rewrites an existing tailored resume to work in the keywords the user
     * checked. Takes the saved resume JSON rather than the master CV — this
     * is a revision of work already done, not a fresh tailoring pass.
     */
    async regenerateResume(
        tailoredResume: Record<string, unknown>,
        jobDescription: string,
        keywords: string[],
    ): Promise<ClaudeResumeResult> {
        try {
            const response = await this.anthropic.messages.create({
                model: MATCH_MODEL,
                max_tokens: 12000,
                thinking: { type: 'adaptive' },
                output_config: { effort: 'high' },
                system: [
                    {
                        type: 'text',
                        text: RESUME_REGENERATE_SYSTEM,
                        cache_control: { type: 'ephemeral' },
                    },
                ],
                messages: [
                    {
                        role: 'user',
                        content:
                            `CURRENT TAILORED RESUME (JSON):\n${JSON.stringify(tailoredResume)}\n\n` +
                            `JOB DESCRIPTION:\n${jobDescription}\n\n` +
                            `KEYWORDS TO WORK IN:\n${keywords.map((k) => `- ${k}`).join('\n')}\n\n` +
                            `Return the revised resume as raw JSON in the same shape.`,
                    },
                ],
            });

            return {
                resume: this.parseResumeJson(response, 'regenerateResume'),
                usage: response.usage,
                cost: costFromUsage(MATCH_MODEL, response.usage),
            };
        } catch (error) {
            if (error instanceof Anthropic.RateLimitError) {
                this.logger.warn(
                    'Anthropic rate limited the resume regeneration request',
                );
                throw new ServiceUnavailableException(
                    'AI service is busy, please try again shortly',
                );
            }
            throw error;
        }
    }

    /**
     * Claude often wraps JSON in a ```json … ``` fence even when asked for raw
     * JSON, so strip that before parsing. Shared by draftResume and
     * regenerateResume — both ask for the same resume shape back.
     */
    private parseResumeJson(
        response: Anthropic.Message,
        logLabel: string,
    ): Record<string, unknown> {
        const text = response.content
            .filter(
                (block): block is Anthropic.TextBlock =>
                    block.type === 'text',
            )
            .map((block) => block.text)
            .join('')
            .trim();

        const json = text
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();

        try {
            return JSON.parse(json) as Record<string, unknown>;
        } catch {
            this.logger.error(
                `${logLabel} returned malformed JSON: ${json.slice(0, 200)}`,
            );
            throw new ServiceUnavailableException(
                'AI service returned malformed data, please try again',
            );
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
