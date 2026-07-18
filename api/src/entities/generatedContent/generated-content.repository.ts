import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateGeneratedContentDto } from './dto/create-generated-content.dto';
import { UpdateGeneratedContentDto } from './dto/update-generated-content.dto';
import { GeneratedContent } from './entities/generated-content.entity';

/**
 * Everything that touches Postgres for this entity lives here. The service
 * layer talks to this class, never to TypeORM's Repository<GeneratedContent>
 * directly — so if the storage layer ever changes, this is the only file that
 * has to.
 */
@Injectable()
export class GeneratedContentRepository {
  constructor(
    @InjectRepository(GeneratedContent)
    private readonly repository: Repository<GeneratedContent>,
  ) {}

  findAll(): Promise<GeneratedContent[]> {
    return this.repository.find({ order: { id: 'ASC' } });
  }

  findById(id: number): Promise<GeneratedContent | null> {
    return this.repository.findOneBy({ id });
  }

  create(dto: CreateGeneratedContentDto): Promise<GeneratedContent> {
    const generatedContent = this.repository.create(dto);
    return this.repository.save(generatedContent);
  }

  async update(
    id: number,
    dto: UpdateGeneratedContentDto,
  ): Promise<GeneratedContent | null> {
    await this.repository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
