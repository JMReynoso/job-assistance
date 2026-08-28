import { Module } from '@nestjs/common';
import { CompanyResearchModule } from '../companyResearch/company-research.module';
import { ContactsModule } from '../contacts/contacts.module';
import { GeneratedContentModule } from '../generatedContent/generated-content.module';
import { JobsModule } from '../jobs/jobs.module';
import { JobDetailController } from './job-detail.controller';
import { JobDetailService } from './job-detail.service';

/**
 * No TypeOrmModule.forFeature and no repository: this module owns no table.
 * It only composes the four feature modules whose entities the job detail
 * window shows.
 */
@Module({
    imports: [
        JobsModule,
        CompanyResearchModule,
        GeneratedContentModule,
        ContactsModule,
    ],
    controllers: [JobDetailController],
    providers: [JobDetailService],
})
export class JobDetailModule {}
