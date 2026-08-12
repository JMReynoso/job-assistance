import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobs1784468300000 implements MigrationInterface {
    name = 'CreateJobs1784468300000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "jobs"
            ("id" SERIAL NOT NULL,
            "companyName" text NOT NULL,
            "jobPostingURL" text NOT NULL,
            "companyPage" text NOT NULL,
            "companyLinkedIn" text NOT NULL,
            "extraURLs" text,
            "status" text NOT NULL DEFAULT 'not_applied',
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_jobs" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "jobs"`);
    }
}
