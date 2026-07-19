import { ApiProperty } from '@nestjs/swagger';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * Dummy entity. This is a template — copy this folder's shape
 * (entity / dto / repository / service / controller / module) for real ones.
 */
@Entity({ name: 'examples' })
export class Example {
    @ApiProperty({ example: 1, description: 'Auto-generated primary key' })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({ example: 'Sample widget' })
    @Column({ type: 'text' })
    name: string;

    @ApiProperty({
        example: 'A short description of the widget.',
        nullable: true,
    })
    @Column({ type: 'text', nullable: true })
    description: string | null;

    @ApiProperty()
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
