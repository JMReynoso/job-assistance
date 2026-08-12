import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { exampleSeed } from './example.seed';
import { jobsSeed } from './jobs.seed';
import { companyResearchSeed } from './company-research.seed';
import { generatedContentSeed } from './generated-content.seed';
import { contactsSeed } from './contacts.seed';
import { Seed } from './seed.interface';

// Register seeds here, in the order they should run. Jobs come before
// company_research / generated_content / contacts, which reference jobs by jobId.
const seeds: Seed[] = [
    exampleSeed,
    jobsSeed,
    companyResearchSeed,
    generatedContentSeed,
    contactsSeed,
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
