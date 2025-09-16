import { IsString, IsEmail, IsOptional, IsIn, IsNotEmpty } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsIn(['Products & Families', 'Attributes & Groups', 'Assets & Uploading', 'Import / Export', 'Permissions & Roles', 'Billing & Account', 'Other'])
  category: string;

  @IsString()
  @IsIn(['Low', 'Normal', 'High', 'Urgent'])
  priority: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  workspace?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  steps?: string;

  @IsString()
  @IsOptional()
  expected?: string;

  @IsString()
  @IsOptional()
  actual?: string;

  // Honeypot field for bot detection
  @IsString()
  @IsOptional()
  website?: string;
}