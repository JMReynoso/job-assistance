import { ApiProperty } from '@nestjs/swagger';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * One person found at a company we're applying to — the outreach target.
 *
 * The columns mirror {@link HunterEmail}, the shape HunterService's
 * `domainSearch()` returns, so a lookup result can be saved with only a
 * snake_case → camelCase rename. Rows are keyed to a job by `jobId`, the same
 * way CompanyResearch and GeneratedContent are.
 *
 * The unique index on (jobId, email) is what makes re-running a lookup safe:
 * the repository upserts against it instead of inserting the same person twice.
 */
@Entity({ name: 'contacts' })
@Index('UQ_contacts_job_email', ['jobId', 'email'], { unique: true })
export class Contact {
    @ApiProperty({ example: 1, description: 'Auto-generated primary key' })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({
        example: 1,
        description: 'FK to the job this contact belongs to',
    })
    @Column({ type: 'int' })
    jobId: number;

    @ApiProperty({
        example: 'jane.doe@acme.com',
        description: 'The email address Hunter found for this person',
    })
    @Column({ type: 'text' })
    email: string;

    @ApiProperty({
        example: 'Jane',
        description: "Person's first name; Hunter often has no name at all",
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    firstName?: string;

    @ApiProperty({
        example: 'Doe',
        description: "Person's last name; Hunter often has no name at all",
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    lastName?: string;

    @ApiProperty({
        example: 'Engineering Manager',
        description: "The person's role at the company, when Hunter knows it",
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    position?: string;

    @ApiProperty({
        example: 'https://www.linkedin.com/in/janedoe',
        description:
            "The person's LinkedIn profile, when Hunter has one for them",
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    linkedin?: string;

    @ApiProperty({
        example: 92,
        description:
            '0–100 confidence that the address is deliverable. 90+ is safe to ' +
            'use, 50–89 expect the occasional bounce, under 50 is a guess.',
    })
    @Column({ type: 'int' })
    confidence: number;

    @ApiProperty({
        example: 'personal',
        enum: ['personal', 'generic'],
        description:
            "'personal' is a real person, 'generic' a role address like info@.",
    })
    @Column({ type: 'text', default: 'personal' })
    type: 'personal' | 'generic';

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
