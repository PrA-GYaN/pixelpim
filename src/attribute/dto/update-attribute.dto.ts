import { IsString, IsOptional, IsEnum, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { AttributeType } from '../../types/attribute-type.enum';

export class UpdateAttributeDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @Length(1, 100, { message: 'Attribute name must be between 1 and 100 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, { 
    message: 'Attribute name can only contain letters, numbers, spaces, hyphens, and underscores' 
  })
  name?: string;

  @IsOptional()
  @IsEnum(AttributeType, {
    message: `Type must be one of: ${Object.values(AttributeType).join(', ')}`
  })
  type?: AttributeType;

  @IsOptional()
  @Transform(({ value, obj }) => {
    // Pre-validate based on type if possible
    if (value === null || value === undefined) return value;
    
    // For string types, trim whitespace
    if (obj.type && [AttributeType.STRING, AttributeType.TEXT, AttributeType.EMAIL, AttributeType.URL].includes(obj.type)) {
      return typeof value === 'string' ? value.trim() : value;
    }
    
    return value;
  })
  defaultValue?: any;
}
