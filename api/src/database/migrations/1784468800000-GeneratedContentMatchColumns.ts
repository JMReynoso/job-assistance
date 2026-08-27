import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds JD-match scoring and resume-regeneration columns to generated_content.
 * All nullable with no default: existing rows keep NULL until the next
 * create/regenerate populates them.
 *
 * tailoredResumeJson (jsonb) and tailoredResumeJsonPath (text) hold the same
 * resume JSON on purpose — the column is what regenerate() reads (so it
 * survives a resume-storage volume wipe), the path is the .json file saved
 * alongside the PDF for consistency with how tailoredResume stores the PDF's.
 *
 * regenerateCount defaults to 0 and is NOT NULL: it is incremented, not
 * merely set, so it needs a real starting value rather than NULL.
 *
 * *Cost accumulates across regenerates (it is a running total), but *Usage
 * holds only the most recent call's usage object. That knowingly breaks the
 * "cost is always re-derivable from usage" invariant elsewhere in this app —
 * the trade for keeping a single running total per row instead of a
 * per-call history table.
 */
export class GeneratedContentMatchColumns1784468800000 implements MigrationInterface {
    name = 'GeneratedContentMatchColumns1784468800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "tailoredResumeJson" jsonb`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "tailoredResumeJsonPath" text`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "jdMatchPercent" integer`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "jdMatchUsage" jsonb`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "jdMatchCost" double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "regenerateUsage" jsonb`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "regenerateCost" double precision`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" ADD COLUMN "regenerateCount" integer NOT NULL DEFAULT 0`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "regenerateCount"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "regenerateCost"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "regenerateUsage"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "jdMatchCost"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "jdMatchUsage"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "jdMatchPercent"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "tailoredResumeJsonPath"`,
        );
        await queryRunner.query(
            `ALTER TABLE "generated_content" DROP COLUMN "tailoredResumeJson"`,
        );
    }
}
