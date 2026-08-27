import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * missing_keywords is the first table in this schema with a real foreign
 * key — every other satellite table (contacts, company_research,
 * generated_content) stores jobId as a bare integer with nothing enforcing
 * it points at a real job. Here ON DELETE CASCADE is load-bearing: it is
 * what makes DELETE /generated-content/:id correct. Without it, deleting a
 * run would strand its keyword rows, and the unique index below would then
 * reject re-inserting those same keywords under a recycled id.
 */
export class CreateMissingKeywords1784468900000 implements MigrationInterface {
    name = 'CreateMissingKeywords1784468900000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "missing_keywords"
            ("id" SERIAL NOT NULL,
            "generatedContentId" integer NOT NULL,
            "keyword" text NOT NULL,
            "include" boolean NOT NULL DEFAULT false,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_missing_keywords" PRIMARY KEY ("id"),
            CONSTRAINT "FK_missing_keywords_generated_content"
              FOREIGN KEY ("generatedContentId")
              REFERENCES "generated_content"("id")
              ON DELETE CASCADE)`);

        // Makes re-scoring an upsert rather than a duplicate — same reasoning
        // as UQ_contacts_job_email.
        await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_missing_keywords_content_keyword"
            ON "missing_keywords" ("generatedContentId", "keyword")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_missing_keywords_content_keyword"`);
        await queryRunner.query(`DROP TABLE "missing_keywords"`);
    }
}
