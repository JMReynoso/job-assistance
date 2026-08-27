import { ApiProperty } from '@nestjs/swagger';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Status } from './enum/status.enum';

/**
 * A job the user is tracking: the company, the posting and research URLs, and
 * where it sits in the application pipeline (`status`). CompanyResearch and
 * GeneratedContent rows reference a job by `jobId`.
 */
@Entity({ name: 'jobs' })
export class Job {
    @ApiProperty({ example: 1, description: 'Auto-generated primary key' })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({
        example: 'Acme Corp',
        description: 'Company the job is with',
    })
    @Column({ type: 'text' })
    companyName: string;

    @ApiProperty({
        example: 'https://boards.greenhouse.io/acme/jobs/123456',
        description: 'URL of the original job posting',
    })
    @Column({ type: 'text' })
    jobPostingURL: string;

    @ApiProperty({
        example: 'https://www.acme.com',
        description: "Company's main website",
    })
    @Column({ type: 'text' })
    companyPage: string;

    @ApiProperty({
        example: 'https://www.linkedin.com/company/acme-corp',
        description: "Company's LinkedIn page",
    })
    @Column({ type: 'text' })
    companyLinkedIn: string;

    @ApiProperty({
        example: 'https://www.crunchbase.com/organization/acme-corp',
        description: 'Any additional relevant URL',
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    extraURLs?: string;

    @ApiProperty({
        example: 'We are looking for a Senior Backend Engineer with Node.js…',
        description:
            'The full job posting text, pasted once and reused by every ' +
            'generation and regeneration.',
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    jobDescription?: string;

    @ApiProperty({
        enum: Status,
        example: Status.NOT_APPLIED,
        description: 'Where the job sits in the application pipeline',
    })
    @Column({ type: 'text', default: Status.NOT_APPLIED })
    status: Status;

    // Both are `date` columns, which TypeORM hydrates to a 'YYYY-MM-DD' string
    // rather than a Date — the exact format an <input type="date"> expects, so
    // the frontend needs no formatting layer in either direction.
    //
    // Neither is nullable: a job has both from the moment it's created (the
    // column default fills them with today), so there's no empty state to
    // render, and the DTO refuses to write one back as blank.

    @ApiProperty({
        example: '2026-07-03',
        description:
            'Calendar day the application was submitted; defaults to the day ' +
            'the job was created',
    })
    @Column({ type: 'date', default: () => 'CURRENT_DATE' })
    dateApplied: string;

    @ApiProperty({
        example: '2026-07-09',
        description:
            'Calendar day the company was last heard from; defaults to the ' +
            'day the job was created',
    })
    @Column({ type: 'date', default: () => 'CURRENT_DATE' })
    dateLastContacted: string;

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
