import { GeneratedContent } from '../../entities/generatedContent/entities/generated-content.entity';
import { Seed } from './seed.interface';

/**
 * Builds a resume object in the same shape as `src/CV/resume.example.json` —
 * the shape the Handlebars template renders and the shape `regenerateResume`
 * is told to hand back. Everything except the three tailored parts is shared,
 * because that is what tailoring actually changes in practice: the summary,
 * the skills matrix, and the lead bullet on the most recent role.
 *
 * Seeding a real object rather than a placeholder matters: `regenerate()`
 * reads `tailoredResumeJson` and 404s without it, so a seeded row with a null
 * here can't exercise the regenerate path at all.
 */
function buildTailoredResume(tailoring: {
    summary: string;
    technicalSkills: Record<string, string[]>;
    leadBullet: string;
}): Record<string, unknown> {
    return {
        name: 'Jane Doe',
        contact: {
            location: 'Austin, TX',
            email: 'jane.doe@example.com',
            phone: '555-555-0100',
            linkedin: 'linkedin.com/in/janedoe',
            github: 'github.com/janedoe',
            portfolio: 'janedoe.example.com',
        },
        summary: tailoring.summary,
        technical_skills: tailoring.technicalSkills,
        professional_experience: [
            {
                title: 'Senior Software Engineer',
                company: 'Example Corp',
                start_date: 'Jan 2023',
                end_date: 'Present',
                date_range: 'Jan 2023 – Present',
                bullets: [
                    tailoring.leadBullet,
                    'Cut median deploy time from 22 minutes to 6 by parallelising the test suite and caching build artifacts.',
                    'Led an incident-review practice across 14 services, cutting mean time to detection by 40%.',
                ],
            },
            {
                title: 'Software Engineer',
                company: 'Sample Inc',
                start_date: 'Jun 2020',
                end_date: 'Dec 2022',
                date_range: 'Jun 2020 – Dec 2022',
                bullets: [
                    'Built the reporting API serving 2.4M requests/day, backed by PostgreSQL and Redis.',
                    'Introduced integration testing with Jest and Testcontainers, taking coverage from 31% to 78%.',
                ],
            },
        ],
        projects: [
            {
                name: 'Job Assistance Tracker',
                context: null,
                technologies: ['NestJS', 'PostgreSQL', 'Docker'],
                start_date: 'Feb 2024',
                end_date: 'Present',
                date_range: 'Feb 2024 – Present',
                bullets: [
                    'Self-hosted tracker that researches companies and drafts tailored application material.',
                    'Runs migrations, seeds, and a headless-Chromium PDF renderer from one Docker Compose stack.',
                ],
            },
        ],
        certifications: [
            {
                name: 'AWS Certified Solutions Architect – Associate',
                issuer: 'Amazon Web Services',
                status: 'Certified',
                details: [
                    'Focus on cost-aware architecture and multi-AZ design.',
                ],
            },
        ],
        education: [
            {
                degree: 'B.S., Computer Science',
                institution: 'Example University',
                start_year: '2016',
                end_year: '2020',
                date_range: '2016 – 2020',
                details: ['Coursework in distributed systems and databases.'],
            },
        ],
    };
}

/**
 * Sample generated-content rows so a freshly-migrated database isn't empty in
 * development. Idempotent: inserts only when the table has no rows, so running
 * it on every startup is safe. The jobIds line up with the company_research
 * seed (Acme / Globex / Initech). Dummy data — replace or disable
 * (RUN_SEEDS=false) for production.
 *
 * The three rows deliberately cover the three JD-match states the UI branches
 * on, so every one of them is reachable without spending a cent on Claude:
 *
 * | job | match | regenerateCount | missing_keywords rows          |
 * | --- | ----- | --------------- | ------------------------------ |
 * | 1   | 91%   | 0               | none — the "nothing missing"   |
 * |     |       |                 | empty state; no chips, no      |
 * |     |       |                 | Regenerate button              |
 * | 2   | 64%   | 0               | 6, none checked — Regenerate   |
 * |     |       |                 | is rendered but disabled       |
 * | 3   | 76%   | 2               | 5, 3 checked — the post-       |
 * |     |       |                 | regeneration state             |
 *
 * Two conventions worth knowing before you edit the numbers:
 *
 * - **`*Usage` is the most recent call; `*Cost` is the running total.** On jobs
 *   1 and 2 nothing has been regenerated, so `jdMatchCost` is exactly what
 *   `costFromUsage('claude-opus-5', jdMatchUsage)` derives. On job 3 it is not,
 *   and must not be — it is three scoring calls and two rewrites summed. That
 *   divergence is the point of the row.
 * - **`tailoredResume` / `tailoredResumeJsonPath` are bare file names**, matching
 *   what `ResumePdfService` actually writes (`<Applicant>_<Company>_<jobId>`).
 *   These used to be seeded as `resumes/…`, a shape nothing in the app produces.
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
                tailoredResume: 'Jane_Doe_Acme_Corp_1.pdf',
                tailoredResumeJsonPath: 'Jane_Doe_Acme_Corp_1.json',
                // Covers the Acme posting almost point for point, which is why
                // this row scores 91 and has no missing keywords.
                tailoredResumeJson: buildTailoredResume({
                    summary:
                        'Backend engineer with 6 years building production REST APIs in ' +
                        'TypeScript and Node.js, operating them on Kubernetes, and keeping ' +
                        'the CI/CD that ships them fast.',
                    technicalSkills: {
                        Languages: [
                            'TypeScript',
                            'JavaScript',
                            'SQL',
                            'Python',
                        ],
                        'Backend & Frameworks': [
                            'Node.js',
                            'NestJS',
                            'Express',
                        ],
                        'Frontend & Frameworks': [
                            'React',
                            'Next.js',
                            'Tailwind CSS',
                        ],
                        'Databases & Caching': ['PostgreSQL', 'Redis'],
                        'Cloud & DevOps': [
                            'AWS',
                            'Docker',
                            'Kubernetes',
                            'Terraform',
                            'GitHub Actions',
                        ],
                        Testing: [
                            'Jest',
                            'Testcontainers',
                            'Integration testing',
                        ],
                        Tools: ['Git', 'JIRA', 'Postman'],
                        Practices: [
                            'REST API design',
                            'CI/CD automation',
                            'Trunk-based development',
                            'Infrastructure as code',
                        ],
                    },
                    leadBullet:
                        'Built the pipeline-orchestration API in NestJS and PostgreSQL that ' +
                        'schedules 40k builds a day across a Kubernetes runner fleet.',
                }),
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
                jdMatchPercent: 91,
                jdMatchUsage: {
                    input_tokens: 7100,
                    output_tokens: 520,
                },
                // (7100 * $5 + 520 * $25) / 1M — one scoring call, so the cost
                // is still derivable from the usage above.
                jdMatchCost: 0.0485,
                regenerateCount: 0,
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
                tailoredResume: 'Jane_Doe_Globex_2.pdf',
                tailoredResumeJsonPath: 'Jane_Doe_Globex_2.json',
                // Deliberately warehouse-light: no BigQuery, dbt, Airflow, Looker,
                // Terraform, or dimensional modelling. Those are exactly the six
                // rows the missing_keywords seed attaches to this content.
                tailoredResumeJson: buildTailoredResume({
                    summary:
                        'Engineer with 6 years across Python and SQL services, shipping ' +
                        'reporting APIs and the data models behind them for retail and ' +
                        'e-commerce teams.',
                    technicalSkills: {
                        Languages: ['Python', 'SQL', 'TypeScript'],
                        'Backend & Frameworks': [
                            'FastAPI',
                            'Node.js',
                            'NestJS',
                        ],
                        'Databases & Caching': ['PostgreSQL', 'Redis'],
                        'Cloud & DevOps': ['AWS', 'Docker', 'GitHub Actions'],
                        Testing: ['pytest', 'Jest', 'Testcontainers'],
                        Tools: ['Git', 'JIRA', 'Postman'],
                        Practices: [
                            'REST API design',
                            'ETL pipeline design',
                            'Data quality checks',
                        ],
                    },
                    leadBullet:
                        'Owned the nightly reporting pipeline in Python and SQL that feeds ' +
                        'customer-facing dashboards for 300+ retail accounts.',
                }),
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
                jdMatchPercent: 64,
                jdMatchUsage: {
                    input_tokens: 6200,
                    output_tokens: 480,
                },
                // (6200 * $5 + 480 * $25) / 1M — one scoring call, still derivable.
                jdMatchCost: 0.043,
                regenerateCount: 0,
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
                tailoredResume: 'Jane_Doe_Initech_3.pdf',
                tailoredResumeJsonPath: 'Jane_Doe_Initech_3.json',
                // Two regenerations have already worked Go, Kubernetes, and Helm
                // in — so those three keywords are checked but present, while
                // gRPC and OpenTelemetry are still genuinely absent.
                tailoredResumeJson: buildTailoredResume({
                    summary:
                        'Platform engineer with 6 years decomposing monoliths into services, ' +
                        'writing Go on Kubernetes, and owning the Helm charts that deploy ' +
                        'them in regulated enterprise environments.',
                    technicalSkills: {
                        Languages: ['Go', 'Java', 'TypeScript', 'SQL'],
                        'Backend & Frameworks': [
                            'Node.js',
                            'NestJS',
                            'Spring Boot',
                        ],
                        'Databases & Caching': ['PostgreSQL', 'Redis'],
                        'Cloud & DevOps': [
                            'AWS',
                            'Docker',
                            'Kubernetes',
                            'Helm',
                            'GitHub Actions',
                        ],
                        Testing: ['Go testing', 'JUnit', 'Testcontainers'],
                        Tools: ['Git', 'JIRA', 'Postman'],
                        Practices: [
                            'Service extraction',
                            'REST API design',
                            'CI/CD automation',
                        ],
                    },
                    leadBullet:
                        'Extracted seven services from a Java monolith into Go, deploying ' +
                        'each behind its own Helm chart on Kubernetes with no customer downtime.',
                }),
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
                jdMatchPercent: 76,
                // Latest of three scoring calls (one at creation, one per regenerate).
                jdMatchUsage: {
                    input_tokens: 6900,
                    output_tokens: 505,
                },
                // Sum of all three: 0.0446 + 0.04585 + 0.047125. Intentionally NOT
                // derivable from jdMatchUsage — that is what accumulation means.
                jdMatchCost: 0.139575,
                // Latest of two rewrite calls.
                regenerateUsage: {
                    input_tokens: 8600,
                    output_tokens: 3980,
                },
                // Sum of both: 0.13905 + 0.1425.
                regenerateCost: 0.28155,
                regenerateCount: 2,
            },
        ]);
    },
};
