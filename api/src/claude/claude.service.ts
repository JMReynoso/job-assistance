import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_CLIENT } from './anthropic.provider';

/**
 * The one place that talks to the Claude API. Domain services depend on these
 * methods, never on the Anthropic SDK directly — so prompts, model choice, and
 * error mapping all live here (the same discipline the repositories use to hide
 * TypeORM: one seam per external system).
 */

// Stable instructions — kept first and cached so repeat calls only pay full
// price for the changing resume/posting, not this prefix.
const COVER_LETTER_SYSTEM = `You are an expert career coach writing tailored cover letters.
Write in a confident, specific voice. Never invent experience the candidate does not have. 
Make sure the resume is one-page and is ATS-friendly. Make sure the resume is letter size. Tailor this resume to match the job description which is a URL that will be sent in the messages.\n\n
            Instructions:\n
            1. Rewrite the professional summary to align with the company and role.\n
            2. update and reorder bullet points to highlight the most relevant experience and keywords from the job description.\n
            3. Make sure the section structure goes Summary, Skills, Experience, Projects, Education in that exact order.\n
            4. Make is ATS friendly (no tables, no images, no columns in the final layout)\n
            
`;

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
  async draftResume(masterResume: string, jobPosting: string, companyWebsite: string, otherURLAboutCompany?: string[]): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
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
              Other URLs about the company:\n${otherURLAboutCompany?.join('\n') || 'None'}\n\n
              Return a one-page resume in json format.`,
          },
        ],
      });

      return response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
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

  //TODO: create summary based on research of company method
  /*
    with the passed URLs (maybe taken from perplexity?)
    Summarize the company's tech stack, engineering culture, mission statement 
    and what they do, and recent products all in 5 bullet points
   */

  //TODO: create outreach message based on research

  //TODO: create follow-up message based on research
}
