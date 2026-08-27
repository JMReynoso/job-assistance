import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaudeModule } from '../../externalAPIs/claude/claude.module';
import { CompanyResearchModule } from '../companyResearch/company-research.module';
import { JobsModule } from '../jobs/jobs.module';
import { GeneratedContentController } from './generated-content.controller';
import { GeneratedContent } from './entities/generated-content.entity';
import { MissingKeyword } from './entities/missing-keyword.entity';
import { GeneratedContentRepository } from './generated-content.repository';
import { MissingKeywordRepository } from './missing-keyword.repository';
import { GeneratedContentService } from './generated-content.service';
import { ResumePdfModule } from './resume-pdf/resume-pdf.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([GeneratedContent, MissingKeyword]),
        ClaudeModule,
        CompanyResearchModule,
        ResumePdfModule,
        JobsModule,
    ],
    controllers: [GeneratedContentController],
    providers: [
        GeneratedContentService,
        GeneratedContentRepository,
        MissingKeywordRepository,
    ],
    exports: [GeneratedContentService],
})
export class GeneratedContentModule {}
