import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the per-angle `reports` and full `sources` columns with a single
 * `summary` text column: `urls` is already the stripped version of `sources`, and
 * `summary` is the combined version of `reports`. Added with a temporary default
 * so it applies cleanly to any existing rows, then the default is dropped to match
 * the entity (NOT NULL, no default).
 */
export class CompanyResearchSummaryColumn1784468000000
    implements MigrationInterface
{
    name = 'CompanyResearchSummaryColumn1784468000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "company_research" ADD COLUMN "summary" text NOT NULL DEFAULT ''`,
        );
        await queryRunner.query(
            `ALTER TABLE "company_research" ALTER COLUMN "summary" DROP DEFAULT`,
        );
        await queryRunner.query(
            `ALTER TABLE "company_research" DROP COLUMN "reports"`,
        );
        await queryRunner.query(
            `ALTER TABLE "company_research" DROP COLUMN "sources"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "company_research" ADD COLUMN "sources" jsonb NOT NULL DEFAULT '[]'::jsonb`,
        );
        await queryRunner.query(
            `ALTER TABLE "company_research" ALTER COLUMN "sources" DROP DEFAULT`,
        );
        await queryRunner.query(
            `ALTER TABLE "company_research" ADD COLUMN "reports" jsonb NOT NULL DEFAULT '[]'::jsonb`,
        );
        await queryRunner.query(
            `ALTER TABLE "company_research" ALTER COLUMN "reports" DROP DEFAULT`,
        );
        await queryRunner.query(
            `ALTER TABLE "company_research" DROP COLUMN "summary"`,
        );
    }
}
