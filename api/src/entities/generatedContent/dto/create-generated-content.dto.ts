import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
} from 'class-validator';

export class CreateGeneratedContentDto {
    @ApiProperty({
        example: 1,
        description: 'FK to the job this content belongs to',
    })
    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    jobId: number;

    @ApiProperty({
        example: 'Senior Backend Engineer at Acme — build and operate...',
        description: 'The job posting text to tailor the resume against',
    })
    @IsNotEmpty()
    @IsString()
    jobPosting: string;

    @ApiProperty({
        example: 'https://www.acme.com',
        description: "The company's website",
    })
    @IsNotEmpty()
    @IsString()
    companyWebsite: string;

    @ApiPropertyOptional({
        example: 'Acme Corp',
        description:
            'Company name used for the resume PDF file name. Falls back to the Job record when omitted.',
    })
    @IsOptional()
    @IsString()
    companyName?: string;
}
