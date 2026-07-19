import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateExampleDto {
    @ApiProperty({
        example: 'Sample widget',
        description: 'Human-readable name',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @ApiPropertyOptional({ example: 'A short description of the widget.' })
    @IsOptional()
    @IsString()
    description?: string;
}
