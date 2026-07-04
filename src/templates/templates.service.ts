import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Template, TemplateDocument } from './schemas/template.schema';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { compileTemplateToHtml } from './template-compiler';

const DEFAULT_PAGE_WIDTH = 794; // A4 at 96dpi
const DEFAULT_PAGE_HEIGHT = 1123;

@Injectable()
export class TemplatesService {
  constructor(@InjectModel(Template.name) private readonly templateModel: Model<TemplateDocument>) {}

  create(dto: CreateTemplateDto): Promise<Template> {
    const pageWidth = dto.pageWidth ?? DEFAULT_PAGE_WIDTH;
    const pageHeight = dto.pageHeight ?? DEFAULT_PAGE_HEIGHT;
    const compiledTemplate = compileTemplateToHtml({ pageWidth, pageHeight, elements: dto.elements as any });

    return this.templateModel.create({ ...dto, pageWidth, pageHeight, compiledTemplate });
  }

  findAll(): Promise<Template[]> {
    return this.templateModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<Template> {
    const template = await this.templateModel.findById(id).exec();
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return template;
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<Template> {
    const existing = await this.findOne(id);

    const pageWidth = dto.pageWidth ?? existing.pageWidth;
    const pageHeight = dto.pageHeight ?? existing.pageHeight;
    const elements = (dto.elements as any) ?? existing.elements;
    const compiledTemplate = compileTemplateToHtml({ pageWidth, pageHeight, elements });

    const updated = await this.templateModel
      .findByIdAndUpdate(id, { ...dto, pageWidth, pageHeight, elements, compiledTemplate }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.templateModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Template ${id} not found`);
    }
  }
}
