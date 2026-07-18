import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';
import { UpdateCompanyResearchDto } from './dto/update-company-research.dto';
import { CompanyResearch } from './entities/company-research.entity';

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

  create(dto: CreateCompanyResearchDto): Promise<CompanyResearch> {
    const companyResearch = this.repository.create(dto);

    return this.repository.save(companyResearch);
  }

  async update(
    id: number,
    dto: UpdateCompanyResearchDto,
  ): Promise<CompanyResearch | null> {
    await this.repository.update(id, dto);

    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    
    return (result.affected ?? 0) > 0;
  }
}
