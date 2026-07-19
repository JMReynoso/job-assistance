import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { CompanyResearchService } from './company-research.service';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';

@Controller('company-research')
export class CompanyResearchController {
  constructor(private readonly companyResearchService: CompanyResearchService) {}

  @Post()
  create(@Body() createCompanyResearchDto: CreateCompanyResearchDto) {
    return this.companyResearchService.create(createCompanyResearchDto);
  }

  @Get()
  findAll() {
    return this.companyResearchService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companyResearchService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companyResearchService.remove(+id);
  }
}
