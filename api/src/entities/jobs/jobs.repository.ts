import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './job.entity';

/**
 * Everything that touches Postgres for this entity lives here. The service
 * layer talks to this class, never to TypeORM's Repository<Job> directly
 * — so if the storage layer ever changes, this is the only file that has to.
 */
@Injectable()
export class JobsRepository {
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
        const example = this.repository.create(dto);
        return this.repository.save(example);
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
