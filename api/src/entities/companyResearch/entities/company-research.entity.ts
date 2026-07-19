import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  CompanyResearchResult,
  RankedSource,
} from '../../../externalAPIs/perplexity/perplexity.service';

/**
 * A persisted snapshot of one Perplexity company-research run.
 *
 * The columns mirror {@link CompanyResearchResult} — the shape PerplexityService
 * returns — so `research()`'s output can be saved verbatim. The structured
 * fields (reports / sources / urls / usage) are stored as `jsonb` and typed off
 * the service interfaces, keeping a single source of truth: change the result
 * shape there and these columns follow.
 */
@Entity({ name: 'company_research' })
export class CompanyResearch {
  @ApiProperty({ example: 1, description: 'Auto-generated primary key' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1, description: 'Auto-generated foreign key' })
  @PrimaryGeneratedColumn()
  jobId: number;

  @ApiProperty({
    example: 'Acme Corp',
    description: 'The company this research is about (the `research()` argument).',
  })
  @Column({ type: 'text' })
  company: string;

  @ApiProperty({
    description: "Each angle's written report — distinct, not deduped.",
    example: [
      {
        angle: 'company-product-funding',
        content: 'Acme builds ... and raised a $20M Series A in 2024 ...',
      },
    ],
  })
  @Column({ type: 'jsonb' })
  reports: CompanyResearchResult['reports'];

  @ApiProperty({
    description: 'Deduped, ranked sources across all angles.',
    example: [
      {
        title: 'About Acme',
        url: 'https://acme.com/about',
        date: '2024-03-01',
        last_updated: null,
        snippet: 'Acme is a ...',
        hits: 3,
      },
    ],
  })
  @Column({ type: 'jsonb' })
  sources: RankedSource[];

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
