import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    IsUrl,
} from 'class-validator';

export class CreateCompanyResearchDto {
    @ApiProperty({
        example: 1,
        description: 'Id of the job this research belongs to',
    })
    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    jobId: number;

    @ApiProperty({
        example: 'Acme Corp',
        description: 'Name of the company being researched',
    })
    @IsString()
    @IsNotEmpty()
    companyName: string;

    @ApiProperty({
        example: 'https://boards.greenhouse.io/acme/jobs/123456',
        description: 'URL of the original job posting',
    })
    @IsNotEmpty()
    @IsUrl()
    jobPostingUrl: string;

    @ApiProperty({
        example: 'https://www.acme.com',
        description: "Company's main website",
    })
    @IsNotEmpty()
    @IsUrl()
    companyPageUrl: string;

    @ApiProperty({
        example: 'https://www.linkedin.com/company/acme-corp',
        description: "Company's LinkedIn page",
    })
    @IsNotEmpty()
    @IsUrl()
    companyLinkedInUrl: string;

    /* fronent will have a text area for links.
    
    front end code should be this to convert all links into an array:

    const extraLinks = textareaValue
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    */
    @ApiPropertyOptional({
        type: [String],
        example: [
            'https://www.crunchbase.com/organization/acme-corp',
            'https://en.wikipedia.org/wiki/Acme_Corporation',
        ],
        description: 'Any additional links relevant to the research',
    })
    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    extraLinks?: string[];
}
