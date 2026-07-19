import { DataSource } from 'typeorm';

/**
 * A unit of seed data. `run` must be idempotent — seeds execute on every app
 * startup, so re-running one should be a no-op once its data already exists.
 */
export interface Seed {
    /** Human-readable label, shown in the startup logs. */
    name: string;
    run(dataSource: DataSource): Promise<void>;
}
