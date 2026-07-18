import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyResearchDto } from './create-company-research.dto';

export class UpdateCompanyResearchDto extends PartialType(CreateCompanyResearchDto) {}
