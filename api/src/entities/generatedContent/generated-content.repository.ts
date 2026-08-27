import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { BaseRepository } from '../base.repository';
import { UpdateGeneratedContentDto } from './dto/update-generated-content.dto';
import { GeneratedContent } from './entities/generated-content.entity';

/**
 * Everything that touches Postgres for this entity lives here. The service
 * layer talks to this class, never to TypeORM's Repository<GeneratedContent>
 * directly — so if the storage layer ever changes, this is the only file that
 * has to. Error handling comes from {@link BaseRepository}.
 */
@Injectable()
export class GeneratedContentRepository extends BaseRepository {
    constructor(
        @InjectRepository(GeneratedContent)
        private readonly repository: Repository<GeneratedContent>,
    ) {
        super();
    }

    findAll(): Promise<GeneratedContent[]> {
        return this.run('fetching all generated content', () =>
            this.repository.find({ order: { id: 'ASC' } }),
        );
    }

    findById(id: number): Promise<GeneratedContent | null> {
        return this.run(`fetching generated content ${id}`, () =>
            this.repository.findOneBy({ id }),
        );
    }

    /**
     * The most recent generation run for a job. A job can be regenerated, so
     * order by id DESC and take the latest — the same rule company research
     * follows.
     */
    findByJobId(jobId: number): Promise<GeneratedContent | null> {
        return this.run(`fetching generated content for job ${jobId}`, () =>
            this.repository.findOne({
                where: { jobId },
                order: { id: 'DESC' },
            }),
        );
    }

    create(data: GeneratedContent): Promise<GeneratedContent> {
        const generatedContent = this.repository.create(data);
        return this.run('saving new generated content', () =>
            this.repository.save(generatedContent),
        );
    }

    async update(
        id: number,
        dto: UpdateGeneratedContentDto,
    ): Promise<GeneratedContent | null> {
        await this.run(`updating generated content ${id}`, () =>
            this.repository.update(id, dto),
        );
        return this.findById(id);
    }

    /**
     * Internal counterpart to {@link update}: writes server-computed columns
     * (usage, cost, match score, regenerate count…) that never appear on
     * {@link UpdateGeneratedContentDto} because a client never supplies them.
     * Used by regenerate() to persist its result in one place.
     */
    async updateFields(
        id: number,
        patch: Partial<GeneratedContent>,
    ): Promise<GeneratedContent> {
        return this.run(`updating generated content ${id}`, async () => {
            // TypeORM's QueryDeepPartialEntity recursively maps jsonb object
            // columns in a way a plain Record<string, unknown> value can't
            // satisfy structurally, even though it's exactly what's stored.
            // The cast stays local to this one call, not the public signature.
            await this.repository.update(
                id,
                patch as QueryDeepPartialEntity<GeneratedContent>,
            );
            return this.repository.findOneOrFail({ where: { id } });
        });
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.run(`deleting generated content ${id}`, () =>
            this.repository.delete(id),
        );
        return (result.affected ?? 0) > 0;
    }
}
