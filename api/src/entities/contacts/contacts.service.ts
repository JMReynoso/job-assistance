import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { HunterService } from '../../externalAPIs/hunter/hunter.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Contact } from './entities/contact.entity';
import { ContactsRepository } from './contacts.repository';

/** How many contacts a lookup returns when the request doesn't say. */
const DEFAULT_LOOKUP_LIMIT = 10;

@Injectable()
export class ContactsService {
    private readonly logger = new Logger(ContactsService.name);

    constructor(
        private readonly contactsRepository: ContactsRepository,
        private readonly hunterService: HunterService,
    ) {}

    findAll(): Promise<Contact[]> {
        return this.contactsRepository.findAll();
    }

    async findOne(id: number): Promise<Contact> {
        const contact = await this.contactsRepository.findById(id);
        if (!contact) {
            throw new NotFoundException(`Contact with id ${id} not found`);
        }
        return contact;
    }

    /**
     * Finds the people worth reaching out to at a company and saves them
     * against the job. One Hunter domain search in, a list of contacts out.
     *
     * Only `personal` addresses are requested: role inboxes like info@ come
     * back with no name and no title, which is nothing to personalize outreach
     * from. A company Hunter has never heard of isn't an error — it just
     * returns nobody, and so do we.
     */
    async create(dto: CreateContactDto): Promise<Contact[]> {
        const domain = this.toDomain(dto.companyPageUrl);

        const { emails } = await this.hunterService.domainSearch(domain, {
            type: 'personal',
            limit: dto.limit ?? DEFAULT_LOOKUP_LIMIT,
        });

        this.logger.log(
            `Hunter returned ${emails.length} contacts at ${domain} for job ${dto.jobId}`,
        );

        if (emails.length === 0) {
            return [];
        }

        return this.contactsRepository.createMany(dto.jobId, emails);
    }

    async update(id: number, dto: UpdateContactDto): Promise<Contact> {
        await this.findOne(id); // 404s before attempting the update
        const updated = await this.contactsRepository.update(id, dto);
        if (!updated) {
            throw new NotFoundException(`Contact with id ${id} not found`);
        }
        return updated;
    }

    async remove(id: number): Promise<void> {
        const deleted = await this.contactsRepository.delete(id);
        if (!deleted) {
            throw new NotFoundException(`Contact with id ${id} not found`);
        }
    }

    /**
     * Reduces a company website to the bare domain Hunter expects:
     * 'https://www.acme.com/careers' → 'acme.com'. The DTO's @IsUrl allows a
     * scheme-less 'acme.com', which `new URL` rejects, so one is added first.
     */
    private toDomain(companyPageUrl: string): string {
        const url = companyPageUrl.trim();
        const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;

        try {
            return new URL(withScheme).hostname.replace(/^www\./i, '');
        } catch {
            throw new BadRequestException(
                `'${companyPageUrl}' is not a valid company website URL`,
            );
        }
    }
}
