import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { dataSourceOptions } from './database/data-source';
import { ExampleModule } from './entities/example/example.module';

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
    ExampleModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
