import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { ExampleModule } from './entities/example/example.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'job_assistance'),
        autoLoadEntities: true,
        // Fine for local development; use migrations instead once this API
        // has real data you can't afford to have TypeORM re-shape for you.
        synchronize:
          config.get<string>('NODE_ENV', 'development') !== 'production',
      }),
    }),
    ExampleModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
