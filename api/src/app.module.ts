import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { dataSourceOptions } from './database/data-source';
import { ExampleModule } from './entities/example/example.module';
import { CompanyResearchModule } from './entities/companyResearch/company-research.module';
import { GeneratedContentModule } from './entities/generatedContent/generated-content.module';
import { ContactsModule } from './entities/contacts/contacts.module';
import { JobsModule } from './entities/jobs/jobs.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        // Same options object the TypeORM CLI uses (see database/data-source.ts),
        // so the running app and `migration:generate` can never drift apart.
        // Schema changes go through migrations (run on startup in main.ts), not
        // `synchronize`.
        TypeOrmModule.forRoot(dataSourceOptions),
        CompanyResearchModule,
        GeneratedContentModule,
        ContactsModule,
        // Registered explicitly rather than relying on GeneratedContentModule
        // importing it: the frontend reads /jobs directly, so mounting the
        // controller shouldn't be a side effect of an unrelated module.
        JobsModule,
    ],
    controllers: [AppController],
})
export class AppModule {}
