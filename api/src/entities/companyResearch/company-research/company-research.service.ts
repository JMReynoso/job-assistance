import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';
import { UpdateCompanyResearchDto } from './dto/update-company-research.dto';
import { CompanyResearch } from './entities/company-research.entity';
import { CompanyResearchRepository } from './company-research.repository';

@Injectable()
export class CompanyResearchService {
  constructor(
    private readonly companyResearchRepository: CompanyResearchRepository,
  ) {}

  findAll(): Promise<CompanyResearch[]> {
    return this.companyResearchRepository.findAll();
  }

  async findOne(id: number): Promise<CompanyResearch> {
    const companyResearch = await this.companyResearchRepository.findById(id);

    if (!companyResearch) {
      throw new NotFoundException(`CompanyResearch with id ${id} not found`);
    }
    return companyResearch;
  }

  create(dto: CreateCompanyResearchDto): Promise<CompanyResearch> {
    return this.companyResearchRepository.create(dto);
  }

  async update(
    id: number,
    dto: UpdateCompanyResearchDto,
  ): Promise<CompanyResearch> {
    await this.findOne(id); // 404s before attempting the update

    const updated = await this.companyResearchRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`CompanyResearch with id ${id} not found`);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.companyResearchRepository.delete(id);
    
    if (!deleted) {
      throw new NotFoundException(`CompanyResearch with id ${id} not found`);
    }
  }
}
