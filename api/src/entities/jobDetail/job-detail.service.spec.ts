import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CompanyResearchService } from '../companyResearch/company-research.service';
import { CompanyResearch } from '../companyResearch/entities/company-research.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { ContactsService } from '../contacts/contacts.service';
import { GeneratedContent } from '../generatedContent/entities/generated-content.entity';
import { MissingKeyword } from '../generatedContent/entities/missing-keyword.entity';
import { GeneratedContentService } from '../generatedContent/generated-content.service';
import { Status } from '../jobs/enum/status.enum';
import { Job } from '../jobs/job.entity';
import { JobsService } from '../jobs/jobs.service';
import { JobDetailService } from './job-detail.service';

// GeneratedContentService is only here as an injection token, but importing it
// pulls in the PDF renderer and with it puppeteer-core, which ships ESM only
// and which jest's default (CommonJS) transform can't parse. Stubbing the
// package keeps the API's jest config untouched; nothing here renders a PDF.
jest.mock('puppeteer-core', () => ({}));

type JobsMock = jest.Mocked<Pick<JobsService, 'findOne' | 'update'>>;
type ContactsMock = jest.Mocked<Pick<ContactsService, 'findByJobId'>>;
type ResearchMock = jest.Mocked<
    Pick<CompanyResearchService, 'findByJobId' | 'updateSummaryFromJobDetail'>
>;
type ContentMock = jest.Mocked<
    Pick<
        GeneratedContentService,
        'findByJobIdWithKeywords' | 'updateFromJobDetail'
    >
>;

const JOB_ID = 1;

const job = { id: JOB_ID, companyName: 'Acme', status: Status.APPLIED } as Job;
const contacts = [
    { id: 11, jobId: JOB_ID, email: 'dana@acme.test', confidence: 94 },
] as Contact[];
const research = {
    id: 21,
    jobId: JOB_ID,
    summary: 'Founded 2011.',
} as CompanyResearch;
const content = {
    id: 31,
    jobId: JOB_ID,
    outreachMessage: 'Hi Dana',
    missingKeywords: [
        { id: 41, keyword: 'Kubernetes', include: false },
    ] as MissingKeyword[],
} as GeneratedContent & { missingKeywords: MissingKeyword[] };

describe('JobDetailService', () => {
    let service: JobDetailService;
    let jobs: JobsMock;
    let contactsService: ContactsMock;
    let researchService: ResearchMock;
    let contentService: ContentMock;

    // A Job with every satellite present is the baseline; a test that cares
    // about a missing satellite or a missing Job overrides just that one.
    beforeEach(async () => {
        jobs = {
            findOne: jest.fn().mockResolvedValue(job),
            update: jest.fn().mockResolvedValue(job),
        };
        contactsService = {
            findByJobId: jest.fn().mockResolvedValue(contacts),
        };
        researchService = {
            findByJobId: jest.fn().mockResolvedValue(research),
            updateSummaryFromJobDetail: jest.fn().mockResolvedValue(research),
        };
        contentService = {
            findByJobIdWithKeywords: jest.fn().mockResolvedValue(content),
            updateFromJobDetail: jest.fn().mockResolvedValue(content),
        };

        const module = await Test.createTestingModule({
            providers: [
                JobDetailService,
                { provide: JobsService, useValue: jobs },
                { provide: ContactsService, useValue: contactsService },
                { provide: CompanyResearchService, useValue: researchService },
                { provide: GeneratedContentService, useValue: contentService },
            ],
        }).compile();

        service = module.get(JobDetailService);
    });

    describe('update', () => {
        it('rejects with NotFoundException and writes nothing when the Job does not exist', async () => {
            // Arrange
            jobs.findOne.mockRejectedValue(new NotFoundException());

            // Act
            const result = service.update(JOB_ID, {
                companyName: 'Globex',
                notes: 'New notes',
                outreachMessage: 'New message',
            });

            // Assert
            await expect(result).rejects.toThrow(NotFoundException);
            expect(jobs.update).not.toHaveBeenCalled();
            expect(
                researchService.updateSummaryFromJobDetail,
            ).not.toHaveBeenCalled();
            expect(contentService.updateFromJobDetail).not.toHaveBeenCalled();
        });

        it('never calls the Job update when the patch has no Job fields', async () => {
            // Arrange
            const dto = { notes: 'New notes' };

            // Act
            await service.update(JOB_ID, dto);

            // Assert
            expect(jobs.update).not.toHaveBeenCalled();
        });

        it('sends the Job update exactly the Job fields provided', async () => {
            // Arrange
            const dto = {
                companyName: 'Globex',
                status: Status.OFFER,
                notes: 'Not a Job field',
            };

            // Act
            await service.update(JOB_ID, dto);

            // Assert — toStrictEqual, so a stray `key: undefined` fails too
            expect(jobs.update).toHaveBeenCalledTimes(1);
            expect(jobs.update.mock.calls[0][0]).toBe(JOB_ID);
            expect(jobs.update.mock.calls[0][1]).toStrictEqual({
                companyName: 'Globex',
                status: Status.OFFER,
            });
        });

        it('skips the Notes write when the Job has no Company Research', async () => {
            // Arrange
            researchService.findByJobId.mockResolvedValue(null);

            // Act
            await service.update(JOB_ID, { notes: 'New notes' });

            // Assert
            expect(
                researchService.updateSummaryFromJobDetail,
            ).not.toHaveBeenCalled();
        });

        it('writes the Notes to the newest Company Research summary', async () => {
            // Arrange
            const newest = { ...research, id: 22 };
            researchService.findByJobId.mockResolvedValue(newest);

            // Act
            await service.update(JOB_ID, { notes: 'New notes' });

            // Assert
            expect(
                researchService.updateSummaryFromJobDetail,
            ).toHaveBeenCalledWith(22, 'New notes');
        });

        it.each([
            ['outreachMessage', { outreachMessage: 'Hello' }],
            ['followupMessage', { followupMessage: 'Checking in' }],
            ['includedKeywords', { includedKeywords: ['Kubernetes'] }],
        ])(
            'updates Generated Content when the patch has %s',
            async (_field, dto) => {
                // Act
                await service.update(JOB_ID, dto);

                // Assert
                expect(contentService.updateFromJobDetail).toHaveBeenCalledWith(
                    JOB_ID,
                    expect.objectContaining(dto),
                );
            },
        );

        it('makes no Generated Content write when the patch has no message or keyword fields', async () => {
            // Arrange
            const dto = { companyName: 'Globex', notes: 'New notes' };

            // Act
            await service.update(JOB_ID, dto);

            // Assert
            expect(contentService.updateFromJobDetail).not.toHaveBeenCalled();
        });

        it('returns the Job with its Contacts, Company Research and Generated Content', async () => {
            // Act
            const result = await service.update(JOB_ID, {});

            // Assert
            expect(result).toEqual({
                job,
                contacts,
                research,
                content,
            });
        });

        it('returns [] Contacts and null research and content for a Job with no satellites', async () => {
            // Arrange
            contactsService.findByJobId.mockResolvedValue([]);
            researchService.findByJobId.mockResolvedValue(null);
            contentService.findByJobIdWithKeywords.mockResolvedValue(null);
            contentService.updateFromJobDetail.mockResolvedValue(null);

            // Act — a patch that tries to write both satellites, which don't exist
            const result = await service.update(JOB_ID, {
                notes: 'New notes',
                outreachMessage: 'Hello',
            });

            // Assert
            expect(result).toStrictEqual({
                job,
                contacts: [],
                research: null,
                content: null,
            });
        });
    });
});
