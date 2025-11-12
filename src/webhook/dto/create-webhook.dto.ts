import { IsString, IsArray, IsUrl, IsOptional, IsBoolean } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}