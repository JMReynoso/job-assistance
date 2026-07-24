import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { exampleSeed } from './example.seed';
import { companyResearchSeed } from './company-research.seed';
import { generatedContentSeed } from './generated-content.seed';
import { Seed } from './seed.interface';

// Register seeds here, in the order they should run.
const seeds: Seed[] = [exampleSeed, companyResearchSeed, generatedContentSeed];

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
