import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { Contacts } from './entities/contacts.entity';

/**
 * Everything that touches Postgres for this entity lives here. The service
 * layer talks to this class, never to TypeORM's Repository<Contacts> directly
 * — so if the storage layer ever changes, this is the only file that has to.
 */
@Injectable()
export class ContactsRepository {
    constructor(
        @InjectRepository(Contacts)
        private readonly repository: Repository<Contacts>,
    ) {}

    findAll(): Promise<Contacts[]> {
        return this.repository.find({ order: { id: 'ASC' } });
    }

    findById(id: number): Promise<Contacts | null> {
        return this.repository.findOneBy({ id });
    }

    create(dto: CreateContactsDto): Promise<Contacts> {
        const contacts = this.repository.create(dto);
        return this.repository.save(contacts);
    }

    async update(id: number, dto: UpdateContactsDto): Promise<Contacts | null> {
        await this.repository.update(id, dto);
        return this.findById(id);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.repository.delete(id);
        return (result.affected ?? 0) > 0;
    }
}
