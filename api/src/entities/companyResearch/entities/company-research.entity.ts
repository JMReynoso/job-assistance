import { ApiProperty } from '@nestjs/swagger';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { CompanyResearchResult } from '../../../externalAPIs/perplexity/perplexity.service';

/**
 * A persisted snapshot of one Perplexity company-research run.
 *
 * The columns mirror {@link CompanyResearchResult} — the shape PerplexityService
 * returns — so `research()`'s output can be saved verbatim. `summary` is the two
 * angles' 5-bullet summaries combined into one text block; `urls` and `usage` are
 * stored as `jsonb` and typed off the service interface, keeping a single source
 * of truth: change the result shape there and these columns follow.
 */
@Entity({ name: 'company_research' })
export class CompanyResearch {
    @ApiProperty({ example: 1, description: 'Auto-generated primary key' })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({
        example: 1,
        description: 'FK to the job this research belongs to',
    })
    @Column({ type: 'int' })
    jobId: number;

    @ApiProperty({
        example: 'Acme Corp',
        description:
            'The company this research is about (the `research()` argument).',
    })
    @Column({ type: 'text' })
    company: string;

    @ApiProperty({
        description:
            "The two angles' 5-bullet summaries (company-product-funding, then " +
            'eng-culture-stack) combined into one block, separated by four ' +
            'newlines and a 10-dash rule.',
        example:
            '- Acme builds developer tooling for CI/CD.\n- Raised a $20M Series A in 2024.' +
            '\n\n\n\n----------\n\n\n\n' +
            '- Engineering is TypeScript-heavy (NestJS + React).\n- Strong testing culture.',
    })
    @Column({ type: 'text' })
    summary: string;

    @ApiProperty({
        description: 'The deduped source URLs, in ranked order.',
        example: ['https://acme.com/about', 'https://acme.com/blog'],
    })
    @Column({ type: 'jsonb' })
    urls: string[];

    @ApiProperty({
        description: 'Combined usage/cost across the angle calls.',
        example: {
            totalCost: 0.0123,
            searches: 9,
            promptTokens: 1500,
            completionTokens: 2200,
        },
    })
    @Column({ type: 'jsonb' })
    usage: CompanyResearchResult['usage'];

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
