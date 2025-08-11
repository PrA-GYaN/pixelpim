import { PartialType } from '@nestjs/mapped-types';
import { CreateAttributeGroupDto } from './create-attribute-group.dto';

export class UpdateAttributeGroupDto extends PartialType(CreateAttributeGroupDto) {}
