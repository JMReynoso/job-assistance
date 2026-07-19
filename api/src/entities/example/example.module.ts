import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExampleController } from './example.controller';
import { Example } from './example.entity';
import { ExampleRepository } from './example.repository';
import { ExampleService } from './example.service';

@Module({
    imports: [TypeOrmModule.forFeature([Example])],
    controllers: [ExampleController],
    providers: [ExampleService, ExampleRepository],
    exports: [ExampleService],
})
export class ExampleModule {}
