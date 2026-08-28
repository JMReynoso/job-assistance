import { readFile } from 'fs/promises';
import { join } from 'path';
import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    ClaudeResumeResult,
    ClaudeService,
    ClaudeTextResult,
} from '../../externalAPIs/claude/claude.service';
import { CompanyResearchRepository } from '../companyResearch/company-research.repository';
import { CompanyResearch } from '../companyResearch/entities/company-research.entity';
import { JobsService } from '../jobs/jobs.service';
import { CreateGeneratedContentDto } from './dto/create-generated-content.dto';
import { RegenerateTailoredResumeDto } from './dto/regenerate-tailored-resume.dto';
import { UpdateGeneratedContentDto } from './dto/update-generated-content.dto';
import { GeneratedContent } from './entities/generated-content.entity';
import { MissingKeyword } from './entities/missing-keyword.entity';
import { GeneratedContentRepository } from './generated-content.repository';
import { MissingKeywordRepository } from './missing-keyword.repository';
import { ResumePdfService } from './resume-pdf/resume-pdf.service';

@Injectable()
export class GeneratedContentService {
    private readonly logger = new Logger(GeneratedContentService.name);

    constructor(
        private readonly generatedContentRepository: GeneratedContentRepository,
        private readonly missingKeywordRepository: MissingKeywordRepository,
        private readonly claudeService: ClaudeService,
        private readonly companyResearchRepository: CompanyResearchRepository,
        private readonly resumePdfService: ResumePdfService,
        private readonly jobsService: JobsService,
    ) {}

    findAll(): Promise<GeneratedContent[]> {
        return this.generatedContentRepository.findAll();
    }

    async findOne(id: number): Promise<GeneratedContent> {
        const generatedContent =
            await this.generatedContentRepository.findById(id);
        if (!generatedContent) {
            throw new NotFoundException(
                `GeneratedContent with id ${id} not found`,
            );
        }
        return generatedContent;
    }

    /**
     * The latest generation run for a job, or null when it has never been
     * generated. Not having content yet is the normal state of a job you just
     * added, so this is a null rather than a 404.
     */
    findByJobId(jobId: number): Promise<GeneratedContent | null> {
        return this.generatedContentRepository.findByJobId(jobId);
    }

    /**
     * Same as {@link findByJobId}, plus the missing keywords scored against
     * it — what the job detail window actually needs, in the one request it
     * already makes.
     */
    async findByJobIdWithKeywords(
        jobId: number,
    ): Promise<(GeneratedContent & { missingKeywords: MissingKeyword[] }) | null> {
        const content = await this.generatedContentRepository.findByJobId(jobId);
        if (!content) {
            return null; // null, never undefined — Fastify sends an empty body for undefined
        }
        const missingKeywords = await this.missingKeywordRepository.findByContentId(
            content.id,
        );
        return { ...content, missingKeywords };
    }

    async create(dto: CreateGeneratedContentDto): Promise<GeneratedContent> {
        // The master CV lives at src/CV/resume.json. Read it as raw text (not
        // imported): it's passed to Claude as context, so it needn't be valid
        // JSON, and reading at runtime keeps it out of the compiled bundle.
        const masterResume: string = await readFile(
            join(process.cwd(), 'src/CV/resume.json'),
            'utf-8',
        );

        const jobId: number = dto.jobId;
        const jobPosting: string = dto.jobPosting;
        const companyWebsite: string = dto.companyWebsite;

        // Fetched once and reused for both the company name fallback and the
        // job description below (findOne 404s if the job is missing).
        const job = await this.jobsService.findOne(jobId);
        const companyName: string = dto.companyName ?? job.companyName;

        // Prefer the stored description; fall back to the DTO for jobs saved
        // before jobs.jobDescription existed. draftResume has no way to open a
        // URL, so a URL here means the resume is tailored against nothing.
        const jobDescription: string = job.jobDescription?.trim() || jobPosting;

        // The outreach / follow-up / resume prompts all work from the stored
        // company research. Pull the latest run for this job; without it there's
        // nothing to personalize from, so treat a miss as a 404.
        const companyResearch: CompanyResearch | null =
            await this.companyResearchRepository.findByJobId(jobId);
        if (!companyResearch) {
            throw new NotFoundException(
                `No company research found for job ${jobId}`,
            );
        }
        const companySummary: string = companyResearch.summary;

        // call claude outreach message (returns a string)
        const outreach: ClaudeTextResult =
            await this.claudeService.draftOutreachMessage(companySummary);

        // call claude follow up message (returns a string)
        const followup: ClaudeTextResult =
            await this.claudeService.draftFollowUpMessage(companySummary);

        // call resume tailoring service (returns a json)
        const tailoredResume: ClaudeResumeResult =
            await this.claudeService.draftResume(
                masterResume,
                jobDescription,
                companyWebsite,
                companySummary,
            );

        // Render the tailored resume JSON to a PDF + JSON (Handlebars →
        // Puppeteer), both saved to the storage volume; the stored file names
        // go on the row.
        const rendered = await this.resumePdfService.renderResume(
            tailoredResume.resume,
            companyName,
            jobId,
        );
        this.logger.log(
            `Tailored resume rendered for job ${jobId} ` +
                `(${Object.keys(tailoredResume.resume).length} sections) → ${rendered.pdfFileName}`,
        );

        // Score the tailored resume against the job description — the
        // "JD Match %" the job detail window shows, plus the keywords it's
        // missing.
        const match = await this.claudeService.scoreResumeMatch(
            tailoredResume.resume,
            jobDescription,
        );

        // Persist the generated row (jobId + Claude output).
        const saved = await this.generatedContentRepository.create({
            jobId,
            outreachMessage: outreach.content,
            followupMessage: followup.content,
            tailoredResume: rendered.pdfFileName,
            tailoredResumeJson: tailoredResume.resume,
            tailoredResumeJsonPath: rendered.jsonFileName,
            tailoredResumeUsage: tailoredResume.usage,
            outreachMessageUsage: outreach.usage,
            followupMessageUsage: followup.usage,
            tailoredResumeCost: tailoredResume.cost,
            outreachMessageCost: outreach.cost,
            followupMessageCost: followup.cost,
            jdMatchPercent: match.matchPercent,
            jdMatchUsage: match.usage,
            jdMatchCost: match.cost,
            regenerateCount: 0,
        } as GeneratedContent);

        await this.missingKeywordRepository.replaceForContent(
            saved.id,
            match.missingKeywords,
        );

        return saved;
    }

    /**
     * Rewrites the newest tailored resume for a job with the keywords the
     * user checked, re-renders the PDF, and re-scores the match — updating
     * that same row in place. Costs accumulate; regenerateCount increments.
     *
     * The two drafted messages are deliberately untouched: regenerating is
     * about the resume, and re-running them would double the cost for no
     * benefit.
     */
    async regenerate(
        dto: RegenerateTailoredResumeDto,
    ): Promise<GeneratedContent> {
        const { jobId, keywords } = dto;

        const content = await this.generatedContentRepository.findByJobId(jobId);
        if (!content) {
            throw new NotFoundException(
                `No generated content found for job ${jobId}`,
            );
        }
        if (!content.tailoredResumeJson) {
            throw new NotFoundException(
                `Generated content ${content.id} predates saved resume JSON — regenerate it with POST /generated-content first`,
            );
        }

        const job = await this.jobsService.findOne(jobId);
        const jobDescription = job.jobDescription?.trim();
        if (!jobDescription) {
            throw new BadRequestException(
                `Job ${jobId} has no job description saved — add one before regenerating`,
            );
        }

        // Record what the user checked before spending any money, so the
        // state survives even if Claude then fails.
        await this.missingKeywordRepository.setIncluded(content.id, keywords);

        const regenerated = await this.claudeService.regenerateResume(
            content.tailoredResumeJson,
            jobDescription,
            keywords,
        );

        const rendered = await this.resumePdfService.renderResume(
            regenerated.resume,
            job.companyName,
            jobId,
        );

        // Re-score with the SAME method that produced the original number —
        // a self-reported score from the rewrite call would not be comparable.
        const match = await this.claudeService.scoreResumeMatch(
            regenerated.resume,
            jobDescription,
        );

        // The re-score's own missingKeywords list is intentionally discarded:
        // the checkbox list stays as the user left it.

        return this.generatedContentRepository.updateFields(content.id, {
            tailoredResume: rendered.pdfFileName,
            tailoredResumeJson: regenerated.resume,
            tailoredResumeJsonPath: rendered.jsonFileName,
            jdMatchPercent: match.matchPercent,
            jdMatchUsage: match.usage,
            jdMatchCost: (content.jdMatchCost ?? 0) + match.cost,
            regenerateUsage: regenerated.usage,
            regenerateCost: (content.regenerateCost ?? 0) + regenerated.cost,
            regenerateCount: (content.regenerateCount ?? 0) + 1,
        });
    }

    /**
     * Applies the job detail window's edits to the newest generation run for
     * a job: the two drafted messages and which missing keywords are checked.
     *
     * Returns null when the job has never been generated for. Nothing to
     * overwrite is not an error — it's the normal state of a job you just
     * added, the same reasoning the by-job read follows.
     */
    async updateFromJobDetail(
        jobId: number,
        patch: {
            outreachMessage?: string;
            followupMessage?: string;
            includedKeywords?: string[];
        },
    ): Promise<
        (GeneratedContent & { missingKeywords: MissingKeyword[] }) | null
    > {
        const content =
            await this.generatedContentRepository.findByJobId(jobId);
        if (!content) {
            return null;
        }

        const fields: Partial<GeneratedContent> = {};
        if (patch.outreachMessage !== undefined) {
            fields.outreachMessage = patch.outreachMessage;
        }
        if (patch.followupMessage !== undefined) {
            fields.followupMessage = patch.followupMessage;
        }
        if (Object.keys(fields).length > 0) {
            await this.generatedContentRepository.updateFields(
                content.id,
                fields,
            );
        }

        // setIncluded clears every other keyword on the row, so an empty
        // array correctly means "the user unchecked everything".
        if (patch.includedKeywords !== undefined) {
            await this.missingKeywordRepository.setIncluded(
                content.id,
                patch.includedKeywords,
            );
        }

        return this.findByJobIdWithKeywords(jobId);
    }

    async update(
        id: number,
        dto: UpdateGeneratedContentDto,
    ): Promise<GeneratedContent> {
        await this.findOne(id); // 404s before attempting the update
        const updated = await this.generatedContentRepository.update(id, dto);
        if (!updated) {
            throw new NotFoundException(
                `GeneratedContent with id ${id} not found`,
            );
        }
        return updated;
    }

    async remove(id: number): Promise<void> {
        const deleted = await this.generatedContentRepository.delete(id);
        if (!deleted) {
            throw new NotFoundException(
                `GeneratedContent with id ${id} not found`,
            );
        }
    }
}
