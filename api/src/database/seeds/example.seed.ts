import { Example } from '../../entities/example/example.entity';
import { Seed } from './seed.interface';

/**
 * Sample rows so a freshly-migrated database isn't empty in development.
 * Idempotent: it only inserts when the table has no rows, so running it on
 * every startup is safe. This is dummy data — replace it with real reference
 * data, or disable seeding entirely (RUN_SEEDS=false), for production.
 */
export const exampleSeed: Seed = {
  name: 'examples',
  async run(dataSource) {
    const repo = dataSource.getRepository(Example);

    if ((await repo.count()) > 0) {
      return;
    }

    await repo.save([
      {
        name: 'Sample widget',
        description: 'A short description of the widget.',
      },
      { name: 'Another widget', description: null },
    ]);
  },
};
