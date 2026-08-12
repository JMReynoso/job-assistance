import { readFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import puppeteer, { Browser } from 'puppeteer-core';

/**
 * Renders a tailored resume (the JSON from {@link ClaudeService.draftResume})
 * to a PDF via a Handlebars template + headless Chromium, and saves it to the
 * configured storage directory — a Docker volume when running in a container.
 * Returns the stored file name (relative to RESUME_STORAGE_DIR) for the caller
 * to persist on the generated_content row.
 */
@Injectable()
export class ResumePdfService {
    private readonly logger = new Logger(ResumePdfService.name);
    private readonly template: ReturnType<typeof Handlebars.compile>;
    private readonly storageDir: string;
    private readonly executablePath?: string;

    constructor(private readonly config: ConfigService) {
        this.storageDir =
            this.config.get<string>('RESUME_STORAGE_DIR') ??
            join(process.cwd(), 'storage/resumes');

        // puppeteer-core ships no browser, so Chromium's path must be provided
        // (set in the Docker images). Local, non-Docker runs must point this at
        // an installed Chrome/Chromium.
        this.executablePath = this.config.get<string>(
            'PUPPETEER_EXECUTABLE_PATH',
        );

        this.template = this.loadTemplate();
    }

    /**
     * Renders `resume` to a PDF and saves it via {@link saveResumePdf},
     * returning the stored file name (relative to RESUME_STORAGE_DIR). The file
     * is named `<Applicant>_<Company>_<jobId>.pdf`, where the applicant comes
     * from the resume's `name` field and `companyName`/`jobId` from the caller;
     * the jobId keeps file names unique across jobs at the same company.
     */
    async renderResume(
        resume: Record<string, unknown>,
        companyName: string,
        jobId: number,
    ): Promise<string> {
        const html = this.template(resume);
        const pdf = await this.htmlToPdf(html);

        const applicantName =
            typeof resume.name === 'string' ? resume.name : 'Resume';

        return this.saveResumePdf(pdf, applicantName, companyName, jobId);
    }

    /** Compiles the bundled Handlebars template once, at construction. */
    private loadTemplate(): ReturnType<typeof Handlebars.compile> {
        Handlebars.registerHelper(
            'join',
            (value: unknown, separator: unknown) =>
                Array.isArray(value) ? value.join(String(separator)) : '',
        );

        // Resolved against __dirname so it works from dist/ in prod; the .hbs is
        // copied into dist by the `assets` glob in nest-cli.json.
        const templatePath = join(__dirname, 'templates', 'resume.hbs');

        return Handlebars.compile(readFileSync(templatePath, 'utf-8'));
    }

    /** Renders an HTML string to a PDF byte buffer with headless Chromium. */
    private async htmlToPdf(html: string): Promise<Uint8Array> {
        let browser: Browser | undefined;
        try {
            browser = await puppeteer.launch({
                executablePath: this.executablePath,
                // The container is the isolation boundary, and prod runs as a
                // non-root user, so Chromium's setuid sandbox can't be used.
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });

            const page = await browser.newPage();

            // The template is fully self-contained (inline CSS, no network
            // resources), so the load event is enough.
            await page.setContent(html, { waitUntil: 'load' });

            return await page.pdf({
                format: 'letter',
                printBackground: true,
                margin: {
                    top: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in',
                    right: '0.5in',
                },
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to render resume PDF: ${message}`);
            throw new InternalServerErrorException(
                'Failed to generate the resume PDF',
            );
        } finally {
            await browser?.close();
        }
    }

    /**
     * Helper: writes the PDF to the storage directory (a Docker volume in
     * containers), creating it if missing, and returns the stored file name —
     * `<Applicant>_<Company>_<jobId>.pdf`. The jobId keeps names unique across
     * jobs at the same company; regenerating the same job overwrites its PDF.
     */
    private async saveResumePdf(
        pdf: Uint8Array,
        applicantName: string,
        companyName: string,
        jobId: number,
    ): Promise<string> {
        await mkdir(this.storageDir, { recursive: true });

        const fileName = `${this.toFileSegment(applicantName)}_${this.toFileSegment(companyName)}_${jobId}.pdf`;
        const filePath = join(this.storageDir, fileName);

        await writeFile(filePath, pdf);

        this.logger.log(`Saved tailored resume PDF: ${filePath}`);

        return fileName;
    }

    /** Collapses a value into a filesystem-safe file-name segment. */
    private toFileSegment(value: string): string {
        return (
            value
                .trim()
                .replace(/[^\w.-]+/g, '_')
                .replace(/^[._-]+|[._-]+$/g, '') || 'unknown'
        );
    }
}
