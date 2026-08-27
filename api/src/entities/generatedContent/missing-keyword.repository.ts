import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../base.repository';
import { MissingKeyword } from './entities/missing-keyword.entity';

/**
 * Everything that touches Postgres for missing_keywords lives here — same
 * discipline as {@link GeneratedContentRepository}.
 */
@Injectable()
export class MissingKeywordRepository extends BaseRepository {
    constructor(
        @InjectRepository(MissingKeyword)
        private readonly repository: Repository<MissingKeyword>,
    ) {
        super();
    }

    /** Ordered by id ASC — preserves Claude's "highest impact first" ordering. */
    findByContentId(generatedContentId: number): Promise<MissingKeyword[]> {
        return this.run(
            `fetching missing keywords for generated content ${generatedContentId}`,
            () =>
                this.repository.find({
                    where: { generatedContentId },
                    order: { id: 'ASC' },
                }),
        );
    }

    /**
     * Replaces the keyword list for a run — used after create()/regenerate()
     * scores a fresh set. Deletes existing rows first so the unique index
     * never rejects an upsert as a duplicate.
     */
    async replaceForContent(
        generatedContentId: number,
        keywords: string[],
    ): Promise<MissingKeyword[]> {
        return this.run(
            `replacing missing keywords for generated content ${generatedContentId}`,
            async () => {
                await this.repository.delete({ generatedContentId });
                if (keywords.length === 0) {
                    return [];
                }
                const rows = this.repository.create(
                    keywords.map((keyword) => ({
                        generatedContentId,
                        keyword,
                        include: false,
                    })),
                );
                return this.repository.save(rows);
            },
        );
    }

    /**
     * Marks exactly the given keywords as included and everything else for
     * this run as not — called before regeneration so the user's checkbox
     * state is durable even if the Claude call that follows fails.
     */
    async setIncluded(
        generatedContentId: number,
        keywords: string[],
    ): Promise<void> {
        await this.run(
            `updating included keywords for generated content ${generatedContentId}`,
            async () => {
                await this.repository.update({ generatedContentId }, { include: false });
                if (keywords.length > 0) {
                    await this.repository.update(
                        { generatedContentId, keyword: In(keywords) },
                        { include: true },
                    );
                }
            },
        );
    }
}
