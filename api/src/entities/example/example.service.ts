import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateExampleDto } from './dto/create-example.dto';
import { UpdateExampleDto } from './dto/update-example.dto';
import { Example } from './example.entity';
import { ExampleRepository } from './example.repository';

@Injectable()
export class ExampleService {
  constructor(private readonly exampleRepository: ExampleRepository) {}

  findAll(): Promise<Example[]> {
    return this.exampleRepository.findAll();
  }

  async findOne(id: number): Promise<Example> {
    const example = await this.exampleRepository.findById(id);
    if (!example) {
      throw new NotFoundException(`Example with id ${id} not found`);
    }
    return example;
  }

  create(dto: CreateExampleDto): Promise<Example> {
    return this.exampleRepository.create(dto);
  }

  async update(id: number, dto: UpdateExampleDto): Promise<Example> {
    await this.findOne(id); // 404s before attempting the update
    const updated = await this.exampleRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Example with id ${id} not found`);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.exampleRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Example with id ${id} not found`);
    }
  }
}
