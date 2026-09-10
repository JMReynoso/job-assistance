import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One spelling per URL field. `jobs` was the odd table out — it said
 * `jobPostingURL` / `companyPage` / `companyLinkedIn` / `extraURLs` while
 * company_research's and contacts' DTOs already said `…Url`, so the same value
 * had two names depending on which endpoint you were holding.
 *
 * RENAME, not DROP + ADD: these columns are NOT NULL and full of real URLs.
 */
export class RenameJobUrlColumns1784469000000 implements MigrationInterface {
    name = 'RenameJobUrlColumns1784469000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "jobs" RENAME COLUMN "jobPostingURL" TO "jobPostingUrl"`,
        );
        await queryRunner.query(
            `ALTER TABLE "jobs" RENAME COLUMN "companyPage" TO "companyPageUrl"`,
        );
        await queryRunner.query(
            `ALTER TABLE "jobs" RENAME COLUMN "companyLinkedIn" TO "companyLinkedInUrl"`,
        );
        await queryRunner.query(
            `ALTER TABLE "jobs" RENAME COLUMN "extraURLs" TO "extraUrls"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "jobs" RENAME COLUMN "extraUrls" TO "extraURLs"`,
        );
        await queryRunner.query(
            `ALTER TABLE "jobs" RENAME COLUMN "companyLinkedInUrl" TO "companyLinkedIn"`,
        );
        await queryRunner.query(
            `ALTER TABLE "jobs" RENAME COLUMN "companyPageUrl" TO "companyPage"`,
        );
        await queryRunner.query(
            `ALTER TABLE "jobs" RENAME COLUMN "jobPostingUrl" TO "jobPostingURL"`,
        );
    }
}
