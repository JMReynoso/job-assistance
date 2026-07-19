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
 * Dummy entity. This is a template — copy this folder's shape
 * (entity / dto / repository / service / controller / module) for real ones.
 */
@Entity({ name: 'examples' })
export class Job {
    @ApiProperty({ example: 1, description: 'Auto-generated primary key' })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({ example: 'Sample widget' })
    @Column({ type: 'text' })
    companyName: string;

    @ApiProperty({
        example: 'A short description of the widget.',
    })
    @Column({ type: 'text' })
    jobPostingURL: string;

    @ApiProperty({ example: 'Sample widget' })
    @Column({ type: 'text' })
    companyPage: string;

    @ApiProperty({ example: 'Sample widget' })
    @Column({ type: 'text' })
    companyLinkedIn: string;

    @ApiProperty({ example: 'Sample widget' })
    @Column({ type: 'text', nullable: true })
    extraURLs?: string;

    @ApiProperty({ example: 'Sample widget' })
    @Column({ type: 'text' })
    status: Status;

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
