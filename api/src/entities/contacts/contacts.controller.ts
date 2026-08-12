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
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Contact } from './entities/contact.entity';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
    constructor(private readonly contactsService: ContactsService) {}

    @Post()
    @ApiOperation({
        summary: 'Find contacts at a company and save them to a job',
        description:
            "Runs a Hunter.io domain search against the company's website and " +
            'stores everyone it finds against the job. Re-running refreshes the ' +
            'existing contacts rather than duplicating them, and a company ' +
            'Hunter has no data for returns an empty list.',
    })
    @ApiResponse({
        status: 201,
        description: 'Every contact now on the job, most reachable first.',
        type: Contact,
        isArray: true,
    })
    @ApiResponse({ status: 400, description: 'The company URL is unusable.' })
    @ApiResponse({
        status: 503,
        description: 'Hunter.io is busy or unreachable; try again shortly.',
    })
    create(@Body() createContactDto: CreateContactDto) {
        return this.contactsService.create(createContactDto);
    }

    @Get()
    @ApiOperation({ summary: 'List all contacts' })
    @ApiResponse({
        status: 200,
        description: 'The list of contacts.',
        type: Contact,
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
        type: Contact,
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
        type: Contact,
    })
    @ApiResponse({ status: 404, description: 'No contact with that id.' })
    update(
        @Param('id') id: string,
        @Body() updateContactDto: UpdateContactDto,
    ) {
        return this.contactsService.update(+id, updateContactDto);
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
