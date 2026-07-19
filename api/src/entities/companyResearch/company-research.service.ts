import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';
import { CompanyResearch } from './entities/company-research.entity';
import { CompanyResearchRepository } from './company-research.repository';
import { CompanyResearchResult, research } from '../../perplexity/perplexity.service';

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

  create(createCompanyResearchDto: CreateCompanyResearchDto): Promise<CompanyResearch> {
    const jobId = createCompanyResearchDto.jobId;

    const URLs = [
        createCompanyResearchDto.jobPostingUrl,
        createCompanyResearchDto.companyPageUrl,
        createCompanyResearchDto.companyLinkedInUrl,
        ...(createCompanyResearchDto.extraLinks ? createCompanyResearchDto.extraLinks.split('\n') : []),
      ].map(url => url.trim()).filter((url): url is string => !!url);
    
    const companyResearch: CompanyResearchResult = 
      research(createCompanyResearchDto.companyName, {verifyURLs: URLs});

    return this.companyResearchRepository.create(createCompanyResearchDto, companyResearch);
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.companyResearchRepository.delete(id);
    
    if (!deleted) {
      throw new NotFoundException(`CompanyResearch with id ${id} not found`);
    }
  }
}
