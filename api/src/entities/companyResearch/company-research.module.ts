import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyResearchController } from './company-research.controller';
import { CompanyResearch } from './entities/company-research.entity';
import { CompanyResearchRepository } from './company-research.repository';
import { CompanyResearchService } from './company-research.service';
import { PerplexityModule } from '../../externalAPIs/perplexity/perplexity.module';

@Module({
    imports: [TypeOrmModule.forFeature([CompanyResearch]), PerplexityModule],
    controllers: [CompanyResearchController],
    providers: [CompanyResearchService, CompanyResearchRepository],
    exports: [CompanyResearchService],
})
export class CompanyResearchModule {}
