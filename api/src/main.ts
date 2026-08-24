import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { runSeeds } from './database/seeds';

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
    );

    // The web app is served from a different origin (:4000 → :4001), so the
    // browser needs an explicit allow or every request from it fails. Registers
    // @fastify/cors (a dependency of platform-fastify), so it has to happen
    // before listen() freezes plugin registration. No credentials: nothing is
    // authenticated yet, and enabling that later needs a real origin allowlist.
    app.enableCors({
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:4000',
        credentials: false,
    });

    // Bring the schema up to date, then load seed data — before we start
    // accepting traffic, so no request ever hits a half-built database. If
    // migrations fail we abort rather than serve against a bad schema.
    const logger = new Logger('Bootstrap');
    const dataSource = app.get(DataSource);

    const migrations = await dataSource.runMigrations();
    logger.log(`Applied ${migrations.length} migration(s)`);

    if (process.env.RUN_SEEDS !== 'false') {
        await runSeeds(dataSource);
    }

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        }),
    );

    const swaggerConfig = new DocumentBuilder()
        .setTitle('Job Assistance API')
        .setDescription('Backend API for the Job Assistance job-tracking app.')
        .setVersion('0.0.1')
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('/', app, document);

    const port = process.env.PORT ? Number(process.env.PORT) : 4001;
    await app.listen(port, '0.0.0.0');
}

void bootstrap();
