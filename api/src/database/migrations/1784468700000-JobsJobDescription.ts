import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the full job posting text to jobs. Nullable with no default: existing
 * jobs keep NULL and generated-content falls back to the DTO's jobPosting.
 */
export class JobsJobDescription1784468700000 implements MigrationInterface {
    name = 'JobsJobDescription1784468700000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "jobs" ADD COLUMN "jobDescription" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "jobDescription"`);
    }
}
