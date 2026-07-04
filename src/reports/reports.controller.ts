import { Body, Controller, Get, Header, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { PreviewTemplateDto } from '../templates/dto/preview-template.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('stock-pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="stock-report.pdf"')
  async getStockReportPdf(@Res({ passthrough: true }) res: Response) {
    const pdf = await this.reportsService.renderStockReportPdf();
    res.send(pdf);
  }

  @Get('stock-html')
  @Header('Content-Type', 'text/html')
  getStockReportHtml() {
    return this.reportsService.renderStockReportHtml();
  }

  @Get('custom/:templateId/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="custom-report.pdf"')
  async getCustomReportPdf(@Param('templateId') templateId: string, @Res({ passthrough: true }) res: Response) {
    const pdf = await this.reportsService.renderCustomTemplatePdf(templateId);
    res.send(pdf);
  }

  @Get('custom/:templateId/html')
  @Header('Content-Type', 'text/html')
  getCustomReportHtml(@Param('templateId') templateId: string) {
    return this.reportsService.renderCustomTemplateHtml(templateId);
  }

  @Post('preview-pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="preview.pdf"')
  async getPreviewPdf(@Body() dto: PreviewTemplateDto, @Res({ passthrough: true }) res: Response) {
    const pdf = await this.reportsService.renderPreviewPdf(dto);
    res.send(pdf);
  }

  @Get('context')
  getContext() {
    return this.reportsService.getReportContext();
  }
}
