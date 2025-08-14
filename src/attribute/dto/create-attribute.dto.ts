import { IsString, IsNotEmpty, IsOptional, IsEnum, Length, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AttributeType } from '../../types/attribute-type.enum';
import { UserAttributeType, userTypeToStorageType } from '../../types/user-attribute-type.enum';

export class CreateAttributeDto {
  @IsString()
  @IsNotEmpty({ message: 'Attribute name is required' })
  @Length(1, 100, { message: 'Attribute name must be between 1 and 100 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, { 
    message: 'Attribute name can only contain letters, numbers, spaces, hyphens, and underscores' 
  })
  name: string;

  // Accept both user-friendly types and storage types for backward compatibility
  @IsEnum([...Object.values(UserAttributeType), ...Object.values(AttributeType)], {
    message: `Type must be one of: ${Object.values(UserAttributeType).join(', ')} or ${Object.values(AttributeType).join(', ')}`
  })
  @IsNotEmpty({ message: 'Attribute type is required' })
  @Transform(({ value }) => {
    // If it's a user-friendly type, convert to storage type
    if (Object.values(UserAttributeType).includes(value as UserAttributeType)) {
      return userTypeToStorageType(value as UserAttributeType);
    }
    // Otherwise, assume it's already a storage type
    return value;
  })
  type: AttributeType;

  @IsOptional()
  @Transform(({ value, obj }) => {
    // Pre-validate based on type if possible
    if (value === null || value === undefined) return value;
    
    // For string types, trim whitespace
    if ([AttributeType.STRING, AttributeType.TEXT, AttributeType.EMAIL, AttributeType.URL].includes(obj.type)) {
      return typeof value === 'string' ? value.trim() : value;
    }
    
    return value;
  })
  defaultValue?: any;
}
