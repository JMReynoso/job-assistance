import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { exampleSeed } from './example.seed';
import { jobsSeed } from './jobs.seed';
import { companyResearchSeed } from './company-research.seed';
import { generatedContentSeed } from './generated-content.seed';
import { contactsSeed } from './contacts.seed';
import { missingKeywordsSeed } from './missing-keywords.seed';
import { Seed } from './seed.interface';

// Register seeds here, in the order they should run. Jobs come before
// company_research / generated_content / contacts, which reference jobs by jobId.
// missing_keywords comes last: it is the one table with a real foreign key, so
// its parent generated_content rows must exist or the insert is rejected.
const seeds: Seed[] = [
    exampleSeed,
    jobsSeed,
    companyResearchSeed,
    generatedContentSeed,
    contactsSeed,
    missingKeywordsSeed,
];

/**
 * Runs every registered seed against the given DataSource. Called on app
 * startup (main.ts) and by the standalone `npm run seed` script. Each seed is
 * idempotent, so this is safe to run repeatedly.
 */
export async function runSeeds(dataSource: DataSource): Promise<void> {
    const logger = new Logger('Seeds');

    for (const seed of seeds) {
        await seed.run(dataSource);
        logger.log(`Seeded: ${seed.name}`);
    }
}
