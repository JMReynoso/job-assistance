import { GeneratedContent } from '../../entities/generatedContent/entities/generated-content.entity';
import { Seed } from './seed.interface';

/**
 * Sample generated-content rows so a freshly-migrated database isn't empty in
 * development. Idempotent: inserts only when the table has no rows, so running
 * it on every startup is safe. The jobIds line up with the company_research
 * seed (Acme / Globex / Initech). The `*Usage` columns hold Claude's raw token
 * usage, and `tailoredResume` is a placeholder PDF path until the Puppeteer step
 * exists. Dummy data — replace or disable (RUN_SEEDS=false) for production.
 */
export const generatedContentSeed: Seed = {
    name: 'generated_content',
    async run(dataSource) {
        const repo = dataSource.getRepository(GeneratedContent);

        if ((await repo.count()) > 0) {
            return;
        }

        await repo.save([
            {
                jobId: 1,
                outreachMessage:
                    'Hi Jane, I came across the Backend Engineer role at Acme and ' +
                    'was drawn to your work on developer tooling for CI/CD. Your ' +
                    "TypeScript/NestJS stack lines up closely with what I've been " +
                    "building, and I'd love to chat about how I could contribute.",
                followupMessage:
                    'Hi Jane, just following up on my earlier note about the Acme ' +
                    "Backend Engineer role. I'm still very interested and happy to " +
                    'share more about my experience scaling CI pipelines whenever ' +
                    'the timing works.',
                tailoredResume: 'resumes/acme-corp-backend.pdf',
                outreachMessageUsage: {
                    input_tokens: 3180,
                    output_tokens: 240,
                },
                followupMessageUsage: {
                    input_tokens: 3180,
                    output_tokens: 190,
                },
                tailoredResumeUsage: {
                    input_tokens: 6100,
                    output_tokens: 3820,
                },
                outreachMessageCost: 0.00876,
                followupMessageCost: 0.00826,
                tailoredResumeCost: 0.126,
            },
            {
                jobId: 2,
                outreachMessage:
                    'Hi Sam, the Analytics Engineer opening at Globex caught my eye ' +
                    '— making retail data actionable for small teams is exactly the ' +
                    "kind of problem I enjoy. I'd welcome the chance to talk about " +
                    'your FastAPI + BigQuery pipeline.',
                followupMessage:
                    'Hi Sam, circling back on the Globex Analytics Engineer role. ' +
                    "I remain keen and would be glad to walk through how I've built " +
                    'pragmatic, well-tested data pipelines in the past.',
                tailoredResume: 'resumes/globex-analytics.pdf',
                outreachMessageUsage: {
                    input_tokens: 2740,
                    output_tokens: 210,
                },
                followupMessageUsage: {
                    input_tokens: 2740,
                    output_tokens: 175,
                },
                tailoredResumeUsage: {
                    input_tokens: 5600,
                    output_tokens: 3410,
                },
                outreachMessageCost: 0.00758,
                followupMessageCost: 0.00723,
                tailoredResumeCost: 0.11325,
            },
            {
                jobId: 3,
                outreachMessage:
                    'Hi Priya, I noticed the Platform Engineer role at Initech and ' +
                    'found your Java-to-Go migration especially interesting. I have ' +
                    'hands-on experience moving monoliths to services on Kubernetes ' +
                    "and would love to learn more about where you're headed.",
                followupMessage:
                    'Hi Priya, following up on the Initech Platform Engineer role. ' +
                    "I'm still very interested and happy to share details on my " +
                    'migration and testing work whenever you have a moment.',
                tailoredResume: 'resumes/initech-platform.pdf',
                outreachMessageUsage: {
                    input_tokens: 2980,
                    output_tokens: 230,
                },
                followupMessageUsage: {
                    input_tokens: 2980,
                    output_tokens: 185,
                },
                tailoredResumeUsage: {
                    input_tokens: 5900,
                    output_tokens: 3660,
                },
                outreachMessageCost: 0.00826,
                followupMessageCost: 0.00781,
                tailoredResumeCost: 0.121,
            },
        ]);
    },
};
