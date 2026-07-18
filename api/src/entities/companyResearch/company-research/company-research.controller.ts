import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CompanyResearchService } from './company-research.service';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';
import { UpdateCompanyResearchDto } from './dto/update-company-research.dto';

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

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCompanyResearchDto: UpdateCompanyResearchDto) {
    return this.companyResearchService.update(+id, updateCompanyResearchDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companyResearchService.remove(+id);
  }
}
