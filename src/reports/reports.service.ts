import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { ProductsService } from '../products/products.service';
import { TemplatesService } from '../templates/templates.service';
import { compileTemplateToHtml } from '../templates/template-compiler';
import { PreviewTemplateDto } from '../templates/dto/preview-template.dto';

const DEFAULT_PAGE_WIDTH = 794;
const DEFAULT_PAGE_HEIGHT = 1123;

export interface ReportContext {
  generatedAt: string;
  products: Array<{
    sku: string;
    name: string;
    category: string;
    quantity: number;
    unitPrice: string;
    value: string;
    isLowStock: boolean;
  }>;
  totalValue: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly templatesService: TemplatesService
  ) {}

  // Exposed so the template editor can show/measure real field values (e.g. "generatedAt")
  // instead of the raw {{ fieldPath }} placeholder, which is a different length and was
  // causing auto-fit boxes to clip the real value once rendered into the actual PDF.
  async getReportContext(): Promise<ReportContext> {
    return this.buildReportContext();
  }

  private async buildReportContext(): Promise<ReportContext> {
    const products = await this.productsService.findAll();

    const rows = products.map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category ?? '-',
      quantity: product.quantity,
      unitPrice: product.unitPrice.toFixed(2),
      value: (product.quantity * product.unitPrice).toFixed(2),
      isLowStock: product.quantity <= product.lowStockThreshold,
    }));

    const totalValue = rows.reduce((sum, row) => sum + Number(row.value), 0).toFixed(2);

    const generatedAt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

    return { generatedAt, products: rows, totalValue };
  }

  private async renderHtmlToPdf(html: string, margin = { top: '20px', bottom: '20px' }): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async renderStockReportHtml(): Promise<string> {
    const context = await this.buildReportContext();
    const templateSource = await readFile(join(__dirname, 'templates', 'stock-report.hbs'), 'utf-8');
    return handlebars.compile(templateSource)(context);
  }

  async renderStockReportPdf(): Promise<Buffer> {
    return this.renderHtmlToPdf(await this.renderStockReportHtml());
  }

  async renderCustomTemplateHtml(templateId: string): Promise<string> {
    const template = await this.templatesService.findOne(templateId);
    const context = await this.buildReportContext();
    return handlebars.compile(template.compiledTemplate)(context);
  }

  async renderCustomTemplatePdf(templateId: string): Promise<Buffer> {
    // Custom templates render an absolutely-positioned page box sized to the exact
    // A4 pixel dimensions, so no extra Puppeteer margin should eat into that box
    // (otherwise the tail of the page overflows onto a blank second page).
    return this.renderHtmlToPdf(await this.renderCustomTemplateHtml(templateId), { top: '0px', bottom: '0px' });
  }

  // Compiles + renders an in-progress (unsaved) template layout directly, so the editor
  // can show a live preview without writing every keystroke to the database.
  async renderPreviewPdf(dto: PreviewTemplateDto): Promise<Buffer> {
    const compiled = compileTemplateToHtml({
      pageWidth: dto.pageWidth ?? DEFAULT_PAGE_WIDTH,
      pageHeight: dto.pageHeight ?? DEFAULT_PAGE_HEIGHT,
      elements: dto.elements as any,
    });
    const context = await this.buildReportContext();
    const html = handlebars.compile(compiled)(context);
    return this.renderHtmlToPdf(html, { top: '0px', bottom: '0px' });
  }
}
