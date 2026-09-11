import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records which engine generated each row, now that Ollama can do everything
 * Claude does.
 *
 * Nullable with no default and no backfill: NULL means "written before this
 * column existed", and every such row was Claude's. Reads treat NULL as
 * 'claude' rather than guessing.
 *
 * This is also what disambiguates the cost columns. An Ollama row has cost 0
 * and NULL usage — not because the call went unrecorded, but because it was
 * free. Without this column those are indistinguishable from a Claude call
 * against a model missing from the price list.
 */
export class GeneratedContentProvider1784469100000 implements MigrationInterface {
    name = 'GeneratedContentProvider1784469100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "provider" text`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "provider"`,
        );
    }
}
