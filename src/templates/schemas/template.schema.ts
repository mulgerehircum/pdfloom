import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TemplateDocument = Template & Document;

export type ElementType = 'text' | 'field' | 'table' | 'image';

@Schema({ _id: false })
export class TableColumn {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  fieldPath: string;
}
export const TableColumnSchema = SchemaFactory.createForClass(TableColumn);

@Schema({ _id: false })
export class TemplateElement {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, enum: ['text', 'field', 'table', 'image'] })
  type: ElementType;

  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;

  @Prop({ default: 12 })
  fontSize: number;

  // 'text' elements: literal content rendered as-is.
  @Prop()
  content?: string;

  // 'field' elements: dot-path into the report data context, e.g. "totalValue".
  @Prop()
  fieldPath?: string;

  // 'table' elements: itemsPath is the array in the data context (e.g. "products"),
  // columns map each cell to a field on every item in that array.
  @Prop()
  itemsPath?: string;

  @Prop({ type: [TableColumnSchema], default: undefined })
  columns?: TableColumn[];

  // 'image' elements: a data: URI (base64), produced by POST /templates/upload-image.
  // Embedded directly rather than stored as a separate file — no static file serving or
  // extra Docker volume to get right, and Puppeteer never needs to fetch an external resource.
  @Prop()
  imageData?: string;
}
export const TemplateElementSchema = SchemaFactory.createForClass(TemplateElement);

@Schema({ timestamps: true })
export class Template {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, default: 794 })
  pageWidth: number;

  @Prop({ required: true, default: 1123 })
  pageHeight: number;

  @Prop({ type: [TemplateElementSchema], default: [] })
  elements: TemplateElement[];

  @Prop({ required: true })
  compiledTemplate: string;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);
