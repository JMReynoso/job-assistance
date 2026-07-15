import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJobDto {
  @ApiProperty({ example: 'Sample widget', description: 'Human-readable name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName: string;

  @ApiProperty({ example: 'Sample widget', description: 'Human-readable name' })
  @IsURL()
  @IsNotEmpty()
  jobPostingURL: string;

  @ApiProperty({ example: 'Sample widget', description: 'Human-readable name' })
  @IsURL()
  @IsNotEmpty()
  companyPage: string;

  @ApiProperty({ example: 'Sample widget', description: 'Human-readable name' })
  @IsURL()
  @IsNotEmpty()
  companyLinkedIn: string;

  @ApiPropertyOptional({ example: 'Sample widget', description: 'Human-readable name' })
  @IsURL()
  @IsOptional()
  extraURLs?: string;
}
