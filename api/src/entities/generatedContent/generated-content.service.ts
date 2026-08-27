import { readFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
    ClaudeResumeResult,
    ClaudeService,
    ClaudeTextResult,
} from '../../externalAPIs/claude/claude.service';
import { CompanyResearchRepository } from '../companyResearch/company-research.repository';
import { CompanyResearch } from '../companyResearch/entities/company-research.entity';
import { JobsService } from '../jobs/jobs.service';
import { CreateGeneratedContentDto } from './dto/create-generated-content.dto';
import { UpdateGeneratedContentDto } from './dto/update-generated-content.dto';
import { GeneratedContent } from './entities/generated-content.entity';
import { GeneratedContentRepository } from './generated-content.repository';
import { ResumePdfService } from './resume-pdf/resume-pdf.service';

@Injectable()
export class GeneratedContentService {
    private readonly logger = new Logger(GeneratedContentService.name);

    constructor(
        private readonly generatedContentRepository: GeneratedContentRepository,
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

        // Company name for the resume PDF file name: prefer the request, else
        // fall back to the Job record (findOne 404s if the job is missing).
        const companyName: string =
            dto.companyName ??
            (await this.jobsService.findOne(jobId)).companyName;

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
                jobPosting,
                companyWebsite,
                companySummary,
            );

        // Render the tailored resume JSON to a PDF (Handlebars → Puppeteer),
        // saved to the storage volume; the stored file name goes on the row.
        const resumePath: string = await this.resumePdfService.renderResume(
            tailoredResume.resume,
            companyName,
            jobId,
        );
        this.logger.log(
            `Tailored resume rendered for job ${jobId} ` +
                `(${Object.keys(tailoredResume.resume).length} sections) → ${resumePath}`,
        );

        // Persist the generated row (jobId + Claude output).
        return this.generatedContentRepository.create({
            jobId,
            outreachMessage: outreach.content,
            followupMessage: followup.content,
            tailoredResume: resumePath,
            tailoredResumeUsage: tailoredResume.usage,
            outreachMessageUsage: outreach.usage,
            followupMessageUsage: followup.usage,
            tailoredResumeCost: tailoredResume.cost,
            outreachMessageCost: outreach.cost,
            followupMessageCost: followup.cost,
        } as GeneratedContent);
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
