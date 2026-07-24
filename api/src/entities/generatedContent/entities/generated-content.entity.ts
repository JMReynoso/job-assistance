import { ApiProperty } from '@nestjs/swagger';
import Anthropic from '@anthropic-ai/sdk';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

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
        description: 'Token usage for the outreach message call',
        example: { input_tokens: 1500, output_tokens: 800 },
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    outreachMessageUsage?: Anthropic.Message['usage'];

    @ApiProperty({
        description: 'Token usage for the follow-up message call',
        example: { input_tokens: 1500, output_tokens: 800 },
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    followupMessageUsage?: Anthropic.Message['usage'];

    @ApiProperty({
        description: 'Token usage for the tailored resume call',
        example: { input_tokens: 6000, output_tokens: 4000 },
        nullable: true,
    })
    @Column({ type: 'jsonb', nullable: true })
    tailoredResumeUsage?: Anthropic.Message['usage'];

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

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
