import { IsObject, IsArray, IsBoolean, IsInt, IsOptional } from 'class-validator';

export class CreateMyDealExportMappingDto {
  @IsInt()
  connectionId: number;

  @IsObject()
  fieldMappings: Record<string, string>;

  @IsArray()
  selectedFields: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateMyDealExportMappingDto {
  @IsObject()
  @IsOptional()
  fieldMappings?: Record<string, string>;

  @IsArray()
  @IsOptional()
  selectedFields?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateMyDealImportMappingDto {
  @IsInt()
  connectionId: number;

  @IsObject()
  attributeMappings: Record<string, string>;

  @IsObject()
  fieldMappings: Record<string, string>;

  @IsArray()
  selectedFields: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateMyDealImportMappingDto {
  @IsObject()
  @IsOptional()
  attributeMappings?: Record<string, string>;

  @IsObject()
  @IsOptional()
  fieldMappings?: Record<string, string>;

  @IsArray()
  @IsOptional()
  selectedFields?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export interface MyDealExportMappingResponseDto {
  id: number;
  connectionId: number;
  fieldMappings: Record<string, string>;
  selectedFields: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MyDealImportMappingResponseDto {
  id: number;
  connectionId: number;
  attributeMappings: Record<string, string>;
  fieldMappings: Record<string, string>;
  selectedFields: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MyDealConnectionWithMappingsDto {
  id: number;
  userId: number;
  connectionName: string;
  baseApiUrl: string;
  sellerId: string;
  isActive: boolean;
  isDefault: boolean;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  exportMappings?: MyDealExportMappingResponseDto[];
  importMappings?: MyDealImportMappingResponseDto[];
}
