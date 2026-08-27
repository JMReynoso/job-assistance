# Database Migrations & Seeds

How the API manages its Postgres schema and seed data with TypeORM.

All commands below are run from the **repository root** (where `infra/docker-compose.dev.yml` lives) and assume the dev stack is up:

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

---

## How it works

- The API uses **TypeORM + Postgres**. Connection settings live in one shared place — [`api/src/database/data-source.ts`](../api/src/database/data-source.ts) — used by **both** the running app and the TypeORM CLI, so they can never drift apart.
- **`synchronize` is OFF.** Migrations own the schema. Editing an entity does **not** reshape its table on its own — you must generate and apply a migration (see below).
- **On startup**, before the app accepts any traffic ([`api/src/main.ts`](../api/src/main.ts)):
  1. Pending **migrations** are applied (`dataSource.runMigrations()`).
  2. **Seeds** run (unless `RUN_SEEDS=false`).

  So in normal dev you rarely need to run anything by hand — just (re)start the container and the DB is brought up to date and seeded.

---

## Quick reference

| Task | Command (from repo root) |
| --- | --- |
| Generate a migration from entity changes | `docker compose -f infra/docker-compose.dev.yml exec api npm run migration:generate -- src/database/migrations/YourName` |
| Create an empty migration (custom SQL) | `docker compose -f infra/docker-compose.dev.yml exec api npm run migration:create -- src/database/migrations/YourName` |
| Apply pending migrations | `docker compose -f infra/docker-compose.dev.yml exec api npm run migration:run` |
| Revert the last migration | `docker compose -f infra/docker-compose.dev.yml exec api npm run migration:revert` |
| Show migration status | `docker compose -f infra/docker-compose.dev.yml exec api npm run migration:show` |
| Run seeds manually | `docker compose -f infra/docker-compose.dev.yml exec api npm run seed` |

> `exec` targets the **already-running** `api` container. If the stack is stopped, swap `exec api` for `run --rm api` to use a one-off container (it will start Postgres as a dependency first). See [Running against a stopped stack](#running-against-a-stopped-stack).

---

## Creating a migration

### Option A — generate from entity changes (recommended)

This is the normal path. Change an entity (add a column, a new `*.entity.ts`, etc.), then let TypeORM diff your entities against the live database and write the SQL for you:

```bash
docker compose -f infra/docker-compose.dev.yml exec api \
  npm run migration:generate -- src/database/migrations/AddJobStatusColumn
```

- A timestamp is prepended automatically, e.g. `src/database/migrations/1784146992233-AddJobStatusColumn.ts`.
- **Always review the generated `up()` / `down()`** before committing — auto-diffs occasionally do more (or less) than you intend.
- The database must be **running and reachable**. If your entities already match the DB, TypeORM reports *"No changes in database schema were found"* and writes nothing.
- The new file is written into your working tree via the bind mount, so it appears on the host ready to commit.

### Option B — empty migration (custom SQL, data backfills)

When you need something the entity diff can't express (raw SQL, data migration, backfill):

```bash
docker compose -f infra/docker-compose.dev.yml exec api \
  npm run migration:create -- src/database/migrations/BackfillLegacyJobs
```

This creates a blank migration; fill in `up()` and `down()` yourself.

### Applying migrations

Migrations run **automatically on app startup**. To apply them manually (e.g. without restarting):

```bash
docker compose -f infra/docker-compose.dev.yml exec api npm run migration:run
```

Roll back the most recent migration:

```bash
docker compose -f infra/docker-compose.dev.yml exec api npm run migration:revert
```

Check which migrations have/haven't run:

```bash
docker compose -f infra/docker-compose.dev.yml exec api npm run migration:show
```

---

## Creating a seed

Seeds live in [`api/src/database/seeds/`](../api/src/database/seeds/). Each seed **must be idempotent** — seeds run on every startup, so re-running one has to be a no-op once its data exists.

**1. Add a seed file**, e.g. `api/src/database/seeds/job.seed.ts`:

```ts
import { Job } from '../../entities/job/job.entity';
import { Seed } from './seed.interface';

export const jobSeed: Seed = {
  name: 'jobs',
  async run(dataSource) {
    const repo = dataSource.getRepository(Job);

    // Idempotency guard — only insert when the table is empty.
    if ((await repo.count()) > 0) {
      return;
    }

    await repo.save([
      { title: 'Software Engineer', company: 'Acme' },
      // ...
    ]);
  },
};
```

**2. Register it** in [`api/src/database/seeds/index.ts`](../api/src/database/seeds/index.ts), in the order it should run:

```ts
const seeds: Seed[] = [exampleSeed, jobSeed];
```

### Seeding a table with a foreign key

`missing_keywords` is the one table with a real FK (see [data-model.md](data-model.md#missing_keywords--what-the-tailored-resume-is-missing)), which changes two things about its seed:

- **Order is enforced, not just conventional.** It's registered last because Postgres rejects the insert outright if its `generated_content` parent isn't there — where a bad `jobId` on any other table would insert happily as a silent orphan.
- **It can't hard-code parent ids.** [missing-keywords.seed.ts](../api/src/database/seeds/missing-keywords.seed.ts) looks its content rows up by `jobId` and reads the real `id` off each one, then `continue`s past any job with no content row rather than throwing — seeds run on every boot, and a partial fixture isn't worth blocking startup over.

Verify a seed against a scratch database rather than your dev data — `DB_NAME` is read straight from the environment ([data-source.ts](../api/src/database/data-source.ts)), so nothing has to be truncated to test a re-run:

```bash
docker exec job-assistant-postgres-1 psql -U postgres -c "CREATE DATABASE seedcheck;"
docker compose -f infra/docker-compose.dev.yml run --rm --no-deps -e DB_NAME=seedcheck api \
  sh -c "npm run migration:run && npm run seed"
# ...inspect, then:
docker exec job-assistant-postgres-1 psql -U postgres -c "DROP DATABASE seedcheck;"
```

### Running seeds

Seeds run **automatically on startup** (unless disabled — see below). To run them manually:

```bash
docker compose -f infra/docker-compose.dev.yml exec api npm run seed
```

The `seed` script builds the project and runs the same seeds the app runs on boot, without starting Nest ([`run-seed.ts`](../api/src/database/seeds/run-seed.ts)).

---

## Running against a stopped stack

If the dev stack isn't up, use a **one-off** container instead of `exec`:

```bash
# Starts Postgres (a dependency) automatically, runs the command, then removes the container.
docker compose -f infra/docker-compose.dev.yml run --rm api \
  npm run migration:generate -- src/database/migrations/YourName
```

Add `--no-deps` if Postgres is *already* running and you don't want Compose to touch it:

```bash
docker compose -f infra/docker-compose.dev.yml run --rm --no-deps api npm run migration:run
```

---

## Configuration

The DataSource reads these environment variables (defaults in parentheses). In the dev stack they're set by the `api` service in `infra/docker-compose.dev.yml`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST` | `localhost` (`postgres` in Docker) | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_USERNAME` | `postgres` | Postgres user |
| `DB_PASSWORD` | `postgres` | Postgres password |
| `DB_NAME` | `job_assistance` | Database name |
| `RUN_SEEDS` | *(unset → seeds run)* | Set to `false` to skip seeding on startup (e.g. in production) |

---

## Inspecting the database

Handy for confirming a migration/seed did what you expect:

```bash
# List tables
docker exec job-assistant-postgres-1 psql -U postgres -d job_assistance -c "\dt"

# See which migrations have been recorded as applied
docker exec job-assistant-postgres-1 psql -U postgres -d job_assistance -c "SELECT * FROM migrations;"
```

---

## File map

| Path | What it is |
| --- | --- |
| [`api/src/database/data-source.ts`](../api/src/database/data-source.ts) | Shared TypeORM connection config (app **and** CLI) |
| [`api/src/database/migrations/`](../api/src/database/migrations/) | Migration files (generated) |
| [`api/src/database/seeds/`](../api/src/database/seeds/) | Seed runner, `Seed` interface, and individual seeds |
| [`api/src/main.ts`](../api/src/main.ts) | Runs migrations + seeds on startup |

---

## Gotchas

- **`synchronize` is off.** After changing an entity you *must* generate a migration — the table won't update on its own anymore. This is the intended trade-off for having a real migration history.
- **`migration:generate` diffs against the live DB.** The database must be reachable, and if it already matches your entities you'll get an empty result.
- **Seeds must stay idempotent** — they run on every startup. Always guard inserts (e.g. the `count() > 0` check above).
- **That guard also means a new column never reaches an already-seeded database.** Adding a field to a seed file does nothing to a dev DB that already has rows — the seed returns early. `down -v` (or a targeted `PATCH`) is what applies it.
- **Running the CLI locally (without Docker)** is possible but the project is Docker-first (`node_modules` lives in the container). If you want to run scripts on the host, run `npm ci` in `api/` first; commands then use the `DB_*` defaults (`localhost`).
