import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    MaxLength,
} from 'class-validator';
import { Status } from '../enum/status.enum';

export class CreateJobDto {
    @ApiProperty({
        example: 'Acme Corp',
        description: 'Company the job is with',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    companyName: string;

    @ApiProperty({
        example: 'https://boards.greenhouse.io/acme/jobs/123456',
        description: 'URL of the original job posting',
    })
    @IsUrl()
    @IsNotEmpty()
    jobPostingURL: string;

    @ApiProperty({
        example: 'https://www.acme.com',
        description: "Company's main website",
    })
    @IsUrl()
    @IsNotEmpty()
    companyPage: string;

    @ApiProperty({
        example: 'https://www.linkedin.com/company/acme-corp',
        description: "Company's LinkedIn page",
    })
    @IsUrl()
    @IsNotEmpty()
    companyLinkedIn: string;

    @ApiPropertyOptional({
        example: 'https://www.crunchbase.com/organization/acme-corp',
        description: 'Any additional relevant URL',
    })
    @IsUrl()
    @IsOptional()
    extraURLs?: string;

    @ApiPropertyOptional({
        enum: Status,
        example: Status.NOT_APPLIED,
        description: 'Pipeline status; defaults to not_applied when omitted',
    })
    @IsEnum(Status)
    @IsOptional()
    status?: Status;

    // Optional on the way in — omitting either lets the column default fill it
    // with today, which is what creating a job should do. But a value that IS
    // supplied has to be a real date: @Matches rejects '' where @IsOptional
    // would not, so neither create nor PATCH can ever blank one of these out.
    // Matched rather than @IsDateString(), which would also accept a full ISO
    // datetime — these are `date` columns, so a time component has nowhere to go.

    @ApiPropertyOptional({
        example: '2026-07-03',
        description:
            'Calendar day the application was submitted (YYYY-MM-DD); ' +
            'defaults to today when omitted',
    })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'dateApplied must be a YYYY-MM-DD date',
    })
    @IsOptional()
    dateApplied?: string;

    @ApiPropertyOptional({
        example: '2026-07-09',
        description:
            'Calendar day the company was last heard from (YYYY-MM-DD); ' +
            'defaults to today when omitted',
    })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'dateLastContacted must be a YYYY-MM-DD date',
    })
    @IsOptional()
    dateLastContacted?: string;
}
