import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsController } from './contacts.controller';
import { Contacts } from './entities/contacts.entity';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';

@Module({
    imports: [TypeOrmModule.forFeature([Contacts])],
    controllers: [ContactsController],
    providers: [ContactsService, ContactsRepository],
    exports: [ContactsService],
})
export class ContactsModule {}
