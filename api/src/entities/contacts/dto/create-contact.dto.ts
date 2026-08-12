import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsUrl,
    Max,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * A request to *find* contacts, not a contact row — POSTing this runs a Hunter
 * domain search against the company's website and saves everyone it turns up
 * against the job. (Editing a saved contact goes through UpdateContactDto,
 * which is the row shape.)
 */
export class CreateContactDto {
    @ApiProperty({
        example: 1,
        description: 'FK to the job these contacts belong to',
    })
    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    jobId: number;

    @ApiProperty({
        example: 'https://www.acme.com',
        description:
            "The company's website. Only the domain is sent to Hunter — the " +
            'scheme, www. and any path are stripped.',
    })
    @IsNotEmpty()
    @IsUrl()
    companyPageUrl: string;

    @ApiPropertyOptional({
        example: 10,
        default: 10,
        description:
            'How many contacts to look up, 1–100. Each one costs a Hunter ' +
            "credit, so keep it low unless you need the whole company's list.",
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
