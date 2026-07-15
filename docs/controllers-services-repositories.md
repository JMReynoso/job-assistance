# Adding a Feature: Controllers, Services & Repositories

This guide shows how to add a new feature to the API — like "jobs" or "applications" — the way this project does it. It explains what each file is for, how to create them (by hand or with the NestJS CLI), and how to wire everything together. No prior NestJS experience assumed.

The project already ships a working template: the [`example/`](../api/src/entities/example/) folder. Everything below mirrors it, so when in doubt, open those files and copy the shape.

---

## The layers, in plain terms

A web request flows through a few small files, each with **one job**:

```
HTTP request
   │
   ▼
Controller   →  "What URL was called? Grab the input, return a response."
   │
   ▼
Service      →  "The actual rules. Decide what should happen."
   │
   ▼
Repository   →  "Talk to the database for this one table."
   │
   ▼
Database (Postgres)
```

Plus three supporting files:

| File | What it is (plain terms) | Example |
| --- | --- | --- |
| **Controller** | Handles the web layer — URLs, HTTP status codes, request/response. **No business rules.** | [example.controller.ts](../api/src/entities/example/example.controller.ts) |
| **Service** | The "brain." Business rules and coordination. Talks to repositories, never to the database directly. | [example.service.ts](../api/src/entities/example/example.service.ts) |
| **Repository** | The only file that touches the database for one table. Wraps TypeORM. | [example.repository.ts](../api/src/entities/example/example.repository.ts) |
| **Entity** | The shape of a database table (columns → properties). | [example.entity.ts](../api/src/entities/example/example.entity.ts) |
| **DTO** | The shape of the data coming *in* from a request, plus validation rules. | [dto/create-example.dto.ts](../api/src/entities/example/dto/create-example.dto.ts) |
| **Module** | The "wiring box" that groups the files above and plugs them into the app. | [example.module.ts](../api/src/entities/example/example.module.ts) |

**Why split it up?** So each file stays small and swappable. If you ever change databases, only the repository changes. If a rule changes, only the service changes. The controller never needs to know how data is stored.

---

## Two ways to create the files

### Option A — Copy the `example/` folder (recommended)

The most reliable way to match this project's conventions (repository pattern, Swagger docs, validation) is to **copy [`api/src/entities/example/`](../api/src/entities/example/)** to a new folder and rename `Example` → your name. That's exactly what the note at the top of [example.entity.ts](../api/src/entities/example/example.entity.ts) tells you to do.

### Option B — NestJS CLI, then adapt

The `nest` command can scaffold files for you. It's fast, but its defaults **don't** include a repository or Swagger decorators, so you'll adapt afterward. See the [CLI reference](#nestjs-cli-command-reference) below.

Either way, the end result should look like the walkthrough next.

---

## Walkthrough: add a `jobs` feature

We'll build a full CRUD feature for job postings at `src/entities/job/`. (CRUD = Create, Read, Update, Delete.)

### Step 1 — The entity (the table shape)

`src/entities/job/job.entity.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'jobs' }) // the database table will be called "jobs"
export class Job {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Software Engineer' })
  @Column({ type: 'text' })
  title: string;

  @ApiProperty({ example: 'Acme Inc' })
  @Column({ type: 'text' })
  company: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- `@Entity` marks this class as a table.
- `@Column` marks a property as a column.
- `@ApiProperty` makes it show up in the auto-generated API docs (Swagger).

### Step 2 — The DTOs (validate incoming data)

A DTO ("Data Transfer Object") describes what a request is *allowed* to send, and rejects anything invalid. Never let a request write directly to your entity — go through a DTO.

`src/entities/job/dto/create-job.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateJobDto {
  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Acme Inc' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  company: string;
}
```

`src/entities/job/dto/update-job.dto.ts` — reuses the create rules but makes every field optional:

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto';

export class UpdateJobDto extends PartialType(CreateJobDto) {}
```

> The validation rules (`@IsString`, etc.) are enforced automatically because the app turns on a global `ValidationPipe` in [main.ts](../api/src/main.ts). You don't wire that up per feature.

### Step 3 — The repository (database access)

This is the **only** file that imports TypeORM's `Repository`.

`src/entities/job/job.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './job.entity';

@Injectable()
export class JobRepository {
  constructor(
    @InjectRepository(Job)
    private readonly repository: Repository<Job>,
  ) {}

  findAll(): Promise<Job[]> {
    return this.repository.find({ order: { id: 'ASC' } });
  }

  findById(id: number): Promise<Job | null> {
    return this.repository.findOneBy({ id });
  }

  create(dto: CreateJobDto): Promise<Job> {
    return this.repository.save(this.repository.create(dto));
  }

  async update(id: number, dto: UpdateJobDto): Promise<Job | null> {
    await this.repository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
```

### Step 4 — The service (the rules)

The service coordinates and enforces rules — like "404 if it doesn't exist." It calls the repository; it never touches TypeORM.

`src/entities/job/job.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './job.entity';
import { JobRepository } from './job.repository';

@Injectable()
export class JobService {
  constructor(private readonly jobRepository: JobRepository) {}

  findAll(): Promise<Job[]> {
    return this.jobRepository.findAll();
  }

  async findOne(id: number): Promise<Job> {
    const job = await this.jobRepository.findById(id);
    if (!job) {
      throw new NotFoundException(`Job with id ${id} not found`);
    }
    return job;
  }

  create(dto: CreateJobDto): Promise<Job> {
    return this.jobRepository.create(dto);
  }

  async update(id: number, dto: UpdateJobDto): Promise<Job> {
    await this.findOne(id); // 404s before trying to update
    const updated = await this.jobRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Job with id ${id} not found`);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.jobRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Job with id ${id} not found`);
    }
  }
}
```

### Step 5 — The controller (the URLs)

The controller maps HTTP requests to service calls. It parses input and sets status codes — nothing more.

`src/entities/job/job.controller.ts`:

```ts
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './job.entity';
import { JobService } from './job.service';

@ApiTags('jobs')
@Controller('jobs') // every route here starts with /jobs
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  findAll(): Promise<Job[]> {
    return this.jobService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Job> {
    return this.jobService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateJobDto): Promise<Job> {
    return this.jobService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobDto,
  ): Promise<Job> {
    return this.jobService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.jobService.remove(id);
  }
}
```

> The real [example.controller.ts](../api/src/entities/example/example.controller.ts) also adds `@ApiOperation` / `@ApiResponse` decorators for richer API docs — copy those too if you want the Swagger page fully described.

### Step 6 — The module (wire the feature together)

The module tells NestJS how these files relate.

`src/entities/job/job.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobController } from './job.controller';
import { Job } from './job.entity';
import { JobRepository } from './job.repository';
import { JobService } from './job.service';

@Module({
  imports: [TypeOrmModule.forFeature([Job])], // gives JobRepository its DB access
  controllers: [JobController],               // classes that handle HTTP
  providers: [JobService, JobRepository],     // classes that can be injected
  exports: [JobService],                      // let OTHER features use JobService
})
export class JobModule {}
```

### Step 7 — Connect the feature to the app

A feature only turns on once `AppModule` imports its module. Add `JobModule` to the `imports` list in [app.module.ts](../api/src/app.module.ts):

```ts
import { JobModule } from './entities/job/job.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ExampleModule,
    JobModule, // ← add this line
  ],
  controllers: [AppController],
})
export class AppModule {}
```

> You do **not** need to register the entity anywhere else. The database config in [data-source.ts](../api/src/database/data-source.ts) auto-discovers every `*.entity.ts` file. The only DB-specific line per feature is `TypeOrmModule.forFeature([Job])` inside the module (Step 6), which is what lets `JobRepository` be injected.

### Step 8 — Create the table (migration)

This project uses **migrations**, not auto-sync — so a new entity doesn't create its table on its own. Generate one:

```bash
docker compose -f infra/docker-compose.dev.yml exec api \
  npm run migration:generate -- src/database/migrations/AddJobsTable
```

It runs automatically the next time the app starts. Full details in [migrations-and-seeds.md](migrations-and-seeds.md).

### Step 9 — Try it

The dev server reloads automatically. Open the API docs at **http://localhost:4001** — your new `/jobs` routes appear there, ready to click and test.

---

## How the pieces connect (dependency injection)

You may have noticed no file ever does `new JobService()`. That's **dependency injection**: NestJS builds the objects and hands them to whoever needs them.

When a class lists another in its `constructor`, NestJS supplies it automatically:

```ts
constructor(private readonly jobService: JobService) {}
//                            ↑ NestJS creates a JobService and passes it in
```

The chain wires itself up: `JobController` needs `JobService`, which needs `JobRepository`, which needs the database. NestJS assembles it all — **as long as every class is registered in a module**.

That registration is the whole point of the module file:

| Module list | Means |
| --- | --- |
| `controllers` | Classes that handle HTTP routes. |
| `providers` | Classes that can be injected (services, repositories). |
| `imports` | Other modules whose exports you want to use (e.g. `TypeOrmModule.forFeature([Job])`). |
| `exports` | Your classes that **other** modules are allowed to inject. |

**Using one feature from another:** because `JobModule` exports `JobService`, a different feature can use it by adding `imports: [JobModule]` to its own module, then injecting `JobService` in a constructor. (This is exactly how you'd use `ClaudeService` — see [claude-api.md](claude-api.md).)

**Direction matters — don't wire backwards.** Controller → Service → Repository → Entity. A repository should never import a service; a service should never import a controller. Keeping the arrows one-way avoids tangled, circular dependencies.

---

## NestJS CLI command reference

The `nest` command scaffolds files for you. Run it **inside the api container** (that's where the CLI is installed):

```bash
docker compose -f infra/docker-compose.dev.yml exec api npx nest <command>
```

| Command | What it creates | Auto-wires? |
| --- | --- | --- |
| `nest g module entities/job` | `job.module.ts` | Adds `JobModule` to `AppModule` for you |
| `nest g controller entities/job --no-spec` | `job.controller.ts` | Adds it to `JobModule`'s `controllers` |
| `nest g service entities/job --no-spec` | `job.service.ts` | Adds it to `JobModule`'s `providers` |
| `nest g resource entities/job` | Module + controller + service + entity + DTOs, all at once | Wires everything (asks you "REST API?" → yes, "generate CRUD?" → yes) |

**`g` is short for `generate`. `--no-spec` skips the auto-generated test file** (this project keeps features spec-free, matching the `example/` folder).

**Important caveats — the CLI doesn't fully match this project's style:**

1. **No repository generator.** The CLI puts data logic straight in the service. To follow this project's pattern, create `job.repository.ts` by hand (copy Step 3) and add it to the module's `providers`.
2. **`nest g resource` uses fake in-memory data.** You'll replace the generated service body with real repository calls and add `TypeOrmModule.forFeature([Job])` to the module.
3. **No Swagger/validation decorators.** Add `@ApiProperty`, `@IsString`, etc. yourself (copy from the `example/` files).

Because of this, **copying the `example/` folder is usually faster than the CLI** for this codebase. Use the CLI when you want the module auto-registered in `AppModule` without editing it by hand.

---

## Best-practice rules (keep each layer in its lane)

- **Controller:** only HTTP concerns — read params/body, call one service method, return the result. No database calls, no business rules. Use `ParseIntPipe` so `:id` arrives as a number.
- **Service:** all the business rules. Throw `NotFoundException`, `BadRequestException`, etc. here. Talk to repositories, never to TypeORM.
- **Repository:** only database access for **one** entity, and the only place that imports TypeORM's `Repository`. If storage ever changes, this is the single file you touch.
- **DTOs:** validate every incoming request. Never accept a raw entity as input.
- **One entity = one folder** under `src/entities/`, holding its entity, dtos, repository, service, controller, and module.
- **New table? Generate a migration** (Step 8) — the schema won't change on its own.

---

## Checklist for a new feature

- [ ] Folder created under `src/entities/<name>/`
- [ ] `*.entity.ts` — the table shape
- [ ] `dto/create-*.dto.ts` and `dto/update-*.dto.ts` — validated input
- [ ] `*.repository.ts` — database access
- [ ] `*.service.ts` — business rules
- [ ] `*.controller.ts` — routes
- [ ] `*.module.ts` — `imports: [TypeOrmModule.forFeature([Entity])]`, `controllers`, `providers`, `exports`
- [ ] Module added to `AppModule`'s `imports`
- [ ] Migration generated for the new table
- [ ] Routes visible and working at http://localhost:4001

---

## File map (what a feature looks like)

```
api/src/entities/job/
├── dto/
│   ├── create-job.dto.ts     # validated input for creating
│   └── update-job.dto.ts     # validated input for updating
├── job.entity.ts             # the database table shape
├── job.repository.ts         # database access (only file that uses TypeORM here)
├── job.service.ts            # business rules
├── job.controller.ts         # HTTP routes
└── job.module.ts             # wires it together + connects to the app
```

Compare with the live template: [api/src/entities/example/](../api/src/entities/example/).
