import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { Contacts } from './entities/contacts.entity';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
    constructor(private readonly contactsService: ContactsService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new contact' })
    @ApiResponse({
        status: 201,
        description: 'The created contact.',
        type: Contacts,
    })
    create(@Body() createContactsDto: CreateContactsDto) {
        return this.contactsService.create(createContactsDto);
    }

    @Get()
    @ApiOperation({ summary: 'List all contacts' })
    @ApiResponse({
        status: 200,
        description: 'The list of contacts.',
        type: Contacts,
        isArray: true,
    })
    findAll() {
        return this.contactsService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single contact by id' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The matching contact.',
        type: Contacts,
    })
    @ApiResponse({ status: 404, description: 'No contact with that id.' })
    findOne(@Param('id') id: string) {
        return this.contactsService.findOne(+id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an existing contact' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({
        status: 200,
        description: 'The updated contact.',
        type: Contacts,
    })
    @ApiResponse({ status: 404, description: 'No contact with that id.' })
    update(
        @Param('id') id: string,
        @Body() updateContactsDto: UpdateContactsDto,
    ) {
        return this.contactsService.update(+id, updateContactsDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a contact' })
    @ApiParam({ name: 'id', type: Number })
    @ApiResponse({ status: 204, description: 'The contact was deleted.' })
    @ApiResponse({ status: 404, description: 'No contact with that id.' })
    remove(@Param('id') id: string) {
        return this.contactsService.remove(+id);
    }
}
