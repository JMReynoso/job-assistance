import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayUnique,
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    MaxLength,
} from 'class-validator';
import { Status } from '../../jobs/enum/status.enum';

/**
 * Everything the job detail window can edit, across the three tables it
 * shows. Field names match the columns they land in, so the service never
 * has to translate — except `notes`, which is company_research.summary.
 */
export class UpdateJobDetailDto {
    // ---- jobs ----

    @ApiPropertyOptional({ example: 'Acme Corp' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    @IsOptional()
    companyName?: string;

    @ApiPropertyOptional({ enum: Status, example: Status.APPLIED })
    @IsEnum(Status)
    @IsOptional()
    status?: Status;

    @ApiPropertyOptional({ example: '2026-07-03' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'dateApplied must be a YYYY-MM-DD date',
    })
    @IsOptional()
    dateApplied?: string;

    @ApiPropertyOptional({ example: '2026-07-09' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'dateLastContacted must be a YYYY-MM-DD date',
    })
    @IsOptional()
    dateLastContacted?: string;

    @ApiPropertyOptional({
        example: 'https://boards.greenhouse.io/acme/jobs/123456',
    })
    @IsUrl()
    @IsOptional()
    jobPostingURL?: string;

    @ApiPropertyOptional({ example: 'https://www.acme.com' })
    @IsUrl()
    @IsOptional()
    companyPage?: string;

    // ---- company_research ----

    @ApiPropertyOptional({
        description:
            "The Notes box — written to company_research.summary on the job's " +
            'newest research row. Ignored when the job has none yet.',
    })
    @IsString()
    @IsOptional()
    notes?: string;

    // ---- generated_content ----

    @ApiPropertyOptional({
        description:
            'The Recruiter/HM message. Ignored when the job has no generated ' +
            'content row yet.',
    })
    @IsString()
    @IsOptional()
    outreachMessage?: string;

    @ApiPropertyOptional({ description: 'The Follow-up message.' })
    @IsString()
    @IsOptional()
    followupMessage?: string;

    @ApiPropertyOptional({
        type: [String],
        example: ['Kubernetes', 'Terraform'],
        description:
            'The complete set of checked keyword chips. Every keyword on the ' +
            'row not listed here is unchecked, so [] clears them all. Omit ' +
            'the field entirely to leave the checkboxes alone.',
    })
    @IsArray()
    @IsString({ each: true })
    @ArrayUnique()
    @IsOptional()
    includedKeywords?: string[];
}
