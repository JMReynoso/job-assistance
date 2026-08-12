import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
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
}
