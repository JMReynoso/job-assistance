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
import { CreateExampleDto } from './dto/create-example.dto';
import { UpdateExampleDto } from './dto/update-example.dto';
import { Example } from './example.entity';
import { ExampleService } from './example.service';

@ApiTags('examples')
@Controller('examples')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get()
  @ApiOperation({ summary: 'List all examples' })
  @ApiResponse({
    status: 200,
    description: 'The list of examples.',
    type: Example,
    isArray: true,
  })
  findAll(): Promise<Example[]> {
    return this.exampleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single example by id' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'The matching example.',
    type: Example,
  })
  @ApiResponse({ status: 404, description: 'No example with that id.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Example> {
    return this.exampleService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new example' })
  @ApiResponse({
    status: 201,
    description: 'The created example.',
    type: Example,
  })
  create(@Body() dto: CreateExampleDto): Promise<Example> {
    return this.exampleService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing example' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'The updated example.',
    type: Example,
  })
  @ApiResponse({ status: 404, description: 'No example with that id.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExampleDto,
  ): Promise<Example> {
    return this.exampleService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an example' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'The example was deleted.' })
  @ApiResponse({ status: 404, description: 'No example with that id.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.exampleService.remove(id);
  }
}
