import { ApiProperty } from '@nestjs/swagger';
import { CompanyResearch } from '../companyResearch/entities/company-research.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { GeneratedContent } from '../generatedContent/entities/generated-content.entity';
import { MissingKeyword } from '../generatedContent/entities/missing-keyword.entity';
import { Job } from '../jobs/job.entity';

/**
 * One job as the detail window sees it: the four reads it already makes,
 * answered in one response so a save can hand back server truth for every
 * field it just wrote.
 */
export class JobDetailResponse {
    @ApiProperty({ type: Job })
    job: Job;

    @ApiProperty({ type: Contact, isArray: true })
    contacts: Contact[];

    @ApiProperty({ type: CompanyResearch, nullable: true })
    research: CompanyResearch | null;

    @ApiProperty({ type: GeneratedContent, nullable: true })
    content: (GeneratedContent & { missingKeywords: MissingKeyword[] }) | null;
}
