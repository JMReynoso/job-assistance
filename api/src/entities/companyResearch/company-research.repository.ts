import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';
import { CompanyResearch } from './entities/company-research.entity';
import { CompanyResearchResult } from '../../externalAPIs/perplexity/perplexity.types';

/**
 * Everything that touches Postgres for this entity lives here. The service
 * layer talks to this class, never to TypeORM's Repository<CompanyResearch>
 * directly — so if the storage layer ever changes, this is the only file that
 * has to.
 */
@Injectable()
export class CompanyResearchRepository {
    constructor(
        @InjectRepository(CompanyResearch)
        private readonly repository: Repository<CompanyResearch>,
    ) {}

    findAll(): Promise<CompanyResearch[]> {
        return this.repository.find({ order: { id: 'ASC' } });
    }

    findById(id: number): Promise<CompanyResearch | null> {
        return this.repository.findOneBy({ id });
    }

    create(
        dto: CreateCompanyResearchDto,
        perplexityResearch: CompanyResearchResult,
    ): Promise<CompanyResearch> {
        const newCompanyResearch = this.repository.create({
            jobId: dto.jobId,
            company: dto.companyName,
            ...perplexityResearch,
        });

        return this.repository.save(newCompanyResearch);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.repository.delete(id);

        return (result.affected ?? 0) > 0;
    }
}
