import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyResearchService } from './company-research.service';
import { CreateCompanyResearchDto } from './dto/create-company-research.dto';
import { CompanyResearch } from './entities/company-research.entity';

@ApiTags('company-research')
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

    @Get('by-job/:jobId')
    @ApiOperation({
        summary: 'Get the latest company research for a job',
        description:
            'A job can be researched more than once; this returns the most ' +
            'recent run. A job that has never been researched returns null, ' +
            'not a 404 — having no research yet is the normal state of a job ' +
            'you just added.',
    })
    @ApiParam({ name: 'jobId', type: Number })
    @ApiResponse({
        status: 200,
        description: "The job's latest company research, or null.",
        type: CompanyResearch,
    })
    findByJob(
        @Param('jobId', ParseIntPipe) jobId: number,
    ): Promise<CompanyResearch | null> {
        return this.companyResearchService.findByJobId(jobId);
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
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a company research' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 204,
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
