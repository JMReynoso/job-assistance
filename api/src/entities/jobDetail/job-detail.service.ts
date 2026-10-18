import { Injectable } from '@nestjs/common';
import { CompanyResearchService } from '../companyResearch/company-research.service';
import { ContactsService } from '../contacts/contacts.service';
import { GeneratedContentService } from '../generatedContent/generated-content.service';
import { UpdateJobDto } from '../jobs/dto/update-job.dto';
import { JobsService } from '../jobs/jobs.service';
import { UpdateJobDetailDto } from './dto/update-job-detail.dto';
import { JobDetailResponse } from './job-detail.response';

/**
 * The one read and the one write behind the job detail window.
 *
 * A job in the UI sense is four rows in four tables, so reading it fans in
 * from four services and saving it fans out across three. This sits above
 * them all rather than inside JobsService: GeneratedContentModule already
 * imports JobsModule (for the company-name fallback), so orchestrating from
 * there would be a circular module dependency.
 *
 * Absence is not failure. A job that has never been researched or generated
 * for simply has nowhere to put its Notes or messages, so those parts of the
 * patch are skipped — the same reasoning that makes the satellite reads answer
 * null instead of 404ing.
 */
@Injectable()
export class JobDetailService {
    constructor(
        private readonly jobsService: JobsService,
        private readonly companyResearchService: CompanyResearchService,
        private readonly generatedContentService: GeneratedContentService,
        private readonly contactsService: ContactsService,
    ) {}

    /**
     * The job and its satellites (contacts, newest research, newest generated
     * content with its keywords), assembled in one place so that what a job
     * detail contains is defined exactly once.
     *
     * The four reads run concurrently: none depends on another, so this costs
     * the slowest read rather than the sum of all four.
     *
     * Promise.all rather than allSettled on purpose. The satellites a new job
     * legitimately lacks come back as [] or null from perfectly successful
     * reads, so absence is already handled, and anything that rejects is a
     * real failure to surface as one error. The job read's not-found is the
     * rejection that matters: it fails the whole batch, which is the 404. The
     * other three reads are left to finish harmlessly. If these reads ever
     * diverge in reliability, allSettled is the upgrade path.
     *
     * Satellites are null, never undefined: Fastify sends an empty body for
     * undefined and an undefined key vanishes from the JSON.
     */
    async findOne(jobId: number): Promise<JobDetailResponse> {
        const [job, contacts, research, content] = await Promise.all([
            this.jobsService.findOne(jobId),
            this.contactsService.findByJobId(jobId),
            this.companyResearchService.findByJobId(jobId),
            this.generatedContentService.findByJobIdWithKeywords(jobId),
        ]);

        return { job, contacts, research, content };
    }

    async update(
        jobId: number,
        dto: UpdateJobDetailDto,
    ): Promise<JobDetailResponse> {
        // The job row is the one hard precondition — 404 before writing
        // anything, so a bad id can't half-apply a patch.
        await this.jobsService.findOne(jobId);

        // Built key by key rather than by rest-destructuring: an UPDATE with
        // an all-undefined SET clause is a Postgres syntax error, and
        // Object.keys() on the DTO instance can't tell "absent" from
        // "present and undefined".
        const jobPatch: UpdateJobDto = {};
        if (dto.companyName !== undefined)
            jobPatch.companyName = dto.companyName;
        if (dto.status !== undefined) jobPatch.status = dto.status;
        if (dto.dateApplied !== undefined)
            jobPatch.dateApplied = dto.dateApplied;
        if (dto.dateLastContacted !== undefined)
            jobPatch.dateLastContacted = dto.dateLastContacted;
        if (dto.jobPostingUrl !== undefined)
            jobPatch.jobPostingUrl = dto.jobPostingUrl;
        if (dto.companyPageUrl !== undefined)
            jobPatch.companyPageUrl = dto.companyPageUrl;

        if (Object.keys(jobPatch).length > 0) {
            await this.jobsService.update(jobId, jobPatch);
        }

        // Notes → the newest research row's summary. The read is only to find
        // that row's id; no row, nothing to write.
        if (dto.notes !== undefined) {
            const research =
                await this.companyResearchService.findByJobId(jobId);
            if (research) {
                await this.companyResearchService.updateSummaryFromJobDetail(
                    research.id,
                    dto.notes,
                );
            }
        }

        // The two messages and the keyword checkboxes → the newest generation
        // run. Writes nothing when the job has none.
        if (
            dto.outreachMessage !== undefined ||
            dto.followupMessage !== undefined ||
            dto.includedKeywords !== undefined
        ) {
            await this.generatedContentService.updateFromJobDetail(jobId, {
                outreachMessage: dto.outreachMessage,
                followupMessage: dto.followupMessage,
                includedKeywords: dto.includedKeywords,
            });
        }

        // The response is the read, not an assembly of the writes' return
        // values, so a save and an open can never disagree about what a job
        // detail contains. A few extra small reads per save is the price.
        return this.findOne(jobId);
    }
}
