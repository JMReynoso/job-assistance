import { readFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClaudeService } from '../../externalAPIs/claude/claude.service';
import { CompanyResearchRepository } from '../companyResearch/company-research.repository';
import { CreateGeneratedContentDto } from './dto/create-generated-content.dto';
import { UpdateGeneratedContentDto } from './dto/update-generated-content.dto';
import { GeneratedContent } from './entities/generated-content.entity';
import { GeneratedContentRepository } from './generated-content.repository';

@Injectable()
export class GeneratedContentService {
    private readonly logger = new Logger(GeneratedContentService.name);

    constructor(
        private readonly generatedContentRepository: GeneratedContentRepository,
        private readonly claudeService: ClaudeService,
        private readonly companyResearchRepository: CompanyResearchRepository,
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

    async create(dto: CreateGeneratedContentDto): Promise<GeneratedContent> {
        // TODO: create initial migration and seeds for generatedContent table

        // The master CV lives at src/CV/resume.json. Read it as raw text (not
        // imported): it's passed to Claude as context, so it needn't be valid
        // JSON, and reading at runtime keeps it out of the compiled bundle.
        const masterResume = await readFile(
            join(process.cwd(), 'src/CV/resume.json'),
            'utf-8',
        );

        const jobId = dto.jobId;
        const jobPosting = dto.jobPosting;
        const companyWebsite = dto.companyWebsite;

        // The outreach / follow-up / resume prompts all work from the stored
        // company research. Pull the latest run for this job; without it there's
        // nothing to personalize from, so treat a miss as a 404.
        const companyResearch =
            await this.companyResearchRepository.findByJobId(jobId);
        if (!companyResearch) {
            throw new NotFoundException(
                `No company research found for job ${jobId}`,
            );
        }
        const companySummary = companyResearch.summary;

        // call claude outreach message (returns a string)
        const outreach =
            await this.claudeService.draftOutreachMessage(companySummary);

        // call claude follow up message (returns a string)
        const followup =
            await this.claudeService.draftFollowUpMessage(companySummary);

        // call resume tailoring service (returns a json)
        const tailoredResume = await this.claudeService.draftResume(
            masterResume,
            jobPosting,
            companyWebsite,
            companySummary,
        );

        // call method that converts a json to a pdf (fixed Handlebars/React template → Puppeteer → PDF → save to server → return path to file)
        // TODO: implement Handlebars + Puppeteer; it consumes `tailoredResume`
        // and returns the saved PDF path (→ resumePath). Deferred until then.
        this.logger.log(
            `Tailored resume drafted for job ${dto.jobId} ` +
                `(${Object.keys(tailoredResume.resume).length} sections); PDF generation pending`,
        );

        // Persist the generated row (jobId + Claude output). resumePath and the
        // *Usage cost columns are filled in later — see the TODOs above.
        return this.generatedContentRepository.create({
            jobId,
            outreachMessage: outreach.content,
            followupMessage: followup.content,
            tailoredResume: 'path',
            tailoredResumeUsage: tailoredResume.usage,
            outreachMessageUsage: outreach.usage,
            followupMessageUsage: followup.usage,
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
