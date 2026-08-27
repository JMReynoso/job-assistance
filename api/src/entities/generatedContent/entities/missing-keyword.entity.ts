import { ApiProperty } from '@nestjs/swagger';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { GeneratedContent } from './generated-content.entity';

/**
 * One keyword a tailored resume is missing against its job description,
 * with whether the user has chosen to work it into a regeneration.
 *
 * Unlike every other satellite table in this schema, this one has a real
 * foreign key (see the CreateMissingKeywords migration) — ON DELETE CASCADE
 * is what makes DELETE /generated-content/:id clean up after itself instead
 * of stranding orphan rows. generatedContentId stays an explicit column
 * alongside the relation because the repository always writes/filters on the
 * raw id and never needs to hydrate `content`.
 */
@Entity({ name: 'missing_keywords' })
export class MissingKeyword {
    @ApiProperty({ example: 1, description: 'Auto-generated primary key' })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({
        example: 1,
        description: 'FK to the generated content run this keyword was scored against',
    })
    @Column({ type: 'int' })
    generatedContentId: number;

    @ManyToOne(() => GeneratedContent, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'generatedContentId' })
    content?: GeneratedContent;

    @ApiProperty({
        example: 'Kubernetes',
        description: "The missing keyword, in the job description's own wording",
    })
    @Column({ type: 'text' })
    keyword: string;

    @ApiProperty({
        example: false,
        description: 'Whether the user checked this keyword to include in the next regeneration',
    })
    @Column({ type: 'boolean', default: false })
    include: boolean;

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
