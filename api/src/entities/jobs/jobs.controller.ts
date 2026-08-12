import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './job.entity';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
    constructor(private readonly jobsService: JobsService) {}

    @Get()
    @ApiOperation({ summary: 'List all jobs' })
    @ApiResponse({
        status: 200,
        description: 'The list of jobs.',
        type: Job,
        isArray: true,
    })
    findAll(): Promise<Job[]> {
        return this.jobsService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single job by id' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The matching job.',
        type: Job,
    })
    @ApiResponse({ status: 404, description: 'No job with that id.' })
    findOne(@Param('id', ParseIntPipe) id: number): Promise<Job> {
        return this.jobsService.findOne(id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new job' })
    @ApiResponse({
        status: 201,
        description: 'The created job.',
        type: Job,
    })
    create(@Body() dto: CreateJobDto): Promise<Job> {
        return this.jobsService.create(dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an existing job' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The updated job.',
        type: Job,
    })
    @ApiResponse({ status: 404, description: 'No job with that id.' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateJobDto,
    ): Promise<Job> {
        return this.jobsService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a job' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 204, description: 'The job was deleted.' })
    @ApiResponse({ status: 404, description: 'No job with that id.' })
    remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.jobsService.remove(id);
    }
}
