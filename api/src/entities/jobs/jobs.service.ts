import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateExampleDto } from './dto/create-job.dto';
import { UpdateExampleDto } from './dto/update-job.dto';
import { Job } from './job.entity';
import { JobsRepository } from './jobs.repository';

@Injectable()
export class JobsService {
    constructor(private readonly jobsRepository: JobsRepository) {}

    findAll(): Promise<Job[]> {
        return this.jobsRepository.findAll();
    }

    async findOne(id: number): Promise<Job> {
        const job = await this.jobsRepository.findById(id);
        if (!job) {
            throw new NotFoundException(`Job with id ${id} not found`);
        }
        return job;
    }

    //TODO: implement
    create(dto: CreateExampleDto): Promise<Job> {
        // create dto

        // call perplexity.ai API calls

        // call claude API
        // create summary based on research

        // create outreach message

        // create follow-up message

        // tailor resume on high effort (opus)

        // hunter.io API calls
        // search hiring manager / tallent / recruiter based on research
        // place contacts in table

        return this.jobsRepository.create(dto);
    }

    async update(id: number, dto: UpdateExampleDto): Promise<Job> {
        await this.findOne(id); // 404s before attempting the update
        const updated = await this.jobsRepository.update(id, dto);
        if (!updated) {
            throw new NotFoundException(`Job with id ${id} not found`);
        }
        return updated;
    }

    async remove(id: number): Promise<void> {
        const deleted = await this.jobsRepository.delete(id);
        if (!deleted) {
            throw new NotFoundException(`Job with id ${id} not found`);
        }
    }
}
