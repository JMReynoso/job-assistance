import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GeneratedContentService } from './generated-content.service';
import { CreateGeneratedContentDto } from './dto/create-generated-content.dto';
import { UpdateGeneratedContentDto } from './dto/update-generated-content.dto';

@Controller('generated-content')
export class GeneratedContentController {
  constructor(
    private readonly generatedContentService: GeneratedContentService,
  ) {}

  @Post()
  create(@Body() createGeneratedContentDto: CreateGeneratedContentDto) {
    return this.generatedContentService.create(createGeneratedContentDto);
  }

  @Get()
  findAll() {
    return this.generatedContentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.generatedContentService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateGeneratedContentDto: UpdateGeneratedContentDto,
  ) {
    return this.generatedContentService.update(+id, updateGeneratedContentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.generatedContentService.remove(+id);
  }
}
