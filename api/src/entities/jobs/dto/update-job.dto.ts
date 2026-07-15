import { PartialType } from '@nestjs/swagger';
import { CreateExampleDto } from './create-job.dto';

export class UpdateJobDto extends PartialType(CreateJobDto) {}
