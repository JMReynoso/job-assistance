import { Contact } from '../../entities/contacts/entities/contact.entity';
import { Seed } from './seed.interface';

/**
 * Sample contacts so a freshly-migrated database isn't empty in development.
 * Shaped like real HunterService `domainSearch()` output — including a row with
 * no name and one with no position, since Hunter frequently returns neither.
 * References the jobs seed by jobId (Acme = 1, Globex = 2, Initech = 3), so it
 * runs after that seed. Idempotent: inserts only when the table has no rows.
 * Dummy data — replace or disable (RUN_SEEDS=false) for production.
 */
export const contactsSeed: Seed = {
    name: 'contacts',
    async run(dataSource) {
        const repo = dataSource.getRepository(Contact);

        if ((await repo.count()) > 0) {
            return;
        }

        await repo.save([
            {
                jobId: 1,
                email: 'jane.doe@acme.example.com',
                firstName: 'Jane',
                lastName: 'Doe',
                position: 'Engineering Manager',
                confidence: 94,
                type: 'personal' as const,
            },
            {
                jobId: 1,
                email: 'r.patel@acme.example.com',
                firstName: 'Riya',
                lastName: 'Patel',
                position: 'Technical Recruiter',
                confidence: 88,
                type: 'personal' as const,
            },
            {
                jobId: 2,
                email: 'sam.reed@globex.example.com',
                firstName: 'Sam',
                lastName: 'Reed',
                // Hunter found the address but no job title for this one.
                confidence: 72,
                type: 'personal' as const,
            },
            {
                jobId: 3,
                email: 'careers@initech.example.com',
                // A role address: no name, no person behind it.
                position: 'Careers inbox',
                confidence: 61,
                type: 'generic' as const,
            },
        ]);
    },
};
