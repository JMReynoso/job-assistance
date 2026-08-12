import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaudeModule } from '../../externalAPIs/claude/claude.module';
import { CompanyResearchModule } from '../companyResearch/company-research.module';
import { JobsModule } from '../jobs/jobs.module';
import { GeneratedContentController } from './generated-content.controller';
import { GeneratedContent } from './entities/generated-content.entity';
import { GeneratedContentRepository } from './generated-content.repository';
import { GeneratedContentService } from './generated-content.service';
import { ResumePdfModule } from './resume-pdf/resume-pdf.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([GeneratedContent]),
        ClaudeModule,
        CompanyResearchModule,
        ResumePdfModule,
        JobsModule,
    ],
    controllers: [GeneratedContentController],
    providers: [GeneratedContentService, GeneratedContentRepository],
    exports: [GeneratedContentService],
})
export class GeneratedContentModule {}
