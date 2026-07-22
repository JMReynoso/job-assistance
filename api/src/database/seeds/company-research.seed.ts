import { CompanyResearch } from '../../entities/companyResearch/entities/company-research.entity';
import { Seed } from './seed.interface';

/** Between-angle separator — mirrors SUMMARY_ANGLE_SEPARATOR in PerplexityService. */
const SEP = '\n\n\n\n----------\n\n\n\n';

/**
 * Sample company-research rows so a freshly-migrated database isn't empty in
 * development. Idempotent: inserts only when the table has no rows, so running
 * it on every startup is safe. This is dummy data shaped like a real
 * PerplexityService `research()` result — replace or disable
 * (RUN_SEEDS=false) for production.
 */
export const companyResearchSeed: Seed = {
    name: 'company_research',
    async run(dataSource) {
        const repo = dataSource.getRepository(CompanyResearch);

        if ((await repo.count()) > 0) {
            return;
        }

        await repo.save([
            {
                jobId: 1,
                company: 'Acme Corp',
                summary:
                    '- Acme builds developer tooling for CI/CD.\n' +
                    '- Mission: help teams ship faster with less toil.\n' +
                    '- Raised a $20M Series A in 2024 led by Example Ventures.\n' +
                    '- Founded in 2019; ~120 employees.\n' +
                    '- Customers are mid-market engineering orgs.' +
                    SEP +
                    '- Engineering is TypeScript-heavy (NestJS backend, React frontend).\n' +
                    '- Strong testing culture with trunk-based development.\n' +
                    '- Publishes an active engineering blog on scaling CI.\n' +
                    '- Uses Postgres and Kubernetes in production.\n' +
                    '- Open-sources several internal libraries.',
                urls: [
                    'https://acme.example.com/about',
                    'https://acme.example.com/blog',
                ],
                usage: {
                    totalCost: 0.0123,
                    searches: 9,
                    promptTokens: 1500,
                    completionTokens: 2200,
                },
            },
            {
                jobId: 2,
                company: 'Globex',
                summary:
                    '- Globex is a bootstrapped analytics SaaS, profitable since 2022.\n' +
                    '- Serves mid-market retailers.\n' +
                    '- Mission: make retail data actionable for small teams.\n' +
                    '- No outside funding; revenue-funded growth.\n' +
                    '- Recently opened a second office in Austin.' +
                    SEP +
                    '- Backend is Python (FastAPI) with a React frontend.\n' +
                    '- Data pipeline on top of BigQuery.\n' +
                    '- Small, senior engineering team with high autonomy.\n' +
                    '- Blogs occasionally about analytics architecture.\n' +
                    '- Values pragmatic, well-tested code.',
                urls: ['https://globex.example.com/careers'],
                usage: {
                    totalCost: 0.0081,
                    searches: 6,
                    promptTokens: 1100,
                    completionTokens: 1400,
                },
            },
            {
                jobId: 3,
                company: 'Initech',
                summary:
                    '- Initech builds enterprise workflow software.\n' +
                    '- Mission: modernize legacy back-office processes.\n' +
                    '- Long-standing, stable enterprise customer base.\n' +
                    '- Privately held.\n' +
                    '- Investing heavily in a platform re-architecture.' +
                    SEP +
                    '- Runs a legacy Java monolith, mid-migration to Go microservices.\n' +
                    '- Deploying on Kubernetes.\n' +
                    '- Maintains a public tech radar.\n' +
                    '- Growing focus on automated testing.\n' +
                    '- Engineering blog covers the migration journey.',
                urls: ['https://initech.example.com/tech'],
                usage: {
                    totalCost: 0.0045,
                    searches: 3,
                    promptTokens: 700,
                    completionTokens: 900,
                },
            },
        ]);
    },
};
