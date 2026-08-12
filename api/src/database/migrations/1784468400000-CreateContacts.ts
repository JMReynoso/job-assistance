import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContacts1784468400000 implements MigrationInterface {
    name = 'CreateContacts1784468400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "contacts"
            ("id" SERIAL NOT NULL,
            "jobId" integer NOT NULL,
            "email" text NOT NULL,
            "firstName" text,
            "lastName" text,
            "position" text,
            "confidence" integer NOT NULL,
            "type" text NOT NULL DEFAULT 'personal',
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_contacts" PRIMARY KEY ("id"))`);

        // One row per person per job. The repository upserts against this index
        // so re-running a lookup refreshes contacts instead of duplicating them.
        await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_contacts_job_email"
            ON "contacts" ("jobId", "email")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_contacts_job_email"`);
        await queryRunner.query(`DROP TABLE "contacts"`);
    }
}
