import { Body, Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateJobDetailDto } from './dto/update-job-detail.dto';
import { JobDetailResponse } from './job-detail.response';
import { JobDetailService } from './job-detail.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobDetailController {
    constructor(private readonly jobDetailService: JobDetailService) {}

    // ':id/detail', never ':jobId/detail' — find-my-way throws AT BOOT for two
    // routes differing only by parameter name, and jobs.controller.ts already
    // owns PATCH /jobs/:id.
    @Patch(':id/detail')
    @ApiOperation({
        summary:
            "Apply the job detail window's edits across every entity it shows",
        description:
            'Updates the jobs row, the newest company_research summary, the ' +
            'newest generated_content messages, and the missing-keyword ' +
            'checkboxes in one call. Satellite rows that do not exist yet are ' +
            'skipped rather than created. Returns the whole job detail.',
    })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The job detail after the update.',
        type: JobDetailResponse,
    })
    @ApiResponse({ status: 404, description: 'No job with that id.' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateJobDetailDto,
    ): Promise<JobDetailResponse> {
        return this.jobDetailService.update(id, dto);
    }
}
