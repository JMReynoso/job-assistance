import { MigrationInterface, QueryRunner } from "typeorm";

export class InitExample1784146992233 implements MigrationInterface {
    name = 'InitExample1784146992233'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "examples" ("id" SERIAL NOT NULL, "name" text NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ea56499b0a3a29593d3405080e8" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "examples"`);
    }

}
