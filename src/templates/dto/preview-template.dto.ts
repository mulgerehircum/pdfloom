import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { TemplateElementDto } from './create-template.dto';

export class PreviewTemplateDto {
  @IsNumber()
  @IsOptional()
  pageWidth?: number;

  @IsNumber()
  @IsOptional()
  pageHeight?: number;

  @IsString()
  @IsOptional()
  pageBackgroundColor?: string;

  @IsNumber()
  @IsOptional()
  pageCount?: number;

  @ValidateNested({ each: true })
  @Type(() => TemplateElementDto)
  elements: TemplateElementDto[];
}
