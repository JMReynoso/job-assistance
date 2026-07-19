import AppDataSource from '../data-source';
import { runSeeds } from './index';

/**
 * Standalone entry point for `npm run seed`: runs the same seeds the app runs
 * on startup, but without booting Nest. This is compiled to dist/ and executed
 * with plain `node`, so it needs no ts-node at runtime.
 */
async function main(): Promise<void> {
    const dataSource = await AppDataSource.initialize();
    try {
        await runSeeds(dataSource);
    } finally {
        await dataSource.destroy();
    }
}

void main();
