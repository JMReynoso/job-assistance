import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsController } from './contacts.controller';
import { Contact } from './entities/contact.entity';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';
import { HunterModule } from '../../externalAPIs/hunter/hunter.module';

@Module({
    imports: [TypeOrmModule.forFeature([Contact]), HunterModule],
    controllers: [ContactsController],
    providers: [ContactsService, ContactsRepository],
    exports: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
