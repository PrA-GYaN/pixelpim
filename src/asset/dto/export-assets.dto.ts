import { IsEnum, IsOptional, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export enum ExportFormat {
  JSON = 'json',
  XML = 'xml',
}

export enum ExportType {
  ALL = 'all',
  SELECTED = 'selected',
  FOLDER = 'folder',
  MULTIPLE_FOLDERS = 'multiple_folders',
}

export class ExportAssetsDto {
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsEnum(ExportType)
  type: ExportType;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  assetIds?: number[];

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  assetGroupId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  assetGroupIds?: number[];

  @IsOptional()
  includeSubfolders?: boolean;
}
