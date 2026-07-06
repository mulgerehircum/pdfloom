import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Error as MongooseError, Model } from 'mongoose';
import { Template, TemplateDocument } from './schemas/template.schema';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { compileTemplateToHtml } from './template-compiler';

const DEFAULT_PAGE_WIDTH = 794; // A4 at 96dpi
const DEFAULT_PAGE_HEIGHT = 1123;

// Mongoose's own ValidationError (e.g. a table column saved with an empty label — `required`
// treats '' as missing) isn't something NestJS's exception filters know how to map, so left
// uncaught it surfaces as a raw 500 instead of a 400 the frontend can actually show a message for.
function toHttpError(err: unknown): never {
  if (err instanceof MongooseError.ValidationError) {
    throw new BadRequestException(err.message);
  }
  throw err;
}

@Injectable()
export class TemplatesService {
  constructor(@InjectModel(Template.name) private readonly templateModel: Model<TemplateDocument>) {}

  async create(dto: CreateTemplateDto, ownerId: string): Promise<Template> {
    const pageWidth = dto.pageWidth ?? DEFAULT_PAGE_WIDTH;
    const pageHeight = dto.pageHeight ?? DEFAULT_PAGE_HEIGHT;
    const pageCount = dto.pageCount ?? 1;
    const compiledTemplate = compileTemplateToHtml({ pageWidth, pageHeight, pageCount, elements: dto.elements as any });

    try {
      return await this.templateModel.create({ ...dto, pageWidth, pageHeight, pageCount, compiledTemplate, createdBy: ownerId });
    } catch (err) {
      toHttpError(err);
    }
  }

  findAllByOwner(ownerId: string): Promise<Template[]> {
    return this.templateModel.find({ createdBy: ownerId }).sort({ name: 1 }).exec();
  }

  // Unrestricted by ownership — used internally by ReportsService to render a template's
  // PDF/HTML, which stays a public route regardless of who owns the template it's based on.
  async findOne(id: string): Promise<Template> {
    const template = await this.templateModel.findById(id).exec();
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return template;
  }

  // Ownership-checked read, for routes where the caller is managing (viewing-to-edit,
  // updating, deleting) their own template rather than just rendering its output.
  async findOwned(id: string, ownerId: string): Promise<Template> {
    const template = await this.findOne(id);
    if (template.createdBy.toString() !== ownerId) {
      throw new ForbiddenException('You do not own this template');
    }
    return template;
  }

  async update(id: string, dto: UpdateTemplateDto, ownerId: string): Promise<Template> {
    const existing = await this.findOwned(id, ownerId);

    const pageWidth = dto.pageWidth ?? existing.pageWidth;
    const pageHeight = dto.pageHeight ?? existing.pageHeight;
    const pageCount = dto.pageCount ?? existing.pageCount;
    const elements = (dto.elements as any) ?? existing.elements;
    const compiledTemplate = compileTemplateToHtml({ pageWidth, pageHeight, pageCount, elements });

    let updated: TemplateDocument | null;
    try {
      // findByIdAndUpdate skips schema validation by default — runValidators makes this
      // consistent with create(), which validates via the normal .save() path.
      updated = await this.templateModel
        .findByIdAndUpdate(id, { ...dto, pageWidth, pageHeight, pageCount, elements, compiledTemplate }, { new: true, runValidators: true })
        .exec();
    } catch (err) {
      toHttpError(err);
    }
    if (!updated) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return updated;
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.findOwned(id, ownerId);
    const result = await this.templateModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Template ${id} not found`);
    }
  }
}
