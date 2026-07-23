import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../base.repository';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './job.entity';

/**
 * Everything that touches Postgres for this entity lives here. The service
 * layer talks to this class, never to TypeORM's Repository<Job> directly
 * — so if the storage layer ever changes, this is the only file that has to.
 * Error handling comes from {@link BaseRepository}.
 */
@Injectable()
export class JobsRepository extends BaseRepository {
    constructor(
        @InjectRepository(Job)
        private readonly repository: Repository<Job>,
    ) {
        super();
    }

    findAll(): Promise<Job[]> {
        return this.run('fetching all jobs', () =>
            this.repository.find({ order: { id: 'ASC' } }),
        );
    }

    findById(id: number): Promise<Job | null> {
        return this.run(`fetching job ${id}`, () =>
            this.repository.findOneBy({ id }),
        );
    }

    create(dto: CreateJobDto): Promise<Job> {
        const job = this.repository.create(dto);
        return this.run('saving new job', () => this.repository.save(job));
    }

    async update(id: number, dto: UpdateJobDto): Promise<Job | null> {
        await this.run(`updating job ${id}`, () =>
            this.repository.update(id, dto),
        );
        return this.findById(id);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.run(`deleting job ${id}`, () =>
            this.repository.delete(id),
        );
        return (result.affected ?? 0) > 0;
    }
}
