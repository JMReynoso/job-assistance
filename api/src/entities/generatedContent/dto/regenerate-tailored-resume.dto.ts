import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
} from 'class-validator';
import type { AiProviderName } from '../../../externalAPIs/ai/ai-provider.interface';

export class RegenerateTailoredResumeDto {
    @ApiProperty({
        example: 7,
        description: 'The job to regenerate the tailored resume for',
    })
    @IsNotEmpty()
    @IsInt()
    @IsPositive()
    jobId: number;

    @ApiProperty({
        example: ['Kubernetes', 'gRPC'],
        description:
            'The missing keywords the user checked to work into the resume',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    keywords: string[];

    @ApiPropertyOptional({
        example: 'ollama',
        enum: ['claude', 'ollama'],
        description:
            'Which engine to regenerate with. Omitted, the server uses ' +
            'AI_PROVIDER, which defaults to the free local one.',
    })
    @IsOptional()
    @IsIn(['claude', 'ollama'])
    provider?: AiProviderName;
}
