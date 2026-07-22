import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';
import { CompanyResearch } from './entities/company-research.entity';
import { CompanyResearchRepository } from './company-research.repository';
import { PerplexityService } from '../../externalAPIs/perplexity/perplexity.service';
import { CompanyResearchResult } from '../../externalAPIs/perplexity/perplexity.types';

@Injectable()
export class CompanyResearchService {
    constructor(
        private readonly companyResearchRepository: CompanyResearchRepository,
        private readonly perplexityService: PerplexityService,
    ) {}

    findAll(): Promise<CompanyResearch[]> {
        return this.companyResearchRepository.findAll();
    }

    async findOne(id: number): Promise<CompanyResearch> {
        const companyResearch =
            await this.companyResearchRepository.findById(id);

        if (!companyResearch) {
            throw new NotFoundException(
                `CompanyResearch with id ${id} not found`,
            );
        }
        return companyResearch;
    }

    async create(
        createCompanyResearchDto: CreateCompanyResearchDto,
    ): Promise<CompanyResearch> {

        const URLs = [
            createCompanyResearchDto.jobPostingUrl,
            createCompanyResearchDto.companyPageUrl,
            createCompanyResearchDto.companyLinkedInUrl,
            ...(createCompanyResearchDto.extraLinks ?? []),
        ]
            .map((url) => url.trim())
            .filter((url): url is string => !!url);

        const companyResearch: CompanyResearchResult = await this.perplexityService.research(
            createCompanyResearchDto.companyName,
            { verifyUrls: URLs },
        );

        return this.companyResearchRepository.create(
            createCompanyResearchDto,
            companyResearch,
        );
    }

    async remove(id: number): Promise<void> {
        const deleted = await this.companyResearchRepository.delete(id);

        if (!deleted) {
            throw new NotFoundException(
                `CompanyResearch with id ${id} not found`,
            );
        }
    }
}
