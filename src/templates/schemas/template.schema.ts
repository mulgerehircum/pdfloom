import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Types } from 'mongoose';
import { GOOGLE_FONT_NAMES } from '../google-fonts';

export type TemplateDocument = Template & Document;

export type ElementType = 'text' | 'field' | 'table' | 'image' | 'panel' | 'chart';
export type TextAlign = 'left' | 'center' | 'right';
export const TEXT_ALIGN_VALUES: TextAlign[] = ['left', 'center', 'right'];

// 'solid' (or unset) uses the plain backgroundColor prop; the three gradient fills all use
// gradientStops/gradientAngle below — only which CSS gradient function gets built differs
// (see template-compiler.ts's compileBackground).
export type BackgroundFill = 'solid' | 'linear' | 'radial' | 'conic';
export const BACKGROUND_FILL_VALUES: BackgroundFill[] = ['solid', 'linear', 'radial', 'conic'];

@Schema({ _id: false })
export class GradientStop {
  @Prop({ required: true })
  color: string;

  // 0-100, position along the gradient — for 'linear' this is distance along the angled
  // line, for 'radial' distance from center, for 'conic' degrees-as-percent around the circle.
  @Prop({ required: true, min: 0, max: 100 })
  position: number;
}
export const GradientStopSchema = SchemaFactory.createForClass(GradientStop);

@Schema({ _id: false })
export class TableColumn {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  fieldPath: string;

  // When true, fieldPath is treated as a boolean and rendered as a colored pill (the
  // true/false label + color pairs below) instead of the raw true/false text.
  @Prop()
  badge?: boolean;

  @Prop()
  badgeTrueLabel?: string;

  @Prop()
  badgeTrueBg?: string;

  @Prop()
  badgeTrueColor?: string;

  @Prop()
  badgeFalseLabel?: string;

  @Prop()
  badgeFalseBg?: string;

  @Prop()
  badgeFalseColor?: string;

  // Per-column formatting — independent of the table element's own bold/textAlign, so e.g.
  // a numeric column can be right-aligned while a name column stays left-aligned.
  @Prop()
  bold?: boolean;

  @Prop({ enum: TEXT_ALIGN_VALUES })
  align?: TextAlign;
}
export const TableColumnSchema = SchemaFactory.createForClass(TableColumn);

@Schema({ _id: false })
export class TemplateElement {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, enum: ['text', 'field', 'table', 'image', 'panel', 'chart'] })
  type: ElementType;

  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;

  // Which page (0-indexed) this element is placed on — see Template.pageCount.
  @Prop({ default: 0 })
  page: number;

  @Prop({ default: 12 })
  fontSize: number;

  @Prop({ enum: GOOGLE_FONT_NAMES })
  fontFamily?: string;

  @Prop()
  bold?: boolean;

  @Prop()
  italic?: boolean;

  @Prop()
  underline?: boolean;

  // CSS color (e.g. "#ffffff" or "rgba(...)") for 'text'/'field' content. Optional — falls
  // back to the browser default (black) when unset, same as every element before this.
  @Prop()
  color?: string;

  // CSS background-color for the element's box — lets a plain 'text' element (even with
  // empty content) double as a colored panel/rect behind other elements placed on top of it.
  @Prop()
  backgroundColor?: string;

  // Gradient background — takes over from the plain backgroundColor above whenever fill is
  // anything but 'solid' and at least 2 stops are present (see template-compiler.ts), so an
  // element has either a solid fill or a gradient, never both at once.
  @Prop({ enum: BACKGROUND_FILL_VALUES, default: 'solid' })
  backgroundFill?: BackgroundFill;

  @Prop({ type: [GradientStopSchema], default: undefined })
  gradientStops?: GradientStop[];

  // Degrees — meaningful for 'linear' (direction of the line) and 'conic' (start angle);
  // ignored for 'radial', which is always centered.
  @Prop({ default: 135 })
  gradientAngle?: number;

  @Prop()
  borderRadius?: number;

  // Raw CSS box-shadow value (e.g. "6px 6px 0 #111" or "0 0 24px rgba(124,247,196,.4)") —
  // sanitized by denylist (template-compiler.ts) rather than a strict allow-list regex like
  // color, since box-shadow syntax has too many legitimate shapes (multiple offsets, spread,
  // inset, commas for multiple shadows) to enumerate.
  @Prop()
  boxShadow?: string;

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

  // 'chart' elements: a real (not fabricated) bar chart over the same itemsPath array a
  // table would use — chartValueField is the numeric field each bar's height derives from
  // (normalized against the max value in the array at render time, not baked in at save
  // time, so it stays correct as the underlying data changes), chartLabelField is the
  // optional text under each bar.
  @Prop()
  chartValueField?: string;

  @Prop()
  chartLabelField?: string;

  @Prop()
  chartBarColor?: string;

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

  // One background for every page in the template — same reasoning as pageWidth/pageHeight
  // being template-wide rather than per-page. Falls back to white (see template-compiler.ts)
  // when unset.
  @Prop()
  pageBackgroundColor?: string;

  // Page-level gradient — same fill/stops/angle model and override relationship with
  // pageBackgroundColor as an element's backgroundFill/gradientStops has with its own
  // backgroundColor.
  @Prop({ enum: BACKGROUND_FILL_VALUES, default: 'solid' })
  pageBackgroundFill?: BackgroundFill;

  @Prop({ type: [GradientStopSchema], default: undefined })
  pageGradientStops?: GradientStop[];

  @Prop({ default: 135 })
  pageGradientAngle?: number;

  @Prop({ type: [TemplateElementSchema], default: [] })
  elements: TemplateElement[];

  // Total page count — kept independent of `elements` so a deliberately blank trailing
  // page (added but not yet populated) still persists rather than disappearing.
  @Prop({ required: true, default: 1 })
  pageCount: number;

  @Prop({ required: true })
  compiledTemplate: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  // Opts a template into the public gallery (browsable/clonable by anyone) — separate from
  // ownership, which stays with the original creator regardless of sharing.
  @Prop({ default: false, index: true })
  shared: boolean;

  // Freemium gate — enforced client-side only for now (lock icon + upgrade prompt on
  // 'premium' templates in the gallery). No payment/billing backs this yet.
  @Prop({ enum: ['free', 'premium'], default: 'free' })
  tier: 'free' | 'premium';
}

export const TemplateSchema = SchemaFactory.createForClass(Template);
