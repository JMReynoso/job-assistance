import { CompanyResearch } from '../../entities/companyResearch/entities/company-research.entity';
import { Seed } from './seed.interface';

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
                reports: [
                    {
                        angle: 'company-product-funding',
                        content:
                            'Acme builds developer tooling for CI/CD and raised a $20M Series A in 2024 led by Example Ventures.',
                    },
                    {
                        angle: 'eng-culture-stack',
                        content:
                            'Engineering is TypeScript-heavy (NestJS on the backend, React on the front end) with a strong testing culture.',
                    },
                ],
                sources: [
                    {
                        title: 'About Acme',
                        url: 'https://acme.example.com/about',
                        date: '2024-03-01',
                        last_updated: null,
                        snippet:
                            'Acme is a developer-tooling company founded in 2019.',
                        hits: 3,
                        verified: true,
                    },
                    {
                        title: 'Acme Engineering Blog',
                        url: 'https://acme.example.com/blog',
                        date: '2024-05-12',
                        last_updated: '2024-06-01',
                        hits: 2,
                    },
                ],
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
                reports: [
                    {
                        angle: 'company-product-funding',
                        content:
                            'Globex is a bootstrapped analytics SaaS profitable since 2022, serving mid-market retailers.',
                    },
                    {
                        angle: 'news-hiring',
                        content:
                            'Globex is actively hiring backend engineers after opening a second office in Austin.',
                    },
                ],
                sources: [
                    {
                        title: 'Globex Careers',
                        url: 'https://globex.example.com/careers',
                        date: null,
                        last_updated: null,
                        snippet: 'Open roles across engineering and data.',
                        hits: 2,
                        verified: true,
                    },
                ],
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
                reports: [
                    {
                        angle: 'eng-culture-stack',
                        content:
                            'Initech runs a legacy Java monolith but is mid-migration to Go microservices on Kubernetes.',
                    },
                ],
                sources: [
                    {
                        title: 'Initech Tech Radar',
                        url: 'https://initech.example.com/tech',
                        date: '2023-11-20',
                        last_updated: null,
                        hits: 1,
                    },
                ],
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
