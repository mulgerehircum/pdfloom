import { Body, Controller, Get, Header, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { PreviewTemplateDto } from '../templates/dto/preview-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

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

  // Ownership-checked (see ReportsService.renderTemplatePreviewImage) — unlike the routes
  // above, this is for a picker showing the caller's own templates, not a public share link.
  //
  // Full manual @Res() (no passthrough) — combining a guard with @Res({ passthrough: true })
  // + a manual res.send() here caused Nest to also try to write its own (empty) reply on top
  // of the already-sent buffer, throwing ERR_HTTP_HEADERS_SENT. None of this app's other
  // binary-response routes pair a guard with passthrough, so this combination hadn't been
  // exercised before. Passthrough works fine without a guard (see getPreviewPdf below).
  @UseGuards(JwtAuthGuard)
  @Get('custom/:templateId/preview-image')
  async getTemplatePreviewImage(
    @Param('templateId') templateId: string,
    @Query('width') width: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response
  ) {
    // Absent/malformed/zero all fall back to full page resolution — Number(undefined) and
    // Number('garbage') are both NaN, and NaN (like 0) is falsy, so `|| undefined` catches all three.
    const requestedWidth = Number(width) || undefined;
    const image = await this.reportsService.renderTemplatePreviewImage(templateId, user.userId, requestedWidth);
    res.set('Content-Type', 'image/png');
    res.send(image);
  }

  // Public gallery counterpart to getTemplatePreviewImage above — shared-gated instead of
  // ownership-gated, so a gallery card can show a thumbnail without the visitor owning (or
  // being logged into) the template. No guard needed, so passthrough + res.send works fine
  // here (see the comment on getTemplatePreviewImage for why that combination breaks with a
  // guard in front of it).
  //
  // Cached — unlike the owner's own picker above (which should always show a fresh render of
  // whatever they're actively editing), a gallery thumbnail rendering via headless Chromium
  // on every single visitor's request is the actual reason these were slow to load. Templates
  // in the gallery don't change often, so an hour of freshness plus a day of
  // stale-while-revalidate (serve the cached image instantly, re-render in the background)
  // makes repeat/cross-visitor loads near-instant without needing any custom cache of our own.
  @Get('public/:templateId/preview-image')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  async getPublicTemplatePreviewImage(
    @Param('templateId') templateId: string,
    @Query('width') width: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const requestedWidth = Number(width) || undefined;
    const image = await this.reportsService.renderSharedTemplatePreviewImage(templateId, requestedWidth);
    res.send(image);
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

  // Data-independent list of field/column names the template editor can offer for 'field'
  // elements and table columns — see ReportsService.getFieldSchema.
  @Get('fields')
  getFields() {
    return this.reportsService.getFieldSchema();
  }
}
