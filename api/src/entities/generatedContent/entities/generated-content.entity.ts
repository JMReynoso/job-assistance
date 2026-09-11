import { ApiProperty } from '@nestjs/swagger';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { AiProviderName } from '../../../externalAPIs/ai/ai-provider.interface';
import type { ClaudeUsage } from '../../../externalAPIs/claude/claude.types';

@Entity({ name: 'generated_content' })
export class GeneratedContent {
    @ApiProperty({ example: 1, description: 'Auto-generated primary key' })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({
        example: 1,
        description: 'FK to the job this content belongs to',
    })
    @Column({ type: 'int' })
    jobId: number;

    @ApiProperty({
        example: 'Hi Jane, I came across your posting for...',
        description: 'Drafted outreach message for this job',
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    outreachMessage?: string;

    @ApiProperty({
        example: 'Hi Jane, just following up on my earlier message...',
        description: 'Drafted follow-up message for this job',
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    followupMessage?: string;

    @ApiProperty({
        example: 'resumes/acme-corp-frontend.pdf',
        description: 'Path to the tailored resume file for this job',
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    tailoredResume?: string;

    @ApiProperty({
        description:
            'Token usage for the outreach message call. Claude only — NULL when the row was generated locally.',
        example: { input_tokens: 1500, output_tokens: 800 },
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    outreachMessageUsage?: ClaudeUsage;

    @ApiProperty({
        description:
            'Token usage for the follow-up message call. Claude only — NULL when the row was generated locally.',
        example: { input_tokens: 1500, output_tokens: 800 },
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    followupMessageUsage?: ClaudeUsage;

    @ApiProperty({
        description:
            'Token usage for the tailored resume call. Claude only — NULL when the row was generated locally.',
        example: { input_tokens: 6000, output_tokens: 4000 },
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    tailoredResumeUsage?: ClaudeUsage;

    @ApiProperty({
        example: 0.0123,
        description: 'Estimated USD cost of the outreach message call',
        nullable: true,
    })
    @Column({ type: 'float', nullable: true })
    outreachMessageCost?: number;

    @ApiProperty({
        example: 0.0123,
        description: 'Estimated USD cost of the follow-up message call',
        nullable: true,
    })
    @Column({ type: 'float', nullable: true })
    followupMessageCost?: number;

    @ApiProperty({
        example: 0.1314,
        description: 'Estimated USD cost of the tailored resume call',
        nullable: true,
    })
    @Column({ type: 'float', nullable: true })
    tailoredResumeCost?: number;

    @ApiProperty({
        description:
            'The exact resume JSON the current tailoredResume PDF was rendered from — what regenerate() reads',
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    tailoredResumeJson?: Record<string, unknown>;

    @ApiProperty({
        example: 'John_Doe_Acme_Corp_1.json',
        description:
            'File name of the tailored resume JSON, saved alongside the PDF',
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    tailoredResumeJsonPath?: string;

    @ApiProperty({
        example: 72,
        description:
            'How well the tailored resume matches the job description, 0-100',
        nullable: true,
    })
    @Column({ type: 'int', nullable: true })
    jdMatchPercent?: number;

    @ApiProperty({
        description:
            'Token usage for the most recent JD-match scoring call. Claude only — NULL when the row was generated locally.',
        example: { input_tokens: 3000, output_tokens: 400 },
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    jdMatchUsage?: ClaudeUsage;

    @ApiProperty({
        example: 0.0231,
        description:
            'Cumulative estimated USD cost of all JD-match scoring calls for this row',
        nullable: true,
    })
    @Column({ type: 'float', nullable: true })
    jdMatchCost?: number;

    @ApiProperty({
        description:
            'Token usage for the most recent resume-regeneration call. Claude only — NULL when the row was generated locally.',
        example: { input_tokens: 6000, output_tokens: 4000 },
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    regenerateUsage?: ClaudeUsage;

    @ApiProperty({
        example: 0.1314,
        description:
            'Cumulative estimated USD cost of all resume-regeneration calls for this row',
        nullable: true,
    })
    @Column({ type: 'float', nullable: true })
    regenerateCost?: number;

    @ApiProperty({
        example: 0,
        description: 'How many times the tailored resume has been regenerated',
    })
    @Column({ type: 'int', default: 0 })
    regenerateCount: number;

    @ApiProperty({
        example: 'ollama',
        description:
            'Which engine generated this row. NULL on rows written before ' +
            'the local engine existed, which were all Claude.',
        nullable: true,
        enum: ['claude', 'ollama'],
    })
    @Column({ type: 'text', nullable: true })
    provider?: AiProviderName;

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
