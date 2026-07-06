import { Type } from 'class-transformer';
import { IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { TemplateElementDto } from './create-template.dto';

export class PreviewTemplateDto {
  @IsNumber()
  @IsOptional()
  pageWidth?: number;

  @IsNumber()
  @IsOptional()
  pageHeight?: number;

  @IsNumber()
  @IsOptional()
  pageCount?: number;

  @ValidateNested({ each: true })
  @Type(() => TemplateElementDto)
  elements: TemplateElementDto[];
}
