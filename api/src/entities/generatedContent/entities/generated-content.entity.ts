import { ApiProperty } from '@nestjs/swagger';
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
    resumePath?: string;

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
