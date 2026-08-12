import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../base.repository';
import { HunterEmail } from '../../externalAPIs/hunter/hunter.service';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Contact } from './entities/contact.entity';

/**
 * Everything that touches Postgres for this entity lives here. The service
 * layer talks to this class, never to TypeORM's Repository<Contact> directly
 * — so if the storage layer ever changes, this is the only file that has to.
 * Error handling comes from {@link BaseRepository}.
 */
@Injectable()
export class ContactsRepository extends BaseRepository {
    constructor(
        @InjectRepository(Contact)
        private readonly repository: Repository<Contact>,
    ) {
        super();
    }

    async findAll(): Promise<Contact[]> {
        return await this.run('fetching all contacts', () =>
            this.repository.find({ order: { id: 'ASC' } }),
        );
    }

    async findById(id: number): Promise<Contact | null> {
        return await this.run(`fetching contact ${id}`, () =>
            this.repository.findOneBy({ id }),
        );
    }

    /** Everyone found for a job, most reachable first. */
    async findByJobId(jobId: number): Promise<Contact[]> {
        return await this.run(`fetching contacts for job ${jobId}`, () =>
            this.repository.find({
                where: { jobId },
                order: { confidence: 'DESC', id: 'ASC' },
            }),
        );
    }

    /**
     * Saves a whole domain-search result in one statement, translating Hunter's
     * snake_case fields to the entity's columns.
     *
     * Looking the same company up twice is normal (a job sits open for weeks),
     * so this upserts on the (jobId, email) unique index rather than inserting
     * duplicates: a second run refreshes titles and confidence scores instead of
     * failing. `save()` can't do that, hence the query builder. Returns every
     * contact on the job, not just this batch's rows.
     */
    async createMany(jobId: number, emails: HunterEmail[]): Promise<Contact[]> {
        const contacts = emails.map((email) =>
            this.repository.create({
                jobId,
                email: email.value,
                type: email.type,
                confidence: email.confidence,
                // Hunter returns null for unknown fields; the columns are optional.
                firstName: email.first_name ?? undefined,
                lastName: email.last_name ?? undefined,
                position: email.position ?? undefined,
            }),
        );

        await this.run(
            `saving ${contacts.length} contacts for jobID ${jobId}`,
            () =>
                this.repository
                    .createQueryBuilder()
                    .insert()
                    .values(contacts)
                    .orUpdate(
                        [
                            'firstName',
                            'lastName',
                            'position',
                            'confidence',
                            'type',
                            // Raw upserts bypass @UpdateDateColumn, so the
                            // refreshed-at stamp has to be overwritten by hand.
                            'updated_at',
                        ],
                        ['jobId', 'email'],
                    )
                    .execute(),
        );

        return this.findByJobId(jobId);
    }

    async update(id: number, dto: UpdateContactDto): Promise<Contact | null> {
        await this.run(`updating contact ${id}`, () =>
            this.repository.update(id, dto),
        );
        return this.findById(id);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.run(`deleting contact ${id}`, () =>
            this.repository.delete(id),
        );
        return (result.affected ?? 0) > 0;
    }
}
