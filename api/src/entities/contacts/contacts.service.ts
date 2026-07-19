import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { Contacts } from './entities/contacts.entity';
import { ContactsRepository } from './contacts.repository';

@Injectable()
export class ContactsService {
    constructor(private readonly contactsRepository: ContactsRepository) {}

    findAll(): Promise<Contacts[]> {
        return this.contactsRepository.findAll();
    }

    async findOne(id: number): Promise<Contacts> {
        const contacts = await this.contactsRepository.findById(id);
        if (!contacts) {
            throw new NotFoundException(`Contacts with id ${id} not found`);
        }
        return contacts;
    }

    create(dto: CreateContactsDto): Promise<Contacts> {
        return this.contactsRepository.create(dto);
    }

    async update(id: number, dto: UpdateContactsDto): Promise<Contacts> {
        await this.findOne(id); // 404s before attempting the update
        const updated = await this.contactsRepository.update(id, dto);
        if (!updated) {
            throw new NotFoundException(`Contacts with id ${id} not found`);
        }
        return updated;
    }

    async remove(id: number): Promise<void> {
        const deleted = await this.contactsRepository.delete(id);
        if (!deleted) {
            throw new NotFoundException(`Contacts with id ${id} not found`);
        }
    }
}
