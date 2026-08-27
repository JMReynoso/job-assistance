import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class RegenerateTailoredResumeDto {
    @ApiProperty({ example: 7, description: 'The job to regenerate the tailored resume for' })
    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    jobId: number;

    @ApiProperty({
        example: ['Kubernetes', 'gRPC'],
        description: 'The missing keywords the user checked to work into the resume',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    keywords: string[];
}
