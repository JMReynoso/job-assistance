import { ApiProperty } from '@nestjs/swagger';
import { GeneratedContent } from './entities/generated-content.entity';
import { MissingKeyword } from './entities/missing-keyword.entity';

/**
 * A generation run together with the missing keywords scored against it — the
 * shape GeneratedContentService.findByJobIdWithKeywords actually returns, and
 * so what both the by-job read and the job detail's `content` put on the
 * wire. Swagger-only: nothing instantiates this at runtime.
 */
export class GeneratedContentWithKeywordsResponse extends GeneratedContent {
    @ApiProperty({
        type: MissingKeyword,
        isArray: true,
        description: 'Ordered by id, i.e. highest impact first.',
    })
    missingKeywords: MissingKeyword[];
}
