import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

/**
 * Hand-corrections to a contact Hunter already found — a title that's out of
 * date, a name it couldn't parse. Deliberately NOT `PartialType(CreateContactDto)`:
 * that DTO describes a *lookup request* (jobId + company URL), while this one
 * describes the stored row. `jobId` isn't editable — a contact belongs to the
 * job it was found for.
 */
export class UpdateContactDto {
    @ApiPropertyOptional({ example: 'jane.doe@acme.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: 'Jane' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ example: 'Doe' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ example: 'Engineering Manager' })
    @IsOptional()
    @IsString()
    position?: string;

    @ApiPropertyOptional({ example: 'https://www.linkedin.com/in/janedoe' })
    @IsOptional()
    @IsString()
    linkedin?: string;

    @ApiPropertyOptional({ example: 92, description: '0–100' })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    confidence?: number;

    @ApiPropertyOptional({ example: 'personal', enum: ['personal', 'generic'] })
    @IsOptional()
    @IsIn(['personal', 'generic'])
    type?: 'personal' | 'generic';
}
