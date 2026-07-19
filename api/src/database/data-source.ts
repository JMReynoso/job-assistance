import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Single source of truth for the TypeORM connection, shared by:
 *  - the NestJS app (imported in app.module.ts), and
 *  - the TypeORM CLI (migration:generate / migration:run), which loads the
 *    default `AppDataSource` export from this file via the `-d` flag.
 *
 * Reads straight from process.env so it behaves identically inside Nest (where
 * ConfigModule has already populated env vars) and standalone in the CLI (no
 * Nest at all). The glob paths use __dirname + {ts,js} so the same config
 * resolves entities and migrations whether we're running TypeScript through
 * ts-node (CLI, tests) or compiled JavaScript from dist/ (`nest start`, prod).
 */
export const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'job_assistance',
    entities: [__dirname + '/../**/*.entity.{ts,js}'],
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    // Migrations own the schema now — never let TypeORM auto-alter tables.
    synchronize: false,
};

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
