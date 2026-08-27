import { Status } from '../../entities/jobs/enum/status.enum';
import { Job } from '../../entities/jobs/job.entity';
import { Seed } from './seed.interface';

/**
 * Job posting text for the three seeded jobs. Kept as named constants because
 * they are long, and because the generated_content and missing_keywords seeds
 * are written against them: every seeded missing keyword is a phrase that
 * genuinely appears in one of these descriptions and genuinely does not appear
 * in that job's seeded tailoredResumeJson. Change a description and those two
 * seeds stop telling a coherent story.
 *
 * This is also what makes the JD-match feature testable without pasting a real
 * posting in by hand — before jobs.jobDescription existed, draftResume was sent
 * the bare jobPostingURL, which it has no way to open.
 */
const ACME_JOB_DESCRIPTION = `Backend Engineer, Developer Platform — Acme Corp

Acme builds CI/CD tooling for mid-market engineering organizations. You will
own services in our build-orchestration platform: the APIs that schedule
pipeline runs, fan work out to runners, and stream results back to the web app.

What you'll do
- Design and ship REST APIs in TypeScript on NestJS, backed by PostgreSQL.
- Extend the React front end that engineers use to debug failing pipelines.
- Run and scale our services on Kubernetes; own them in production.
- Keep our own CI/CD automation fast — we dogfood the product.
- Write tests that let us practice trunk-based development with confidence.

What we're looking for
- Strong TypeScript and Node.js experience building production REST APIs.
- Working knowledge of PostgreSQL, including query performance.
- Comfort with Docker and Kubernetes, and with infrastructure as code.
- Familiarity with GitHub Actions or a comparable CI system.
- A testing habit: Jest, integration tests, and a bias toward automation.

Nice to have
- Experience with Redis, Terraform, or observability tooling.
- Open-source contributions to developer tooling.`;

const GLOBEX_JOB_DESCRIPTION = `Analytics Engineer — Globex

Globex is a bootstrapped, profitable analytics SaaS for mid-market retailers.
We are hiring an Analytics Engineer to own the modelling layer between our raw
event data and the dashboards our customers live in.

What you'll do
- Build and maintain transformation models in dbt against BigQuery.
- Own our Apache Airflow DAGs: scheduling, backfills, and data-quality checks.
- Design dimensional modelling (star schemas, slowly changing dimensions) that
  keeps customer-facing metrics consistent across reports.
- Ship and maintain internal Python services on FastAPI that expose modelled
  data to the product.
- Build and maintain Looker explores and dashboards for internal stakeholders.

What we're looking for
- Strong SQL and Python, and real experience with a cloud data warehouse.
- Hands-on dbt experience in a production warehouse.
- Experience orchestrating pipelines with Apache Airflow or similar.
- Solid grasp of dimensional modelling and warehouse design trade-offs.
- Comfort managing infrastructure as code with Terraform.

Nice to have
- Looker or another BI semantic layer at scale.
- Retail or e-commerce data experience.`;

const INITECH_JOB_DESCRIPTION = `Platform Engineer — Initech

Initech builds enterprise workflow software. We are part-way through migrating
a long-lived Java monolith to Go microservices, and we need a platform engineer
to carry that migration the rest of the way.

What you'll do
- Extract services from the Java monolith and rewrite them in Go.
- Define service-to-service contracts in gRPC and keep them backwards
  compatible through the migration.
- Run these services on Kubernetes; own the Helm charts that deploy them.
- Publish events between services with Apache Kafka.
- Instrument everything with OpenTelemetry so we can trace a request across
  the monolith and the new services.

What we're looking for
- Production Go experience, or strong backend experience and an appetite for it.
- Experience operating services on Kubernetes, including Helm.
- Familiarity with gRPC and Protocol Buffers.
- Experience with distributed tracing — OpenTelemetry preferred.
- Comfort with event-driven architecture, ideally Apache Kafka.

Nice to have
- Experience decomposing a monolith in a regulated enterprise environment.
- Terraform, or another infrastructure-as-code tool.`;

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
                jobDescription: ACME_JOB_DESCRIPTION,
                status: Status.APPLIED,
                dateApplied: '2026-07-03',
                dateLastContacted: '2026-07-09',
            },
            {
                companyName: 'Globex',
                jobPostingURL: 'https://globex.example.com/careers/backend',
                companyPage: 'https://globex.example.com',
                companyLinkedIn: 'https://www.linkedin.com/company/globex',
                jobDescription: GLOBEX_JOB_DESCRIPTION,
                status: Status.INTERVIEWING,
                dateApplied: '2026-06-18',
                dateLastContacted: '2026-08-20',
            },
            {
                companyName: 'Initech',
                jobPostingURL: 'https://initech.example.com/jobs/platform',
                companyPage: 'https://initech.example.com',
                companyLinkedIn: 'https://www.linkedin.com/company/initech',
                extraURLs: 'https://www.crunchbase.com/organization/initech',
                jobDescription: INITECH_JOB_DESCRIPTION,
                status: Status.NOT_APPLIED,
                // Set explicitly rather than leaning on the CURRENT_DATE
                // default, so seeded rows are the same on every machine.
                dateApplied: '2026-08-14',
                dateLastContacted: '2026-08-14',
            },
        ]);
    },
};
