import { GeneratedContent } from '../../entities/generatedContent/entities/generated-content.entity';
import { MissingKeyword } from '../../entities/generatedContent/entities/missing-keyword.entity';
import { Seed } from './seed.interface';

/** Keywords to attach, keyed by the jobId of the content run they belong to. */
const KEYWORDS_BY_JOB_ID: Record<
    number,
    { keyword: string; include: boolean }[]
> = {
    // Job 1 (Acme) is absent on purpose. Its resume covers the posting, so
    // scoreResumeMatch returned an empty array and replaceForContent saved
    // nothing — the empty state MissingKeywords renders as nothing at all.

    // Job 2 (Globex): freshly scored at 64%, nothing checked yet. This is
    // what a user sees right after generating, and it is the row that keeps
    // the Regenerate button disabled until a box is ticked.
    2: [
        // Ordered highest-impact-first, the way scoreResumeMatch returns them
        // and the way findByContentId (order: id ASC) preserves.
        { keyword: 'BigQuery', include: false },
        { keyword: 'dbt', include: false },
        { keyword: 'Apache Airflow', include: false },
        { keyword: 'dimensional modelling', include: false },
        { keyword: 'Terraform', include: false },
        { keyword: 'Looker', include: false },
    ],

    // Job 3 (Initech): two regenerations in. The three checked keywords have
    // already been worked into that row's tailoredResumeJson and stay checked
    // — regenerate() calls setIncluded and deliberately does not replace the
    // list, so checkbox state survives. The two unchecked ones are still
    // genuinely absent from the resume.
    3: [
        { keyword: 'Go', include: true },
        { keyword: 'Kubernetes', include: true },
        { keyword: 'gRPC', include: false },
        { keyword: 'Helm', include: true },
        { keyword: 'OpenTelemetry', include: false },
    ],
};

/**
 * Sample missing-keyword rows so the JD-match chips, the checkbox state, and
 * the Regenerate button's enabled/disabled branches are all reachable in
 * development without spending anything on Claude. Every keyword here appears
 * verbatim in that job's `jobDescription` (jobs.seed.ts) and is absent from that
 * row's `tailoredResumeJson` (generated-content.seed.ts) unless it is marked
 * `include: true`, in which case a seeded regeneration has already worked it in.
 *
 * Unlike the other satellite seeds, this one cannot hard-code its parent ids.
 * `missing_keywords.generatedContentId` carries a real foreign key, so a wrong
 * id is a constraint violation rather than a silent orphan — the rows are
 * looked up by jobId and the seed skips any job that has no content row.
 *
 * Runs after generated_content for the same reason. Idempotent: inserts only
 * when the table has no rows. Dummy data — replace or disable (RUN_SEEDS=false)
 * for production.
 */
export const missingKeywordsSeed: Seed = {
    name: 'missing_keywords',
    async run(dataSource) {
        const repo = dataSource.getRepository(MissingKeyword);

        if ((await repo.count()) > 0) {
            return;
        }

        const contentRepo = dataSource.getRepository(GeneratedContent);
        const rows: Partial<MissingKeyword>[] = [];

        for (const [jobId, keywords] of Object.entries(KEYWORDS_BY_JOB_ID)) {
            const content = await contentRepo.findOne({
                where: { jobId: Number(jobId) },
                order: { id: 'DESC' },
            });

            // No content row means the generated_content seed was skipped or
            // edited. Skip rather than fail: seeds run on every startup, and a
            // partial seed is not worth blocking the app from booting.
            if (!content) {
                continue;
            }

            rows.push(
                ...keywords.map((entry) => ({
                    generatedContentId: content.id,
                    ...entry,
                })),
            );
        }

        if (rows.length === 0) {
            return;
        }

        await repo.save(rows);
    },
};
