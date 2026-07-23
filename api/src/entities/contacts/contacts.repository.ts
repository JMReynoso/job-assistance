import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../base.repository';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { Contacts } from './entities/contacts.entity';

/**
 * Everything that touches Postgres for this entity lives here. The service
 * layer talks to this class, never to TypeORM's Repository<Contacts> directly
 * — so if the storage layer ever changes, this is the only file that has to.
 * Error handling comes from {@link BaseRepository}.
 */
@Injectable()
export class ContactsRepository extends BaseRepository {
    constructor(
        @InjectRepository(Contacts)
        private readonly repository: Repository<Contacts>,
    ) {
        super();
    }

    findAll(): Promise<Contacts[]> {
        return this.run('fetching all contacts', () =>
            this.repository.find({ order: { id: 'ASC' } }),
        );
    }

    findById(id: number): Promise<Contacts | null> {
        return this.run(`fetching contact ${id}`, () =>
            this.repository.findOneBy({ id }),
        );
    }

    create(dto: CreateContactsDto): Promise<Contacts> {
        const contacts = this.repository.create(dto);
        return this.run('saving new contact', () =>
            this.repository.save(contacts),
        );
    }

    async update(id: number, dto: UpdateContactsDto): Promise<Contacts | null> {
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
