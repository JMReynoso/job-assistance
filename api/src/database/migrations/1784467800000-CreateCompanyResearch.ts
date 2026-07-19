import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyResearch1784467800000 implements MigrationInterface {
    name = 'CreateCompanyResearch1784467800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "company_research" 
            ("id" SERIAL NOT NULL, 
            "jobId" integer NOT NULL, 
            "company" text NOT NULL, 
            "reports" jsonb NOT NULL, 
            "sources" jsonb NOT NULL, 
            "urls" jsonb NOT NULL, 
            "usage" jsonb NOT NULL, 
            "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
            CONSTRAINT "PK_company_research" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "company_research"`);
    }
}
