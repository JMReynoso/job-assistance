import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the LinkedIn profile URL to contacts. Hunter's domain search has always
 * returned this field — HunterEmail just never declared it, so it was parsed
 * and thrown away. Nullable: Hunter has a profile for some people and not
 * others.
 *
 * Rows saved before this migration stay null until that job's lookup is re-run;
 * the upsert in ContactsRepository.createMany refreshes them then.
 */
export class ContactsLinkedIn1784468600000 implements MigrationInterface {
    name = 'ContactsLinkedIn1784468600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "contacts" ADD COLUMN "linkedin" text`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "contacts" DROP COLUMN "linkedin"`,
        );
    }
}
