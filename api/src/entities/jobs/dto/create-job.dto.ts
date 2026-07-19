import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateJobDto {
    @ApiProperty({
        example: 'Sample widget',
        description: 'Human-readable name',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    companyName: string;

    @ApiProperty({
        example: 'Sample widget',
        description: 'Human-readable name',
    })
    @IsUrl()
    @IsNotEmpty()
    jobPostingURL: string;

    @ApiProperty({
        example: 'Sample widget',
        description: 'Human-readable name',
    })
    @IsUrl()
    @IsNotEmpty()
    companyPage: string;

    @ApiProperty({
        example: 'Sample widget',
        description: 'Human-readable name',
    })
    @IsUrl()
    @IsNotEmpty()
    companyLinkedIn: string;

    @ApiPropertyOptional({
        example: 'Sample widget',
        description: 'Human-readable name',
    })
    @IsUrl()
    @IsOptional()
    extraURLs?: string;
}
