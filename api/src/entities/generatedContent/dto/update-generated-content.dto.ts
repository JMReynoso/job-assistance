import { PartialType } from '@nestjs/mapped-types';
import { CreateGeneratedContentDto } from './create-generated-content.dto';

export class UpdateGeneratedContentDto extends PartialType(
    CreateGeneratedContentDto,
) {}
