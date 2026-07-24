import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGeneratedContent1784468100000 implements MigrationInterface {
    name = 'CreateGeneratedContent1784468100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "generated_content"
            ("id" SERIAL NOT NULL,
            "jobId" integer NOT NULL,
            "outreachMessage" text,
            "followupMessage" text,
            "tailoredResume" text,
            "outreachMessageUsage" jsonb,
            "followupMessageUsage" jsonb,
            "tailoredResumeUsage" jsonb,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_generated_content" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "generated_content"`);
    }
}
