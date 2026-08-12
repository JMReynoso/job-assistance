import { Status } from '../../entities/jobs/enum/status.enum';
import { Job } from '../../entities/jobs/job.entity';
import { Seed } from './seed.interface';

/**
 * Sample jobs so a freshly-migrated database isn't empty in development. These
 * are the parent rows the company_research and generated_content seeds reference
 * by jobId (Acme = 1, Globex = 2, Initech = 3), so this seed runs before them.
 * Idempotent: inserts only when the table has no rows. Dummy data — replace or
 * disable (RUN_SEEDS=false) for production.
 */
export const jobsSeed: Seed = {
    name: 'jobs',
    async run(dataSource) {
        const repo = dataSource.getRepository(Job);

        if ((await repo.count()) > 0) {
            return;
        }

        await repo.save([
            {
                companyName: 'Acme Corp',
                jobPostingURL: 'https://boards.greenhouse.io/acme/jobs/123456',
                companyPage: 'https://acme.example.com',
                companyLinkedIn: 'https://www.linkedin.com/company/acme-corp',
                status: Status.APPLIED,
            },
            {
                companyName: 'Globex',
                jobPostingURL: 'https://globex.example.com/careers/backend',
                companyPage: 'https://globex.example.com',
                companyLinkedIn: 'https://www.linkedin.com/company/globex',
                status: Status.INTERVIEWING,
            },
            {
                companyName: 'Initech',
                jobPostingURL: 'https://initech.example.com/jobs/platform',
                companyPage: 'https://initech.example.com',
                companyLinkedIn: 'https://www.linkedin.com/company/initech',
                extraURLs: 'https://www.crunchbase.com/organization/initech',
                status: Status.NOT_APPLIED,
            },
        ]);
    },
};
