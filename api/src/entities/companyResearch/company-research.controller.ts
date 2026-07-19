import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CompanyResearchService } from './company-research.service';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';
import { CompanyResearch } from './entities/company-research.entity';

@Controller('company-research')
export class CompanyResearchController {
    constructor(
        private readonly companyResearchService: CompanyResearchService,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Run and persist company research for a job' })
    @ApiResponse({
        status: 201,
        description: 'The created company research.',
        type: CompanyResearch,
    })
    create(@Body() createCompanyResearchDto: CreateCompanyResearchDto) {
        return this.companyResearchService.create(createCompanyResearchDto);
    }

    @Get()
    @ApiOperation({ summary: 'List all company research' })
    @ApiResponse({
        status: 200,
        description: 'The list of company research.',
        type: CompanyResearch,
        isArray: true,
    })
    findAll() {
        return this.companyResearchService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single company research by id' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The matching company research.',
        type: CompanyResearch,
    })
    @ApiResponse({
        status: 404,
        description: 'No company research with that id.',
    })
    findOne(@Param('id') id: string) {
        return this.companyResearchService.findOne(+id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a company research' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The company research was deleted.',
    })
    @ApiResponse({
        status: 404,
        description: 'No company research with that id.',
    })
    remove(@Param('id') id: string) {
        return this.companyResearchService.remove(+id);
    }
}
