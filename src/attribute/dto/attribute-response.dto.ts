import { AttributeType } from '../../types/attribute-type.enum';
import { UserAttributeType, storageTypeToUserType } from '../../types/user-attribute-type.enum';

export class AttributeResponseDto {
  id: number;
  name: string;
  type: AttributeType;
  userFriendlyType?: UserAttributeType; // Add user-friendly type for display
  defaultValue: any;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  attributeGroups?: any[];

  // Helper method to populate user-friendly type
  static fromEntity(entity: any): AttributeResponseDto {
    const dto = new AttributeResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.type = entity.type;
    dto.userFriendlyType = storageTypeToUserType(entity.type);
    dto.defaultValue = entity.defaultValue;
    dto.userId = entity.userId;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.attributeGroups = entity.attributeGroups;
    return dto;
  }
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
