import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratedContentController } from './generated-content.controller';
import { GeneratedContent } from './entities/generated-content.entity';
import { GeneratedContentRepository } from './generated-content.repository';
import { GeneratedContentService } from './generated-content.service';

@Module({
  imports: [TypeOrmModule.forFeature([GeneratedContent])],
  controllers: [GeneratedContentController],
  providers: [GeneratedContentService, GeneratedContentRepository],
  exports: [GeneratedContentService],
})
export class GeneratedContentModule {}
