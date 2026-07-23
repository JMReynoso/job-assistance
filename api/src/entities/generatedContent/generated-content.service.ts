import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateGeneratedContentDto } from './dto/create-generated-content.dto';
import { UpdateGeneratedContentDto } from './dto/update-generated-content.dto';
import { GeneratedContent } from './entities/generated-content.entity';
import { GeneratedContentRepository } from './generated-content.repository';

@Injectable()
export class GeneratedContentService {
    constructor(
        private readonly generatedContentRepository: GeneratedContentRepository,
    ) {}

    findAll(): Promise<GeneratedContent[]> {
        return this.generatedContentRepository.findAll();
    }

    async findOne(id: number): Promise<GeneratedContent> {
        const generatedContent =
            await this.generatedContentRepository.findById(id);
        if (!generatedContent) {
            throw new NotFoundException(
                `GeneratedContent with id ${id} not found`,
            );
        }
        return generatedContent;
    }

    create(dto: CreateGeneratedContentDto): Promise<GeneratedContent> {

        // TODO: create migration and seeds

        // call claude outreach message (returns a string)

        // call claude follow up message (returns a string)

        // call resume tailoring service (returns a json)

        // call method that converts a json to a pdf (fixed Handlebars/React template → Puppeteer → PDF → save to server → return path to file)

        //build DTO with the results of the above calls


        return this.generatedContentRepository.create(dto);
    }

    async update(
        id: number,
        dto: UpdateGeneratedContentDto,
    ): Promise<GeneratedContent> {
        await this.findOne(id); // 404s before attempting the update
        const updated = await this.generatedContentRepository.update(id, dto);
        if (!updated) {
            throw new NotFoundException(
                `GeneratedContent with id ${id} not found`,
            );
        }
        return updated;
    }

    async remove(id: number): Promise<void> {
        const deleted = await this.generatedContentRepository.delete(id);
        if (!deleted) {
            throw new NotFoundException(
                `GeneratedContent with id ${id} not found`,
            );
        }
    }
}
