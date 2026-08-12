import { Module } from '@nestjs/common';
import { ResumePdfService } from './resume-pdf.service';

/**
 * Import this module wherever a tailored-resume PDF needs rendering, then inject
 * {@link ResumePdfService}. ConfigService (RESUME_STORAGE_DIR,
 * PUPPETEER_EXECUTABLE_PATH) comes from the global ConfigModule.
 */
@Module({
    providers: [ResumePdfService],
    exports: [ResumePdfService],
})
export class ResumePdfModule {}
