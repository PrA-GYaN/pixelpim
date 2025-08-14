import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetGroupDto } from './create-asset-group.dto';

export class UpdateAssetGroupDto extends PartialType(CreateAssetGroupDto) {}
