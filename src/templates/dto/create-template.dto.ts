import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { GOOGLE_FONT_NAMES } from '../google-fonts';
import { BACKGROUND_FILL_VALUES, TEXT_ALIGN_VALUES } from '../schemas/template.schema';
import type { BackgroundFill, TextAlign } from '../schemas/template.schema';

export class GradientStopDto {
  @IsString()
  @IsNotEmpty()
  color: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  position: number;
}

export class TableColumnDto {
  // Cosmetic display text only — empty is a valid value (e.g. mid-edit while retyping,
  // or a deliberately blank header), unlike fieldPath which must reference a real field.
  @IsString()
  label: string;

  @IsString()
  @IsNotEmpty()
  fieldPath: string;

  @IsBoolean()
  @IsOptional()
  badge?: boolean;

  @IsString()
  @IsOptional()
  badgeTrueLabel?: string;

  @IsString()
  @IsOptional()
  badgeTrueBg?: string;

  @IsString()
  @IsOptional()
  badgeTrueColor?: string;

  @IsString()
  @IsOptional()
  badgeFalseLabel?: string;

  @IsString()
  @IsOptional()
  badgeFalseBg?: string;

  @IsString()
  @IsOptional()
  badgeFalseColor?: string;

  @IsBoolean()
  @IsOptional()
  bold?: boolean;

  @IsIn(TEXT_ALIGN_VALUES)
  @IsOptional()
  align?: TextAlign;
}

export class TemplateElementDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsIn(['text', 'field', 'table', 'image', 'panel', 'chart'])
  type: 'text' | 'field' | 'table' | 'image' | 'panel' | 'chart';

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  @Min(1)
  width: number;

  @IsNumber()
  @Min(1)
  height: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  page?: number;

  @IsNumber()
  @IsOptional()
  fontSize?: number;

  @IsIn(GOOGLE_FONT_NAMES)
  @IsOptional()
  fontFamily?: string;

  @IsBoolean()
  @IsOptional()
  bold?: boolean;

  @IsBoolean()
  @IsOptional()
  italic?: boolean;

  @IsBoolean()
  @IsOptional()
  underline?: boolean;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  backgroundColor?: string;

  @IsIn(BACKGROUND_FILL_VALUES)
  @IsOptional()
  backgroundFill?: BackgroundFill;

  @ValidateNested({ each: true })
  @Type(() => GradientStopDto)
  @IsOptional()
  gradientStops?: GradientStopDto[];

  @IsNumber()
  @IsOptional()
  gradientAngle?: number;

  @IsNumber()
  @IsOptional()
  borderRadius?: number;

  @IsString()
  @IsOptional()
  boxShadow?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  fieldPath?: string;

  @IsString()
  @IsOptional()
  itemsPath?: string;

  @ValidateNested({ each: true })
  @Type(() => TableColumnDto)
  @IsOptional()
  columns?: TableColumnDto[];

  @IsString()
  @IsOptional()
  chartValueField?: string;

  @IsString()
  @IsOptional()
  chartLabelField?: string;

  @IsString()
  @IsOptional()
  chartBarColor?: string;

  @IsString()
  @IsOptional()
  imageData?: string;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsOptional()
  pageWidth?: number;

  @IsNumber()
  @IsOptional()
  pageHeight?: number;

  @IsString()
  @IsOptional()
  pageBackgroundColor?: string;

  @IsIn(BACKGROUND_FILL_VALUES)
  @IsOptional()
  pageBackgroundFill?: BackgroundFill;

  @ValidateNested({ each: true })
  @Type(() => GradientStopDto)
  @IsOptional()
  pageGradientStops?: GradientStopDto[];

  @IsNumber()
  @IsOptional()
  pageGradientAngle?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  pageCount?: number;

  @ValidateNested({ each: true })
  @Type(() => TemplateElementDto)
  @ArrayMinSize(1)
  elements: TemplateElementDto[];

  @IsBoolean()
  @IsOptional()
  shared?: boolean;

  @IsIn(['free', 'premium'])
  @IsOptional()
  tier?: 'free' | 'premium';
}
