import { IsNotEmpty, IsUrl } from 'class-validator';

export class ImportCsvDto {
  @IsNotEmpty()
  @IsUrl()
  csvUrl: string;
}

export class ImportCsvResponseDto {
  imported: number;
  errors: string[];
  totalProcessed: number;
  executionTime: number;
}
