import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GeneratedContentService } from './generated-content.service';
import { CreateGeneratedContentDto } from './dto/create-generated-content.dto';
import { UpdateGeneratedContentDto } from './dto/update-generated-content.dto';
import { GeneratedContent } from './entities/generated-content.entity';

@ApiTags('generated-content')
@Controller('generated-content')
export class GeneratedContentController {
    constructor(
        private readonly generatedContentService: GeneratedContentService,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Generate and persist content for a job' })
    @ApiResponse({
        status: 201,
        description: 'The created generated content.',
        type: GeneratedContent,
    })
    create(@Body() createGeneratedContentDto: CreateGeneratedContentDto) {
        return this.generatedContentService.create(createGeneratedContentDto);
    }

    @Get()
    @ApiOperation({ summary: 'List all generated content' })
    @ApiResponse({
        status: 200,
        description: 'The list of generated content.',
        type: GeneratedContent,
        isArray: true,
    })
    findAll() {
        return this.generatedContentService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single generated content by id' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The matching generated content.',
        type: GeneratedContent,
    })
    @ApiResponse({
        status: 404,
        description: 'No generated content with that id.',
    })
    findOne(@Param('id') id: string) {
        return this.generatedContentService.findOne(+id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an existing generated content' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The updated generated content.',
        type: GeneratedContent,
    })
    @ApiResponse({
        status: 404,
        description: 'No generated content with that id.',
    })
    update(
        @Param('id') id: string,
        @Body() updateGeneratedContentDto: UpdateGeneratedContentDto,
    ) {
        return this.generatedContentService.update(
            +id,
            updateGeneratedContentDto,
        );
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a generated content' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 204,
        description: 'The generated content was deleted.',
    })
    @ApiResponse({
        status: 404,
        description: 'No generated content with that id.',
    })
    remove(@Param('id') id: string) {
        return this.generatedContentService.remove(+id);
    }
}
