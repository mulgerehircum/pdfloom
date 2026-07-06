import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB — plenty for a logo, keeps documents from bloating
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(`Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`);
    }

    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return { dataUri };
  }

  // Templates are private to their creator — listing, viewing-to-edit, updating, and
  // deleting all require being logged in and owning the template. Rendering a template's
  // output (see ReportsController's /reports/custom/:id routes) stays public regardless of
  // ownership — that's a separate concern from managing the template itself.
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.create(dto, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.findAllByOwner(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.findOwned(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.update(id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.remove(id, user.userId);
  }
}
