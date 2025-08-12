import { AttributeType } from '../../types/attribute-type.enum';

export class AttributeResponseDto {
  id: number;
  name: string;
  type: AttributeType;
  defaultValue: any;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  attributeGroups?: any[];
}

export class AttributeListResponseDto {
  attributes: AttributeResponseDto[];
  total: number;
}

export class CreateAttributeResponseDto {
  message: string;
  attribute: AttributeResponseDto;
}

export class UpdateAttributeResponseDto {
  message: string;
  attribute: AttributeResponseDto;
}

export class DeleteAttributeResponseDto {
  message: string;
}
