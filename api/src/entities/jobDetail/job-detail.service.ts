import { Injectable } from '@nestjs/common';
import { CompanyResearchService } from '../companyResearch/company-research.service';
import { ContactsService } from '../contacts/contacts.service';
import { GeneratedContentService } from '../generatedContent/generated-content.service';
import { UpdateJobDto } from '../jobs/dto/update-job.dto';
import { JobsService } from '../jobs/jobs.service';
import { UpdateJobDetailDto } from './dto/update-job-detail.dto';
import { JobDetailResponse } from './job-detail.response';

/**
 * The one write path behind the job detail window's Save button.
 *
 * A job in the UI sense is four rows in four tables, so saving it fans out
 * across three services. This sits above them all rather than inside
 * JobsService: GeneratedContentModule already imports JobsModule (for the
 * company-name fallback), so orchestrating from there would be a circular
 * module dependency.
 *
 * Absence is not failure. A job that has never been researched or generated
 * for simply has nowhere to put its Notes or messages, so those parts of the
 * patch are skipped — the same reasoning that makes the by-job reads answer
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
        if (dto.jobPostingURL !== undefined)
            jobPatch.jobPostingURL = dto.jobPostingURL;
        if (dto.companyPage !== undefined)
            jobPatch.companyPage = dto.companyPage;

        const job =
            Object.keys(jobPatch).length > 0
                ? await this.jobsService.update(jobId, jobPatch)
                : await this.jobsService.findOne(jobId);

        // Notes → the newest research row's summary. No row, nothing to write.
        let research = await this.companyResearchService.findByJobId(jobId);
        if (dto.notes !== undefined && research) {
            research =
                await this.companyResearchService.updateSummaryFromJobDetail(
                    research.id,
                    dto.notes,
                );
        }

        // The two messages and the keyword checkboxes → the newest generation
        // run. Returns null (and writes nothing) when the job has none.
        const content =
            dto.outreachMessage !== undefined ||
            dto.followupMessage !== undefined ||
            dto.includedKeywords !== undefined
                ? await this.generatedContentService.updateFromJobDetail(
                      jobId,
                      {
                          outreachMessage: dto.outreachMessage,
                          followupMessage: dto.followupMessage,
                          includedKeywords: dto.includedKeywords,
                      },
                  )
                : await this.generatedContentService.findByJobIdWithKeywords(
                      jobId,
                  );

        // Contacts are read-only in the window; included so the response is a
        // complete job detail the client can merge in one call.
        const contacts = await this.contactsService.findByJobId(jobId);

        return { job, contacts, research, content };
    }
}
