import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the two dates the tracker shows on every row: when the application went
 * out, and when the company was last heard from.
 *
 * Both NOT NULL, defaulting to the day the row is created — a job always has
 * these from the moment it exists, so there is no "unset" state to render or
 * guard against, and clearing one is not something the API accepts.
 *
 * `date`, not `timestamp`: these are calendar days the user picks in a date
 * input, with no time or zone to get wrong. Existing rows are backfilled with
 * CURRENT_DATE by the DEFAULT.
 */
export class JobsApplicationDates1784468500000 implements MigrationInterface {
    name = 'JobsApplicationDates1784468500000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "jobs" ADD COLUMN "dateApplied" date NOT NULL DEFAULT CURRENT_DATE`,
        );
        await queryRunner.query(
            `ALTER TABLE "jobs" ADD COLUMN "dateLastContacted" date NOT NULL DEFAULT CURRENT_DATE`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "jobs" DROP COLUMN "dateLastContacted"`,
        );
        await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "dateApplied"`);
    }
}
