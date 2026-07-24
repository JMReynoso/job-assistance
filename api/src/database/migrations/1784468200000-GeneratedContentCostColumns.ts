import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds per-call estimated USD cost columns to generated_content, alongside the
 * existing jsonb `*Usage` columns. Nullable with no default: existing rows keep
 * NULL, and new rows get the cost computed in ClaudeService.
 */
export class GeneratedContentCostColumns1784468200000 implements MigrationInterface {
    name = 'GeneratedContentCostColumns1784468200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "outreachMessageCost" double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "followupMessageCost" double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "tailoredResumeCost" double precision`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "tailoredResumeCost"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "followupMessageCost"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "outreachMessageCost"`,
        );
    }
}
